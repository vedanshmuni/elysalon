import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

/**
 * Cron job to process WhatsApp send queue
 * Sends invoices and other queued messages via WhatsApp
 * 
 * Schedule: Every 5 minutes
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'your-secret-key';
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceRoleClient();
    
    // Get pending messages from queue
    const { data: queueItems, error } = await supabase
      .from('whatsapp_send_queue')
      .select(`
        *,
        invoice:invoices!reference_id (
          invoice_number,
          total,
          subtotal,
          tax_amount,
          issued_at,
          client:clients (
            full_name,
            phone
          ),
          invoice_items (
            name,
            quantity,
            unit_price,
            total
          )
        )
      `)
      .eq('status', 'PENDING')
      .lt('retry_count', 3)
      .order('created_at', { ascending: true })
      .limit(20);

    if (error) {
      console.error('Error fetching queue:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const results = {
      total: queueItems?.length || 0,
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process each queue item
    for (const item of queueItems || []) {
      try {
        if (item.message_type === 'INVOICE' && item.invoice) {
          await sendInvoiceMessage(item, supabase);
          results.sent++;
        } else {
          results.failed++;
          results.errors.push(`Unknown message type or missing data: ${item.id}`);
          
          // Mark as failed
          await supabase
            .from('whatsapp_send_queue')
            .update({
              status: 'FAILED',
              error_message: 'Unknown message type or missing data',
              retry_count: item.retry_count + 1
            })
            .eq('id', item.id);
        }
      } catch (error: any) {
        console.error(`Error processing queue item ${item.id}:`, error);
        results.failed++;
        results.errors.push(`Item ${item.id}: ${error.message}`);
        
        // Update retry count
        await supabase
          .from('whatsapp_send_queue')
          .update({
            status: item.retry_count >= 2 ? 'FAILED' : 'PENDING',
            error_message: error.message,
            retry_count: item.retry_count + 1
          })
          .eq('id', item.id);
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...results,
    });
  } catch (error: any) {
    console.error('Error in process-whatsapp-queue cron:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

async function sendInvoiceMessage(item: any, supabase: any) {
  const invoice = item.invoice;
  const client = invoice.client;
  
  if (!client?.phone) {
    throw new Error('No phone number for client');
  }

  // Format invoice details
  const invoiceDate = new Date(invoice.issued_at).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // Build items list
  let itemsList = '';
  for (const item of invoice.invoice_items || []) {
    itemsList += `• ${item.name}\n  Qty: ${item.quantity} × ₹${item.unit_price} = ₹${item.total}\n`;
  }

  const message = 
    `🧾 *Invoice Generated*\n\n` +
    `Hi ${client.full_name}! Thank you for visiting us. 😊\n\n` +
    `📋 *Invoice Details:*\n` +
    `Invoice #: ${invoice.invoice_number}\n` +
    `Date: ${invoiceDate}\n\n` +
    `*Services:*\n${itemsList}\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `Subtotal: ₹${invoice.subtotal}\n` +
    `GST (18%): ₹${invoice.tax_amount}\n` +
    `*Total Paid: ₹${invoice.total}*\n\n` +
    `✅ Payment Status: PAID\n\n` +
    `Thank you for your business! We hope to see you again soon. 🙏\n\n` +
    `For any queries, please contact us.`;

  // Send WhatsApp message
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/whatsapp/send-message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: client.phone,
      message
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to send WhatsApp message: ${response.statusText}`);
  }

  // Mark as sent
  await supabase
    .from('whatsapp_send_queue')
    .update({
      status: 'SENT',
      sent_at: new Date().toISOString()
    })
    .eq('id', item.id);

  // Update invoice flag
  await supabase
    .from('invoices')
    .update({
      invoice_sent_via_whatsapp: true,
      invoice_sent_at: new Date().toISOString()
    })
    .eq('id', item.reference_id);
}
