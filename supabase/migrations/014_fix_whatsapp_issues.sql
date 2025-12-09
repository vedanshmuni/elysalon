-- Fix WhatsApp Integration Issues
-- Run this migration to resolve tenant lookup and broadcast errors

-- Step 1: Update your tenant with WhatsApp number
-- First find your tenant ID, then update with your WhatsApp number
-- Replace 'YOUR_TENANT_ID_HERE' with actual UUID after running SELECT below

-- Uncomment and run this to see your tenant:
-- SELECT id, name, slug, owner_user_id FROM tenants;

-- Then uncomment and update this with your tenant ID:
-- UPDATE tenants SET whatsapp_number = '919920047759' WHERE id = 'YOUR_TENANT_ID_HERE';

-- Or if you only have one tenant, use this:
UPDATE tenants 
SET whatsapp_number = '919920047759' 
WHERE id = (SELECT id FROM tenants ORDER BY created_at LIMIT 1);

-- Verify the update
-- SELECT id, name, whatsapp_number FROM tenants WHERE whatsapp_number IS NOT NULL;
