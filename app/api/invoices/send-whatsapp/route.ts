import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendInvoicePDF } from '@/lib/whatsapp/client';

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

    // Generate invoice PDF URL (you'll need to implement actual PDF generation)
    // For now, we'll create a simple text-based invoice
    const invoiceDetails = {
      invoiceNumber: invoice.invoice_number,
      date: new Date(invoice.issued_at).toLocaleDateString(),
      clientName: client.full_name,
      items: invoice.invoice_items.map((item: any) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.unit_price,
        total: item.total,
      })),
      subtotal: invoice.subtotal,
      tax: invoice.tax_amount,
      discount: invoice.discount_amount,
      total: invoice.total,
    };

    // Generate invoice PDF URL (you can integrate with a PDF service)
    // For now, we'll use the app URL to generate a PDF view
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://elysalon.onrender.com';
    const pdfUrl = `${appUrl}/api/invoices/${invoiceId}/pdf`;

    // Send invoice via WhatsApp
    await sendInvoicePDF(client.phone, {
      clientName: client.full_name,
      invoiceNumber: invoice.invoice_number,
      pdfUrl: pdfUrl,
      amount: `₹${invoice.total.toFixed(2)}`,
    });

    // Update invoice to mark as sent via WhatsApp
    await supabase
      .from('invoices')
      .update({ 
        invoice_sent_via_whatsapp: true,
        invoice_sent_at: new Date().toISOString()
      })
      .eq('id', invoiceId);

    return NextResponse.json({
      success: true,
      message: 'Invoice sent via WhatsApp successfully',
    });
  } catch (error: any) {
    console.error('Error sending invoice via WhatsApp:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
