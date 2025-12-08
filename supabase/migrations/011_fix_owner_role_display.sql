-- Fix existing salon owners to show correct role
-- This ONLY updates existing data, does not modify the onboarding function

-- Update existing staff records for owners
-- Set their role_label to 'Admin/Owner' if they are the tenant owner
UPDATE public.staff s
SET role_label = 'Admin/Owner'
FROM public.tenant_users tu
WHERE s.tenant_id = tu.tenant_id
  AND s.user_id = tu.user_id
  AND tu.role = 'OWNER'
  AND (s.role_label IS NULL OR s.role_label = 'Staff' OR s.role_label = 'Owner');
