# Invoice PDF Storage Setup

## Overview
Invoice PDFs are now automatically generated and sent via WhatsApp after payment. The PDFs are stored in Supabase Storage.

## Setup Instructions

### 1. Create Storage Bucket (Option A: SQL Migration)

Run the migration:
```bash
# Apply the migration to your Supabase database
psql $DATABASE_URL < supabase/migrations/016_create_invoices_storage.sql
```

### 2. Create Storage Bucket (Option B: Supabase Dashboard)

If you prefer using the Supabase dashboard:

1. Go to your Supabase project dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **New bucket**
4. Set the following:
   - **Name**: `invoices`
   - **Public bucket**: ✅ **Yes** (checked)
   - Click **Create bucket**

5. Set up storage policies:
   - Click on the `invoices` bucket
   - Go to **Policies** tab
   - Add the following policies:

   **Upload Policy** (for authenticated users):
   ```sql
   CREATE POLICY "Allow authenticated users to upload invoices"
   ON storage.objects FOR INSERT
   TO authenticated
   WITH CHECK (bucket_id = 'invoices');
   ```

   **View Policy** (public access):
   ```sql
   CREATE POLICY "Allow public to view invoices"
   ON storage.objects FOR SELECT
   TO public
   USING (bucket_id = 'invoices');
   ```

   **Delete Policy** (for authenticated users):
   ```sql
   CREATE POLICY "Allow authenticated users to delete invoices"
   ON storage.objects FOR DELETE
   TO authenticated
   USING (bucket_id = 'invoices');
   ```

### 3. Environment Variables

Make sure you have the following environment variables set in your `.env.local`:

```env
# Your app URL (for generating PDFs)
NEXT_PUBLIC_APP_URL=https://your-app-url.com

# Supabase (should already be set)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# WhatsApp (should already be set)
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_access_token
```

### 4. Puppeteer Configuration (for Production)

If deploying to Render or similar platforms, you may need to install Chrome dependencies:

For Render, add this to your `render.yaml` or use a Dockerfile:
```yaml
services:
  - type: web
    name: salon-app
    env: node
    buildCommand: |
      npm install
      # Install Chrome dependencies
      apt-get update && apt-get install -y \
        chromium \
        fonts-liberation \
        libappindicator3-1 \
        libasound2 \
        libatk-bridge2.0-0 \
        libatk1.0-0 \
        libcups2 \
        libdbus-1-3 \
        libgdk-pixbuf2.0-0 \
        libnspr4 \
        libnss3 \
        libx11-xcb1 \
        libxcomposite1 \
        libxdamage1 \
        libxrandr2 \
        xdg-utils
    startCommand: npm start
```

Alternatively, set Puppeteer to use system Chrome:
```javascript
// In generate-pdf route
const browser = await puppeteer.launch({
  headless: true,
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});
```

## How It Works

1. **Payment Processing**: When a payment is completed in the POS
2. **Auto-Invoice Creation**: Database trigger creates an invoice automatically
3. **PDF Generation**: 
   - `/api/invoices/generate-pdf` creates a PDF using Puppeteer
   - PDF is uploaded to Supabase Storage bucket `invoices`
   - Returns public URL of the PDF
4. **WhatsApp Delivery**:
   - `/api/invoices/send-whatsapp` sends greeting message
   - Sends PDF document via WhatsApp Cloud API
   - Updates invoice `sent_at` timestamp

## Testing

1. Create a payment in the POS system
2. Select a client with a valid WhatsApp phone number
3. Complete the payment
4. Check:
   - PDF should be generated and stored in Supabase Storage
   - Client should receive WhatsApp message with PDF attachment
   - Invoice record should have `sent_at` timestamp

## Troubleshooting

### PDF Generation Fails
- Check Puppeteer is installed: `npm list puppeteer`
- For production, ensure Chrome/Chromium is available
- Check logs for specific Puppeteer errors

### WhatsApp Delivery Fails
- Verify WhatsApp credentials are correct
- Check phone number format (include country code)
- Ensure PDF URL is publicly accessible
- Check WhatsApp API error messages in logs

### Storage Upload Fails
- Verify `invoices` bucket exists and is public
- Check storage policies are correctly configured
- Verify Supabase credentials are correct

### PDF URL Not Accessible
- Ensure bucket is set to **public**
- Check if `getPublicUrl()` returns valid URL
- Test URL in browser - should open PDF directly

## File Structure

```
app/
  api/
    invoices/
      generate-pdf/
        route.ts          # Generates PDF, uploads to storage, returns URL
      send-whatsapp/
        route.ts          # Calls generate-pdf, sends via WhatsApp
lib/
  whatsapp/
    client.ts             # sendInvoicePDF() function
supabase/
  migrations/
    016_create_invoices_storage.sql  # Storage bucket setup
```

## Notes

- PDFs are generated on-the-fly for each payment
- Storage bucket is public to allow WhatsApp to download PDFs
- Invoice PDFs include: salon details, client info, items, pricing, GST
- PDF filenames include invoice number and timestamp for uniqueness
