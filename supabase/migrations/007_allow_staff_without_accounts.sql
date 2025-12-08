-- Migration: Allow staff without user accounts
-- This enables adding staff members who don't have login credentials yet

-- Make user_id nullable in staff table
ALTER TABLE public.staff 
ALTER COLUMN user_id DROP NOT NULL;

-- Drop the unique constraint on (tenant_id, user_id) since user_id can be null
ALTER TABLE public.staff 
DROP CONSTRAINT IF EXISTS staff_tenant_id_user_id_key;

-- Add a unique constraint that only applies when user_id is not null
-- This allows multiple staff with null user_id but prevents duplicate user_id entries
CREATE UNIQUE INDEX staff_tenant_user_unique 
ON public.staff (tenant_id, user_id) 
WHERE user_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.staff.user_id IS 'User account ID - can be null for staff without login access';
