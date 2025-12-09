-- Diagnostic script to check WhatsApp setup
-- Run this in your Supabase SQL Editor

-- 1. Check if whatsapp_number column exists in tenants table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tenants' 
  AND column_name IN ('whatsapp_number', 'phone');

-- 2. Check all tenants and their phone numbers
SELECT 
    id,
    name,
    slug,
    phone,
    whatsapp_number,
    created_at
FROM tenants
ORDER BY created_at DESC;

-- 3. Check the exact format of phone numbers in the database
SELECT 
    id,
    name,
    CASE 
        WHEN whatsapp_number IS NULL THEN '❌ NULL'
        WHEN whatsapp_number = '' THEN '❌ EMPTY STRING'
        ELSE whatsapp_number
    END as whatsapp_number_status,
    CASE 
        WHEN phone IS NULL THEN '❌ NULL'
        WHEN phone = '' THEN '❌ EMPTY STRING'
        ELSE phone
    END as phone_status,
    length(whatsapp_number) as whatsapp_length,
    length(phone) as phone_length
FROM tenants;

-- 4. Test various phone number formats
-- Replace 919920047759 with your actual WhatsApp number if different
SELECT 
    id,
    name,
    whatsapp_number,
    phone
FROM tenants
WHERE 
    whatsapp_number IN ('919920047759', '+919920047759', '9920047759')
    OR phone IN ('919920047759', '+919920047759', '9920047759');

-- 5. Check if the column has any special characters or spaces
SELECT 
    id,
    name,
    whatsapp_number,
    regexp_replace(whatsapp_number, '\D', '', 'g') as cleaned_whatsapp,
    phone,
    regexp_replace(phone, '\D', '', 'g') as cleaned_phone
FROM tenants
WHERE whatsapp_number IS NOT NULL OR phone IS NOT NULL;

-- 6. If you need to update your tenant's WhatsApp number, use this:
-- First, see your tenant ID:
SELECT id, name, owner_user_id FROM tenants;

-- Then update (replace YOUR_TENANT_ID_HERE with actual ID from above):
-- UPDATE tenants 
-- SET whatsapp_number = '919920047759', phone = '919920047759'
-- WHERE id = 'YOUR_TENANT_ID_HERE';

-- 7. Verify the update worked:
SELECT id, name, whatsapp_number, phone FROM tenants;
