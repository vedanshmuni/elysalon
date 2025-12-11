-- Quick Fix: Run this SQL in Supabase SQL Editor
-- This adds RLS policies to the staff table so staff can view their own records

-- First, check if RLS is already enabled (this will show 't' if enabled)
-- SELECT relrowsecurity FROM pg_class WHERE relname = 'staff';

-- Enable RLS
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies first (in case they exist)
DROP POLICY IF EXISTS "Users can view staff in their tenant" ON staff;
DROP POLICY IF EXISTS "Managers can insert staff in their tenant" ON staff;
DROP POLICY IF EXISTS "Managers can update staff in their tenant" ON staff;
DROP POLICY IF EXISTS "Managers can delete staff in their tenant" ON staff;

-- Create policies
CREATE POLICY "Users can view staff in their tenant"
  ON staff FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenant_users
      WHERE tenant_users.tenant_id = staff.tenant_id
      AND tenant_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Managers can insert staff in their tenant"
  ON staff FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_users
      WHERE tenant_users.tenant_id = staff.tenant_id
      AND tenant_users.user_id = auth.uid()
      AND tenant_users.role IN ('SUPER_ADMIN', 'OWNER', 'MANAGER')
    )
  );

CREATE POLICY "Managers can update staff in their tenant"
  ON staff FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenant_users
      WHERE tenant_users.tenant_id = staff.tenant_id
      AND tenant_users.user_id = auth.uid()
      AND tenant_users.role IN ('SUPER_ADMIN', 'OWNER', 'MANAGER')
    )
  );

CREATE POLICY "Managers can delete staff in their tenant"
  ON staff FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenant_users
      WHERE tenant_users.tenant_id = staff.tenant_id
      AND tenant_users.user_id = auth.uid()
      AND tenant_users.role IN ('SUPER_ADMIN', 'OWNER', 'MANAGER')
    )
  );
