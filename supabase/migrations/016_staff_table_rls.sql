-- Migration: Add RLS policies for staff table
-- This allows staff members to view their own records and managers to view all staff

-- Enable RLS on staff table
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view staff records in their tenant
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

-- Policy: Managers can insert staff in their tenant
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

-- Policy: Managers can update staff in their tenant
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

-- Policy: Managers can delete staff in their tenant
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
