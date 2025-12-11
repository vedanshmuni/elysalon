-- Drop business account ID column if it exists
ALTER TABLE tenants DROP COLUMN IF EXISTS whatsapp_business_account_id;

-- Add WhatsApp credentials to tenants table
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS whatsapp_phone_number_id TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_access_token TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_phone_number TEXT;

-- Create index for fast lookup by phone number ID
CREATE INDEX IF NOT EXISTS idx_tenants_whatsapp_phone_number_id 
ON tenants(whatsapp_phone_number_id);

-- Create index for fast lookup by phone number
CREATE INDEX IF NOT EXISTS idx_tenants_whatsapp_phone_number 
ON tenants(whatsapp_phone_number);

-- Update existing tenant with WhatsApp credentials (EXAMPLE - replace with your values)
-- UPDATE tenants 
-- SET 
--   whatsapp_phone_number_id = 'YOUR_PHONE_NUMBER_ID',
--   whatsapp_access_token = 'YOUR_ACCESS_TOKEN',
--   whatsapp_phone_number = '+919876543210',
--   updated_at = NOW()
-- WHERE id = 'YOUR_TENANT_ID';

-- Verify the update
SELECT id, name, whatsapp_phone_number, whatsapp_phone_number_id 
FROM tenants 
WHERE whatsapp_phone_number_id IS NOT NULL;
