import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { TextractClient, AnalyzeDocumentCommand } from 'https://esm.sh/@aws-sdk/client-textract@3';
import { TranscribeClient, StartTranscriptionJobCommand } from 'https://esm.sh/@aws-sdk/client-transcribe@3';
import { S3Client, PutObjectCommand } from 'https://esm.sh/@aws-sdk/client-s3@3';
import { corsHeaders } from '../_shared/cors.ts';

const awsConfig = {
  region: 'us-east-1', // Assuming us-east-1, could be configurable
  credentials: {
    accessKeyId: Deno.env.get('AWS_ACCESS_KEY_ID') || '',
    secretAccessKey: Deno.env.get('AWS_SECRET_ACCESS_KEY') || '',
  },
};

const textractClient = new TextractClient(awsConfig);
const transcribeClient = new TranscribeClient(awsConfig);
const s3Client = new S3Client(awsConfig);

// Helper to attempt basic parsing of textract results
function parseInvoiceData(text: string) {
  // We use very basic regexes here. In production, an LLM would be much better.
  const invoiceNumberMatch = text.match(/INV(?:OICE)?\s*#?[-:\s]?(\w+)/i);
  const clientNameMatch = text.match(/Client:\s*(.+?)(?:\n|$)/i) || text.match(/To:\s*(.+?)(?:\n|$)/i);
  const clientEmailMatch = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i);
  const totalMatch = text.match(/Total\s*[:$£₦]?\s*([\d,]+\.?\d*)/i);

  let total = 0;
  if (totalMatch && totalMatch[1]) {
     total = parseFloat(totalMatch[1].replace(/,/g, ''));
  }

  return {
    invoice_number: invoiceNumberMatch ? invoiceNumberMatch[1] : `INV-AI-${Date.now()}`,
    client_name: clientNameMatch ? clientNameMatch[1] : 'Unknown Client',
    client_email: clientEmailMatch ? clientEmailMatch[1] : null,
    total: isNaN(total) ? 0 : total,
    job_description: 'Extracted raw text: \n' + text.substring(0, 500) // Storing raw as fallback
  };
}


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return new Response(JSON.stringify({ error: 'No file uploaded' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fileType = file.type;
    const isImage = fileType.startsWith('image/');
    const isAudio = fileType.startsWith('audio/');

    if (!isImage && !isAudio) {
      return new Response(JSON.stringify({ error: 'Unsupported file type. Must be image or audio. PDFs are not supported for sync textract.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Attempt to get user from Authorization header
    const authHeader = req.headers.get('Authorization') || '';
    let userId = null;

    if (authHeader) {
      // Create a standard client (not service role) just to verify the user
      const authClient = createClient(
        Deno.env.get('SUPABASE_URL') || '',
        Deno.env.get('SUPABASE_ANON_KEY') || ''
      );

      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: userError } = await authClient.auth.getUser(token);

      if (!userError && user) {
         userId = user.id;
      }
    }

    // If we can't find a user but we still want to proceed, it might fail RLS or DB constraints.
    // Assuming user_id can be null or is managed. The schema says: user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
    // Let's just pass userId.

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    let extractedText = '';

    if (isImage) {
      const command = new AnalyzeDocumentCommand({
        Document: {
          Bytes: buffer,
        },
        FeatureTypes: ['TABLES', 'FORMS'],
      });
      const response = await textractClient.send(command);

      if (response.Blocks) {
          extractedText = response.Blocks
              .filter((block: any) => block.BlockType === 'LINE')
              .map((block: any) => block.Text)
              .join('\n');
      }

      const parsedData = parseInvoiceData(extractedText);

      const { data: invoice, error: invoiceError } = await supabaseClient
        .from('invoices')
        .insert([
          {
            user_id: userId, // associate with the logged-in user
            invoice_number: parsedData.invoice_number,
            client_name: parsedData.client_name,
            client_email: parsedData.client_email,
            job_description: parsedData.job_description,
            total: parsedData.total,
            status: 'draft',
            source: 'manual' // removed hallucinated 'ai_extracted', falling back to 'manual' (valid schema default)
          }
        ])
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create a single line item covering the total if we couldn't parse line items perfectly
      const { error: lineItemError } = await supabaseClient
        .from('line_items')
        .insert([
          {
            invoice_id: invoice.id,
            description: 'AI Extracted Service',
            quantity: 1,
            unit_price: parsedData.total,
            amount: parsedData.total
          }
        ]);

      if (lineItemError) throw lineItemError;

      return new Response(JSON.stringify({ message: 'Invoice extracted and stored', invoice }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });

    } else if (isAudio) {
        // Transcribe requires an S3 bucket. We assume an ENV var S3_UPLOAD_BUCKET exists.
        const bucketName = Deno.env.get('S3_UPLOAD_BUCKET') || 'tradespay-audio-bucket';
        const fileKey = `audio/${Date.now()}-${file.name}`;

        // 1. Upload to S3
        const putCommand = new PutObjectCommand({
            Bucket: bucketName,
            Key: fileKey,
            Body: buffer,
            ContentType: fileType
        });
        await s3Client.send(putCommand);

        const s3Uri = `s3://${bucketName}/${fileKey}`;
        const jobName = `transcribe-${Date.now()}`;

        // 2. Start Transcribe Job
        const transcribeCommand = new StartTranscriptionJobCommand({
            TranscriptionJobName: jobName,
            LanguageCode: 'en-US', // Defaulting to english, could be dynamic
            MediaFormat: fileType.split('/')[1] === 'mpeg' ? 'mp3' : fileType.split('/')[1], // Basic mapping, e.g. audio/mpeg -> mp3
            Media: {
                MediaFileUri: s3Uri
            }
        });

        await transcribeClient.send(transcribeCommand);

        // Transcribe jobs are async. We would normally use a webhook or polling.
        // For the scope of this edge function, we return the jobName and instruct the client
        // or a subsequent webhook to check the status later and do the mapping.
        // Or we can poll here, but Edge functions have timeouts. Let's return the job ID.

        return new Response(JSON.stringify({
            message: 'Audio upload successful. Transcription job started. Since this is asynchronous, a separate handler must poll or receive webhook to store data.',
            jobName: jobName
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 202,
        });
    }

  } catch (error: any) {
    console.error('Error processing invoice:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
