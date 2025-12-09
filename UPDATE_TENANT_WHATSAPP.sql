-- Step 1: First, find your tenant ID
SELECT id, name, slug FROM tenants;

-- Step 2: Copy your tenant ID from above and update the WhatsApp number
-- Replace 'YOUR_TENANT_ID_HERE' with the actual UUID from step 1
UPDATE tenants 
SET whatsapp_number = '919920047759' 
WHERE id = 'YOUR_TENANT_ID_HERE';

-- Step 3: Verify the update
SELECT id, name, whatsapp_number FROM tenants;

-- If you have multiple tenants and want to update all of them:
-- UPDATE tenants SET whatsapp_number = '919920047759' WHERE owner_user_id = (SELECT id FROM auth.users WHERE email = 'your-email@example.com');
