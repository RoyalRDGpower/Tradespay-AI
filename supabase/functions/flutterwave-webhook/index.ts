import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get('verif-hash');
    const secretHash = Deno.env.get('FLUTTERWAVE_SECRET_HASH');

    if (!signature || signature !== secretHash) {
      return new Response(JSON.stringify({ error: 'Unauthorized. Invalid verif-hash.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = await req.json();

    // Flutterwave payload typically contains tx_ref in payload.data.tx_ref or payload.tx_ref depending on the event
    const txRef = payload.data?.tx_ref || payload.tx_ref;
    const status = payload.data?.status || payload.status;

    if (!txRef) {
       return new Response(JSON.stringify({ error: 'Missing tx_ref in payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (status === 'successful') {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') || '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        );

        const { data, error } = await supabaseClient
            .from('invoices')
            .update({ status: 'paid' })
            .eq('invoice_number', txRef)
            .select();

        if (error) {
            throw error;
        }

        return new Response(JSON.stringify({ message: 'Invoice updated successfully', data }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    } else {
        return new Response(JSON.stringify({ message: 'Ignored non-successful transaction' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    }
  } catch (error: any) {
    console.error('Error processing flutterwave webhook:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
