import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendInvoicePDF } from '@/lib/whatsapp/client';
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

    // Generate PDF and upload to Supabase Storage
    const { pdfUrl } = await generateInvoicePDF(invoiceId);

    // Send invoice via WhatsApp with PDF URL
    const result = await sendInvoicePDF(
      client.phone,
      client.full_name || 'Valued Customer',
      invoice.invoice_number,
      invoice.total,
      pdfUrl
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send WhatsApp message' },
        { status: 500 }
      );
    }

    // Update invoice to mark as sent via WhatsApp
    await supabase
      .from('invoices')
      .update({ sent_at: new Date().toISOString() })
      .eq('id', invoiceId);

    return NextResponse.json({
      success: true,
      message: 'Invoice sent via WhatsApp successfully',
      messageId: result.messageId,
    });
  } catch (error: any) {
    console.error('Error sending invoice via WhatsApp:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
