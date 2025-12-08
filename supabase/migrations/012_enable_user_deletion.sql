-- Fix: Enable deletion of users from auth.users
-- Problem: tenants.owner_user_id has FK to auth.users WITHOUT cascade
-- This blocks user deletion when user is a tenant owner

-- Drop the existing foreign key constraint
ALTER TABLE public.tenants 
DROP CONSTRAINT IF EXISTS tenants_owner_user_id_fkey;

-- Add it back with ON DELETE SET NULL
-- When a user is deleted, their owned tenants won't be deleted
-- but the owner_user_id will be set to NULL
ALTER TABLE public.tenants 
ADD CONSTRAINT tenants_owner_user_id_fkey 
FOREIGN KEY (owner_user_id) 
REFERENCES auth.users(id) 
ON DELETE SET NULL;

-- Now user deletion will work because:
-- 1. profiles.id → CASCADE deletes profile
-- 2. tenant_users.user_id → CASCADE removes from all tenants
-- 3. staff.user_id → CASCADE deletes staff records
-- 4. tenants.owner_user_id → SET NULL (tenant remains, just unowned)

-- Note: If you want to delete the tenant when owner is deleted, use CASCADE instead:
-- ALTER TABLE public.tenants DROP CONSTRAINT IF EXISTS tenants_owner_user_id_fkey;
-- ALTER TABLE public.tenants ADD CONSTRAINT tenants_owner_user_id_fkey 
-- FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
