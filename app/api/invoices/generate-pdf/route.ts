import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Generate and upload invoice PDF to Supabase Storage
 */
export async function generateInvoicePDF(invoiceId: string) {
  try {
    const supabase = await createClient();

    // Get invoice with all details
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        client:clients!client_id (
          full_name,
          phone
        ),
        branch:branches!branch_id (
          name,
          address,
          phone
        ),
        tenant:tenants!tenant_id (
          name
        ),
        invoice_items (
          name,
          quantity,
          unit_price,
          tax_rate,
          total
        )
      `)
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      throw new Error('Invoice not found');
    }

    // Create PDF document
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4 size
    const { width, height } = page.getSize();
    
    // Load fonts
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    
    let yPosition = height - 50;
    
    // Header - Business Name
    page.drawText(invoice.tenant?.name || 'Salon', {
      x: 50,
      y: yPosition,
      size: 24,
      font: boldFont,
      color: rgb(0.15, 0.39, 0.92)
    });
    
    yPosition -= 25;
    
    // Branch details
    if (invoice.branch) {
      page.drawText(invoice.branch.name || '', {
        x: 50,
        y: yPosition,
        size: 10,
        font: regularFont
      });
      yPosition -= 15;
      
      if (invoice.branch.address) {
        page.drawText(invoice.branch.address, {
          x: 50,
          y: yPosition,
          size: 10,
          font: regularFont
        });
        yPosition -= 15;
      }
      
      if (invoice.branch.phone) {
        page.drawText(`Phone: ${invoice.branch.phone}`, {
          x: 50,
          y: yPosition,
          size: 10,
          font: regularFont
        });
      }
    }
    
    // Invoice number and date (top right)
    page.drawText('INVOICE', {
      x: width - 150,
      y: height - 50,
      size: 20,
      font: boldFont
    });
    
    page.drawText(`#${invoice.invoice_number}`, {
      x: width - 150,
      y: height - 75,
      size: 12,
      font: boldFont
    });
    
    const invoiceDate = new Date(invoice.issued_at || invoice.created_at).toLocaleDateString('en-IN');
    page.drawText(`Date: ${invoiceDate}`, {
      x: width - 150,
      y: height - 95,
      size: 10,
      font: regularFont
    });
    
    yPosition = height - 170;
    
    // Client details
    page.drawText('BILL TO:', {
      x: 50,
      y: yPosition,
      size: 10,
      font: boldFont
    });
    yPosition -= 20;
    
    page.drawText(invoice.client?.full_name || 'Walk-in Customer', {
      x: 50,
      y: yPosition,
      size: 12,
      font: regularFont
    });
    yPosition -= 15;
    
    if (invoice.client?.phone) {
      page.drawText(`Phone: ${invoice.client.phone}`, {
        x: 50,
        y: yPosition,
        size: 10,
        font: regularFont
      });
    }
    
    yPosition -= 40;
    
    // Table header
    page.drawRectangle({
      x: 50,
      y: yPosition - 20,
      width: width - 100,
      height: 25,
      color: rgb(0.95, 0.95, 0.95)
    });
    
    page.drawText('Description', {
      x: 60,
      y: yPosition - 10,
      size: 10,
      font: boldFont
    });
    
    page.drawText('Qty', {
      x: width - 250,
      y: yPosition - 10,
      size: 10,
      font: boldFont
    });
    
    page.drawText('Price', {
      x: width - 190,
      y: yPosition - 10,
      size: 10,
      font: boldFont
    });
    
    page.drawText('Total', {
      x: width - 120,
      y: yPosition - 10,
      size: 10,
      font: boldFont
    });
    
    yPosition -= 35;
    
    // Invoice items
    for (const item of invoice.invoice_items) {
      page.drawText(item.name, {
        x: 60,
        y: yPosition,
        size: 10,
        font: regularFont
      });
      
      page.drawText(item.quantity.toString(), {
        x: width - 250,
        y: yPosition,
        size: 10,
        font: regularFont
      });
      
      page.drawText(`Rs.${Number(item.unit_price).toFixed(2)}`, {
        x: width - 190,
        y: yPosition,
        size: 10,
        font: regularFont
      });
      
      page.drawText(`Rs.${Number(item.total).toFixed(2)}`, {
        x: width - 120,
        y: yPosition,
        size: 10,
        font: regularFont
      });
      
      yPosition -= 20;
    }
    
    yPosition -= 20;
    
    // Totals
    page.drawLine({
      start: { x: width - 200, y: yPosition },
      end: { x: width - 50, y: yPosition },
      thickness: 1,
      color: rgb(0, 0, 0)
    });
    
    yPosition -= 20;
    
    page.drawText('Subtotal:', {
      x: width - 190,
      y: yPosition,
      size: 10,
      font: regularFont
    });
    
    page.drawText(`Rs.${Number(invoice.subtotal).toFixed(2)}`, {
      x: width - 120,
      y: yPosition,
      size: 10,
      font: regularFont
    });
    
    yPosition -= 20;
    
    if (invoice.discount_amount > 0) {
      page.drawText('Discount:', {
        x: width - 190,
        y: yPosition,
        size: 10,
        font: regularFont
      });
      
      page.drawText(`-Rs.${Number(invoice.discount_amount).toFixed(2)}`, {
        x: width - 120,
        y: yPosition,
        size: 10,
        font: regularFont
      });
      
      yPosition -= 20;
    }
    
    page.drawText('GST (18%):', {
      x: width - 190,
      y: yPosition,
      size: 10,
      font: regularFont
    });
    
    page.drawText(`Rs.${Number(invoice.tax_amount).toFixed(2)}`, {
      x: width - 120,
      y: yPosition,
      size: 10,
      font: regularFont
    });
    
    yPosition -= 30;
    
    // Grand total
    page.drawLine({
      start: { x: width - 200, y: yPosition + 10 },
      end: { x: width - 50, y: yPosition + 10 },
      thickness: 2,
      color: rgb(0, 0, 0)
    });
    
    page.drawText('Total:', {
      x: width - 190,
      y: yPosition - 5,
      size: 12,
      font: boldFont
    });
    
    page.drawText(`Rs.${Number(invoice.total).toFixed(2)}`, {
      x: width - 120,
      y: yPosition - 5,
      size: 12,
      font: boldFont
    });
    
    // Footer
    page.drawText('Thank you for your business!', {
      x: 50,
      y: 60,
      size: 10,
      font: regularFont,
      color: rgb(0.5, 0.5, 0.5)
    });
    
    // Generate PDF buffer
    const pdfBytes = await pdfDoc.save();

    // Upload PDF to Supabase Storage (organized by client)
    const clientFolder = invoice.client?.full_name 
      ? invoice.client.full_name.replace(/[^a-zA-Z0-9]/g, '_') 
      : 'walk_in';
    const fileName = `${clientFolder}/invoice-${invoice.invoice_number}-${Date.now()}.pdf`;
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('invoices')
      .upload(fileName, pdfBytes, {
        contentType: 'application/pdf',
        upsert: false
      });

    if (uploadError) {
      console.error('Error uploading PDF to storage:', uploadError);
      throw new Error(`Failed to upload PDF: ${uploadError.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase
      .storage
      .from('invoices')
      .getPublicUrl(fileName);

    console.log('✅ PDF generated and uploaded:', publicUrl);

    return {
      success: true,
      pdfUrl: publicUrl,
      fileName
    };
  } catch (error: any) {
    console.error('Error generating invoice PDF:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { invoiceId } = await request.json();

    if (!invoiceId) {
      return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 });
    }

    const result = await generateInvoicePDF(invoiceId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in generate-pdf route:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

function generateInvoiceHTML(invoice: any) {
  const invoiceDate = new Date(invoice.issued_at || invoice.created_at).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const itemsHTML = invoice.invoice_items.map((item: any) => `
    <tr>
      <td>${item.name}</td>
      <td class="text-right">${item.quantity}</td>
      <td class="text-right">₹${Number(item.unit_price).toFixed(2)}</td>
      <td class="text-right">₹${Number(item.total).toFixed(2)}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Invoice ${invoice.invoice_number}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
        .invoice-container { max-width: 800px; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; align-items: start; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #333; }
        .company-info h1 { font-size: 28px; margin-bottom: 10px; color: #2563eb; }
        .company-info p { font-size: 14px; color: #666; margin: 4px 0; }
        .invoice-info { text-align: right; }
        .invoice-info h2 { font-size: 24px; margin-bottom: 10px; }
        .invoice-info p { font-size: 14px; margin: 4px 0; }
        .invoice-details { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
        .detail-section h3 { font-size: 14px; text-transform: uppercase; color: #666; margin-bottom: 10px; }
        .detail-section p { font-size: 14px; margin: 4px 0; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        thead { background-color: #f3f4f6; }
        th { text-align: left; padding: 12px; font-size: 12px; text-transform: uppercase; color: #666; border-bottom: 2px solid #ddd; }
        td { padding: 12px; border-bottom: 1px solid #eee; font-size: 14px; }
        .text-right { text-align: right; }
        .summary { margin-left: auto; width: 300px; }
        .summary-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
        .summary-row.total { font-size: 18px; font-weight: bold; border-top: 2px solid #333; padding-top: 12px; margin-top: 8px; }
        .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 12px; }
        .status-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; background-color: #dcfce7; color: #166534; }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <div class="header">
          <div class="company-info">
            <h1>${invoice.tenant?.name || 'Salon'}</h1>
            <p>${invoice.branch?.name || ''}</p>
            <p>${invoice.branch?.address || ''}</p>
            <p>Phone: ${invoice.branch?.phone || ''}</p>
          </div>
          <div class="invoice-info">
            <h2>INVOICE</h2>
            <p><strong>#${invoice.invoice_number}</strong></p>
            <p>Date: ${invoiceDate}</p>
            <p><span class="status-badge">PAID</span></p>
          </div>
        </div>

        <div class="invoice-details">
          <div class="detail-section">
            <h3>Bill To:</h3>
            <p><strong>${invoice.client?.full_name || 'Walk-in Customer'}</strong></p>
            ${invoice.client?.phone ? `<p>Phone: ${invoice.client.phone}</p>` : ''}
          </div>
          <div class="detail-section">
            <h3>Payment Details:</h3>
            <p>Payment Status: <strong>PAID</strong></p>
            <p>Date: ${invoiceDate}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th class="text-right">Qty</th>
              <th class="text-right">Price</th>
              <th class="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHTML}
          </tbody>
        </table>

        <div class="summary">
          <div class="summary-row">
            <span>Subtotal:</span>
            <span>₹${Number(invoice.subtotal).toFixed(2)}</span>
          </div>
          ${invoice.discount_amount > 0 ? `
          <div class="summary-row">
            <span>Discount:</span>
            <span>-₹${Number(invoice.discount_amount).toFixed(2)}</span>
          </div>
          ` : ''}
          <div class="summary-row">
            <span>GST (18%):</span>
            <span>₹${Number(invoice.tax_amount).toFixed(2)}</span>
          </div>
          <div class="summary-row total">
            <span>Total Amount:</span>
            <span>₹${Number(invoice.total).toFixed(2)}</span>
          </div>
        </div>

        <div class="footer">
          <p>Thank you for your business!</p>
          <p>This is a computer-generated invoice.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
