# Multi-Tenant WhatsApp Setup Guide

## Overview
Your salon system now supports **different WhatsApp numbers for different tenants**. Each salon can have its own WhatsApp Business number, and the system automatically identifies which salon based on which number receives the message.

## How It Works

1. **Incoming Message** → WhatsApp sends webhook with `phone_number_id`
2. **System Looks Up** → Finds tenant in database by `whatsapp_phone_number_id`
3. **Sends Response** → Uses that tenant's credentials and branding

## Setup Steps

### Step 1: Run Migration
Run this SQL in your Supabase SQL Editor:

```sql
-- Add WhatsApp fields to tenants table
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS whatsapp_phone_number_id TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_access_token TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_business_account_id TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_phone_number TEXT;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tenants_whatsapp_phone_number_id 
ON tenants(whatsapp_phone_number_id);
```

### Step 2: Update Tenant WhatsApp Credentials

For each tenant/salon, update their WhatsApp credentials:

```sql
UPDATE tenants 
SET 
  name = 'Salon Name Here',  -- This appears in messages
  whatsapp_phone_number_id = '123456789012345',  -- From Meta Business
  whatsapp_access_token = 'EAAxxxx...',  -- From Meta Business  
  whatsapp_phone_number = '+919876543210',  -- Display number
  updated_at = NOW()
WHERE id = 'YOUR_TENANT_ID_HERE';
```

### Step 3: Get WhatsApp Credentials from Meta

For each salon's WhatsApp Business number:

1. Go to [Meta Business Suite](https://business.facebook.com/)
2. Select your WhatsApp Business Account
3. Go to **API Setup**
4. Note down:
   - **Phone Number ID** (looks like: `123456789012345`)
   - **Access Token** (starts with `EAA...`)
   - **Business Account ID**
   - **Phone Number** (e.g., `+919876543210`)

### Step 4: Configure Webhook

Set webhook URL in Meta:
```
https://yourdomain.com/api/whatsapp/webhook
```

**Important**: Use the SAME webhook URL for ALL WhatsApp numbers. The system automatically routes to correct tenant.

### Step 5: Verify Setup

Check if tenant is configured:

```sql
SELECT id, name, whatsapp_phone_number, whatsapp_phone_number_id 
FROM tenants 
WHERE whatsapp_phone_number_id IS NOT NULL;
```

## Example: Setting Up Two Salons

### Salon A (Mumbai)
```sql
UPDATE tenants 
SET 
  name = 'Glamour Salon Mumbai',
  whatsapp_phone_number_id = '111111111111111',
  whatsapp_access_token = 'EAAabc123...',
  whatsapp_phone_number = '+919876543210',
  phone = '+919876543210',
  updated_at = NOW()
WHERE slug = 'salon-a';
```

### Salon B (Delhi)
```sql
UPDATE tenants 
SET 
  name = 'Style Studio Delhi',
  whatsapp_phone_number_id = '222222222222222',
  whatsapp_access_token = 'EAAdef456...',
  whatsapp_phone_number = '+919123456789',
  phone = '+919123456789',
  updated_at = NOW()
WHERE slug = 'salon-b';
```

Now:
- Messages to `+919876543210` → Salon A gets them, responds as "Glamour Salon Mumbai"
- Messages to `+919123456789` → Salon B gets them, responds as "Style Studio Delhi"

## Fallback Behavior

If tenant not found by `whatsapp_phone_number_id`:
1. Try `DEFAULT_TENANT_ID` from environment
2. Use first tenant in database

## Testing

Send "hi" to each WhatsApp number and verify:
- Correct salon name appears in welcome message
- Invoice/booking messages use correct salon branding

## Troubleshooting

### Messages showing wrong salon name
```sql
-- Check which tenant is being used
SELECT id, name, whatsapp_phone_number_id 
FROM tenants 
ORDER BY created_at;

-- Update the correct one
UPDATE tenants SET name = 'Correct Salon Name' WHERE id = 'tenant-id-here';
```

### Webhook not working
1. Check webhook logs in Meta Business Suite
2. Verify `WHATSAPP_VERIFY_TOKEN` in environment matches Meta
3. Check Render/Vercel logs for incoming webhooks

### Need to use environment variables (single salon)
Set these in Render/Vercel:
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_ACCESS_TOKEN`
- `DEFAULT_TENANT_ID`

System will use these as fallback if tenant doesn't have credentials.

## Security Note

**Never commit access tokens to Git!** Always store in:
- Database (encrypted at rest in Supabase)
- Environment variables
- Secrets manager

## Cost

Each WhatsApp Business number costs:
- **Free** for first 1,000 conversations/month
- Then pay per conversation (₹0.50-2.00 per conversation)
- Multiple numbers = multiple free tiers!
