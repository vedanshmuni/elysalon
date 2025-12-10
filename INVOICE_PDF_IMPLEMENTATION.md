# Invoice PDF WhatsApp Integration - Implementation Summary

## What Was Implemented

Automatic invoice PDF generation and delivery via WhatsApp after payment completion.

## Changes Made

### 1. PDF Generation API (`app/api/invoices/generate-pdf/route.ts`)
- **New endpoint**: `POST /api/invoices/generate-pdf`
- Uses **Puppeteer** to generate PDF from HTML
- Uploads PDF to **Supabase Storage** (`invoices` bucket)
- Returns public URL of the generated PDF
- Features:
  - Professional invoice layout with salon branding
  - Itemized services with pricing
  - GST/tax calculations
  - Payment status and dates
  - Client details

### 2. WhatsApp Sending API (`app/api/invoices/send-whatsapp/route.ts`)
- Updated to use PDF generation endpoint
- Flow:
  1. Fetches invoice details from database
  2. Calls `/api/invoices/generate-pdf` to create PDF
  3. Receives public URL of PDF
  4. Sends PDF via WhatsApp using `sendInvoicePDF()`
  5. Updates invoice `sent_at` timestamp

### 3. WhatsApp Client (`lib/whatsapp/client.ts`)
- Updated `sendInvoicePDF()` function signature:
  ```typescript
  export async function sendInvoicePDF(
    phoneNumber: string,
    clientName: string,
    invoiceNumber: string,
    total: number,
    pdfUrl: string  // <- New parameter
  )
  ```
- Sends greeting message first
- Then sends PDF document with WhatsApp Document API
- Uses `link` parameter with public URL

### 4. Database Migration (`supabase/migrations/016_create_invoices_storage.sql`)
- Creates `invoices` storage bucket (public)
- Sets up RLS policies for upload/view/delete
- Allows authenticated users to upload
- Allows public access to view (for WhatsApp)

### 5. Package Installation
- Added **Puppeteer** (`npm install puppeteer`)
- Server-side PDF generation from HTML

## Technical Flow

```
Payment Completed
    ↓
Database Trigger Creates Invoice
    ↓
POS calls /api/invoices/send-whatsapp
    ↓
API calls /api/invoices/generate-pdf
    ↓
Puppeteer generates PDF from HTML template
    ↓
PDF uploaded to Supabase Storage (invoices bucket)
    ↓
Returns public URL
    ↓
sendInvoicePDF() sends greeting + PDF via WhatsApp
    ↓
Updates invoice.sent_at timestamp
    ↓
Client receives WhatsApp with PDF attachment
```

## Setup Requirements

### 1. Supabase Storage Bucket
Run migration or create manually in dashboard:
```bash
psql $DATABASE_URL < supabase/migrations/016_create_invoices_storage.sql
```

Or create in Supabase dashboard:
- Name: `invoices`
- Public: ✅ Yes

### 2. Environment Variables
Ensure these are set:
```env
NEXT_PUBLIC_APP_URL=https://your-app-url.com
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_access_token
```

### 3. Production Deployment (Render/Vercel)
For Puppeteer to work in production:

**Option A: Use Chromium buildpack** (Render)
Add to `render.yaml`:
```yaml
services:
  - type: web
    env: node
    buildCommand: npm install
    startCommand: npm start
```

**Option B: Use serverless Puppeteer**
Install `chrome-aws-lambda` for serverless:
```bash
npm install chrome-aws-lambda puppeteer-core
```

Update PDF generation to use:
```javascript
import chromium from 'chrome-aws-lambda';

const browser = await puppeteer.launch({
  args: chromium.args,
  executablePath: await chromium.executablePath,
  headless: chromium.headless,
});
```

## Testing

1. Go to POS page
2. Select a client with valid WhatsApp number
3. Select a booking or add services
4. Complete payment
5. Check:
   - ✅ PDF generated in Supabase Storage
   - ✅ WhatsApp message sent with PDF
   - ✅ Invoice `sent_at` timestamp updated
   - ✅ Client receives PDF document

## Files Modified

1. ✅ `app/api/invoices/generate-pdf/route.ts` - **NEW**
2. ✅ `app/api/invoices/send-whatsapp/route.ts` - Updated
3. ✅ `lib/whatsapp/client.ts` - Updated `sendInvoicePDF()`
4. ✅ `supabase/migrations/016_create_invoices_storage.sql` - **NEW**
5. ✅ `package.json` - Added Puppeteer
6. ✅ `INVOICE_PDF_SETUP.md` - **NEW** (documentation)

## What Happens Now

When a payment is completed:
1. Invoice is auto-created (existing trigger)
2. POS calls WhatsApp sending API
3. PDF is generated with professional layout
4. PDF is uploaded to Supabase Storage
5. Client receives WhatsApp with:
   - Personalized greeting message
   - PDF attachment with full invoice
6. Invoice is marked as sent

## Next Steps

1. **Create storage bucket**: Run migration or use dashboard
2. **Deploy to production**: Ensure Puppeteer/Chrome works
3. **Test with real WhatsApp**: Send invoice to real number
4. **Monitor**: Check Supabase Storage usage and costs

## Notes

- PDFs are publicly accessible (required for WhatsApp)
- Each PDF has unique filename with timestamp
- Storage bucket can be cleaned up periodically if needed
- Puppeteer adds ~100MB to deployment size
- Consider using serverless Puppeteer for cloud functions
