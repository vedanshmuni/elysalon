import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendTextMessage, sendWhatsAppMessage } from '@/lib/whatsapp/client';
import { getTenantWhatsAppCredentials } from '@/lib/whatsapp/server';
import { generateInvoicePDF } from '../generate-pdf/route';

export async function POST(request: NextRequest) {
  try {
    const { invoiceId } = await request.json();

    if (!invoiceId) {
      return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Get invoice with client details
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        clients:client_id (
          full_name,
          phone,
          email
        ),
        invoice_items (*)
      `)
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Check if client has phone number
    const client = invoice.clients as any;
    if (!client?.phone) {
      return NextResponse.json(
        { error: 'Client phone number not found' },
        { status: 400 }
      );
    }

    // Format invoice details
    const invoiceDate = new Date(invoice.issued_at || invoice.created_at).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    // Build invoice text
    const itemsList = invoice.invoice_items.map((item: any) => 
      `• ${item.name} x${item.quantity} - ₹${Number(item.total).toFixed(2)}`
    ).join('\n');

    // Generate PDF and upload to Supabase Storage
    const { pdfUrl } = await generateInvoicePDF(invoiceId);

    // Create invoice caption message
    const caption = `🧾 *INVOICE #${invoice.invoice_number}*\n\n` +
      `📅 Date: ${invoiceDate}\n` +
      `👤 Customer: ${client.full_name || 'Walk-in'}\n\n` +
      `*Items:*\n${itemsList}\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `Subtotal: ₹${Number(invoice.subtotal).toFixed(2)}\n` +
      (invoice.discount_amount > 0 ? `Discount: -₹${Number(invoice.discount_amount).toFixed(2)}\n` : '') +
      `GST (18%): ₹${Number(invoice.tax_amount).toFixed(2)}\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `*Total Paid: ₹${Number(invoice.total).toFixed(2)}*\n\n` +
      `✅ Payment Status: PAID\n\n` +
      `Thank you for your business! 🙏\n` +
      `We look forward to serving you again! 💇✨`;

    // Get tenant-specific WhatsApp credentials
    const credentials = await getTenantWhatsAppCredentials(invoice.tenant_id);

    // Check if credentials are configured
    if (!credentials) {
      return NextResponse.json(
        { 
          error: 'WhatsApp not configured',
          message: 'Please configure WhatsApp credentials in Settings > Tenant Settings to send invoices via WhatsApp'
        },
        { status: 400 }
      );
    }

    // Send single message with PDF attached and full invoice details as caption
    await sendWhatsAppMessage({
      to: client.phone,
      type: 'document',
      document: {
        link: pdfUrl,
        filename: `Invoice_${invoice.invoice_number}.pdf`,
        caption: caption
      }
    }, credentials);

    // Update invoice to mark as sent
    await supabase
      .from('invoices')
      .update({ sent_at: new Date().toISOString() })
      .eq('id', invoiceId);

    return NextResponse.json({
      success: true,
      message: 'Invoice sent via WhatsApp successfully'
    });
  } catch (error: any) {
    console.error('Error sending invoice via WhatsApp:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
