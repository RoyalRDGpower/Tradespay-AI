import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json();

    // Supabase webhook payload structure
    // We expect this to be triggered on update or insert to 'invoices' table.
    // However, it could also be a scheduled function. The prompt implies it might be a triggered by some event
    // or run periodically. Let's assume it receives the invoice record in payload.record.
    // If it's a direct invocation or a webhook, we extract the invoice data.

    // We should probably handle the case where we just query the DB for unpaid Approved invoices if no specific record is sent
    // But usually a webhook payload contains the modified record.
    // Let's implement it to handle a specific record from a trigger, OR to query all if invoked without a record.

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    let invoicesToProcess = [];

    if (payload.type && payload.record) {
      // It's a database webhook
      const invoice = payload.record;
      if (invoice.status === 'Approved' && invoice.client_email) {
          invoicesToProcess.push(invoice);
      } else {
           return new Response(JSON.stringify({ message: 'No action needed for this record' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            });
      }
    } else {
      // It's a manual invocation or scheduled job, find all Approved and unpaid invoices
       const { data, error } = await supabaseClient
            .from('invoices')
            .select('*')
            .eq('status', 'Approved')
            .not('client_email', 'is', null);

        if (error) throw error;
        if (data) invoicesToProcess = data;
    }

    if (invoicesToProcess.length === 0) {
        return new Response(JSON.stringify({ message: 'No approved and unpaid invoices found with a client email' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
        throw new Error('Missing RESEND_API_KEY');
    }

    const results = [];

    for (const invoice of invoicesToProcess) {
        const emailContent = `
            <p>Dear ${invoice.client_name},</p>
            <p>This is a professional reminder regarding Invoice <strong>${invoice.invoice_number}</strong>.</p>
            <p>The total amount due is <strong>${invoice.total}</strong>.</p>
            <p>Please arrange for payment at your earliest convenience.</p>
            <p>Thank you for your business!</p>
        `;

        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'onboarding@resend.dev', // Use standard resend test domain if not configured
                to: invoice.client_email,
                subject: `Payment Reminder: Invoice ${invoice.invoice_number}`,
                html: emailContent
            })
        });

        const resData = await res.json();

        if (!res.ok) {
            console.error('Failed to send email:', resData);
            results.push({ invoice: invoice.invoice_number, status: 'failed', error: resData });
        } else {
            results.push({ invoice: invoice.invoice_number, status: 'sent', id: resData.id });
        }
    }

    return new Response(JSON.stringify({ message: 'Chaser processed', results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Error in payment-chaser:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
