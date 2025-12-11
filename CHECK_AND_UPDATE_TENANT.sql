-- Check current tenant data
SELECT id, name, phone, slug, created_at 
FROM tenants 
ORDER BY created_at;

-- Update tenant name (replace YOUR_TENANT_ID and NEW_SALON_NAME)
-- Example:
-- UPDATE tenants 
-- SET name = 'New Salon Name',
--     phone = '+919876543210',
--     updated_at = NOW()
-- WHERE id = 'YOUR_TENANT_ID_HERE';

-- After running above, verify the change:
-- SELECT id, name, phone FROM tenants WHERE id = 'YOUR_TENANT_ID_HERE';
