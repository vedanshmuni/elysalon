-- Staff Attendance and Management System
-- Includes: Clock in/out, breaks, leave management, attendance tracking, performance metrics

-- =====================================================
-- ATTENDANCE TRACKING
-- =====================================================

-- Clock in/out records with break tracking
CREATE TABLE IF NOT EXISTS staff_attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  
  -- Clock in/out times
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  
  -- Geolocation (optional - for mobile clock-in verification)
  clock_in_lat DECIMAL(10, 8),
  clock_in_lng DECIMAL(11, 8),
  clock_out_lat DECIMAL(10, 8),
  clock_out_lng DECIMAL(11, 8),
  
  -- Break tracking
  total_break_minutes INTEGER DEFAULT 0,
  
  -- Notes
  notes TEXT,
  clock_in_notes TEXT,
  clock_out_notes TEXT,
  
  -- Status
  status TEXT DEFAULT 'clocked_in' CHECK (status IN ('clocked_in', 'on_break', 'clocked_out')),
  
  -- Calculated fields
  total_hours DECIMAL(5, 2),
  overtime_hours DECIMAL(5, 2) DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Break records
CREATE TABLE IF NOT EXISTS staff_breaks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attendance_id UUID NOT NULL REFERENCES staff_attendance(id) ON DELETE CASCADE,
  
  break_start TIMESTAMPTZ NOT NULL,
  break_end TIMESTAMPTZ,
  break_minutes INTEGER,
  break_type TEXT DEFAULT 'regular' CHECK (break_type IN ('regular', 'lunch', 'emergency')),
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- LEAVE MANAGEMENT
-- =====================================================

-- Leave types configuration
CREATE TABLE IF NOT EXISTS leave_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3B82F6',
  
  -- Allowances
  days_per_year INTEGER DEFAULT 0,
  requires_approval BOOLEAN DEFAULT TRUE,
  paid BOOLEAN DEFAULT TRUE,
  
  -- Restrictions
  min_notice_days INTEGER DEFAULT 0,
  max_consecutive_days INTEGER,
  can_carry_forward BOOLEAN DEFAULT FALSE,
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, name)
);

-- Staff leave requests
CREATE TABLE IF NOT EXISTS staff_leave_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  leave_type_id UUID NOT NULL REFERENCES leave_types(id) ON DELETE RESTRICT,
  
  -- Leave period
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days DECIMAL(3, 1) NOT NULL, -- Support half days
  
  -- Request details
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  
  -- Approval workflow
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leave balances per staff member
CREATE TABLE IF NOT EXISTS staff_leave_balances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  leave_type_id UUID NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  
  -- Balance tracking
  total_allocated DECIMAL(4, 1) NOT NULL DEFAULT 0,
  total_used DECIMAL(4, 1) NOT NULL DEFAULT 0,
  total_pending DECIMAL(4, 1) NOT NULL DEFAULT 0,
  total_remaining DECIMAL(4, 1) GENERATED ALWAYS AS (total_allocated - total_used - total_pending) STORED,
  
  -- Carry forward from previous year
  carried_forward DECIMAL(4, 1) DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(staff_id, leave_type_id, year)
);

-- =====================================================
-- PERFORMANCE & METRICS
-- =====================================================

-- Staff performance records
CREATE TABLE IF NOT EXISTS staff_performance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  
  -- Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Metrics
  total_services_completed INTEGER DEFAULT 0,
  total_revenue DECIMAL(10, 2) DEFAULT 0,
  average_service_rating DECIMAL(3, 2),
  client_rebooking_rate DECIMAL(5, 2), -- Percentage
  
  -- Attendance metrics
  days_worked INTEGER DEFAULT 0,
  days_absent INTEGER DEFAULT 0,
  days_late INTEGER DEFAULT 0,
  total_hours_worked DECIMAL(6, 2) DEFAULT 0,
  
  -- Performance rating
  overall_rating INTEGER CHECK (overall_rating BETWEEN 1 AND 5),
  rating_notes TEXT,
  rated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDICES
-- =====================================================

CREATE INDEX idx_staff_attendance_staff ON staff_attendance(staff_id, clock_in DESC);
CREATE INDEX idx_staff_attendance_tenant ON staff_attendance(tenant_id, clock_in DESC);
CREATE INDEX idx_staff_attendance_date ON staff_attendance(tenant_id, DATE(clock_in));
CREATE INDEX idx_staff_attendance_status ON staff_attendance(status) WHERE status != 'clocked_out';

CREATE INDEX idx_staff_breaks_attendance ON staff_breaks(attendance_id);

CREATE INDEX idx_leave_requests_staff ON staff_leave_requests(staff_id, start_date DESC);
CREATE INDEX idx_leave_requests_status ON staff_leave_requests(tenant_id, status);
CREATE INDEX idx_leave_requests_dates ON staff_leave_requests(tenant_id, start_date, end_date);

CREATE INDEX idx_leave_balances_staff ON staff_leave_balances(staff_id, year DESC);

CREATE INDEX idx_staff_performance_staff ON staff_performance(staff_id, period_start DESC);
CREATE INDEX idx_staff_performance_tenant ON staff_performance(tenant_id, period_start DESC);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to calculate total hours worked
CREATE OR REPLACE FUNCTION calculate_attendance_hours()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.clock_out IS NOT NULL THEN
    NEW.total_hours := EXTRACT(EPOCH FROM (NEW.clock_out - NEW.clock_in)) / 3600.0 - (NEW.total_break_minutes / 60.0);
    
    -- Calculate overtime (assuming 8 hour standard day)
    IF NEW.total_hours > 8 THEN
      NEW.overtime_hours := NEW.total_hours - 8;
    END IF;
  END IF;
  
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_attendance_hours
BEFORE UPDATE ON staff_attendance
FOR EACH ROW
WHEN (NEW.clock_out IS NOT NULL AND OLD.clock_out IS NULL)
EXECUTE FUNCTION calculate_attendance_hours();

-- Function to update break total when break ends
CREATE OR REPLACE FUNCTION update_break_total()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.break_end IS NOT NULL AND OLD.break_end IS NULL THEN
    NEW.break_minutes := EXTRACT(EPOCH FROM (NEW.break_end - NEW.break_start)) / 60.0;
    
    -- Update attendance record
    UPDATE staff_attendance
    SET total_break_minutes = total_break_minutes + NEW.break_minutes
    WHERE id = NEW.attendance_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_break_total
BEFORE UPDATE ON staff_breaks
FOR EACH ROW
EXECUTE FUNCTION update_break_total();

-- Function to update leave balances when request is approved
CREATE OR REPLACE FUNCTION update_leave_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    -- Add to used balance
    UPDATE staff_leave_balances
    SET 
      total_used = total_used + NEW.total_days,
      total_pending = GREATEST(0, total_pending - NEW.total_days),
      updated_at = NOW()
    WHERE 
      staff_id = NEW.staff_id 
      AND leave_type_id = NEW.leave_type_id
      AND year = EXTRACT(YEAR FROM NEW.start_date);
  ELSIF NEW.status = 'pending' AND OLD.status != 'pending' THEN
    -- Add to pending balance
    UPDATE staff_leave_balances
    SET 
      total_pending = total_pending + NEW.total_days,
      updated_at = NOW()
    WHERE 
      staff_id = NEW.staff_id 
      AND leave_type_id = NEW.leave_type_id
      AND year = EXTRACT(YEAR FROM NEW.start_date);
  ELSIF NEW.status IN ('rejected', 'cancelled') AND OLD.status = 'pending' THEN
    -- Remove from pending
    UPDATE staff_leave_balances
    SET 
      total_pending = GREATEST(0, total_pending - NEW.total_days),
      updated_at = NOW()
    WHERE 
      staff_id = NEW.staff_id 
      AND leave_type_id = NEW.leave_type_id
      AND year = EXTRACT(YEAR FROM NEW.start_date);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_leave_balance
AFTER UPDATE ON staff_leave_requests
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION update_leave_balance();

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE staff_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_performance ENABLE ROW LEVEL SECURITY;

-- Staff Attendance Policies
CREATE POLICY "Users can view attendance for their tenant"
  ON staff_attendance FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT get_user_tenants()));

CREATE POLICY "Users can insert attendance for their tenant"
  ON staff_attendance FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id IN (SELECT get_user_tenants()));

CREATE POLICY "Users can update attendance for their tenant"
  ON staff_attendance FOR UPDATE
  TO authenticated
  USING (tenant_id IN (SELECT get_user_tenants()));

-- Staff Breaks Policies
CREATE POLICY "Users can manage breaks for their tenant"
  ON staff_breaks FOR ALL
  TO authenticated
  USING (attendance_id IN (
    SELECT id FROM staff_attendance WHERE tenant_id IN (SELECT get_user_tenants())
  ));

-- Leave Types Policies
CREATE POLICY "Users can view leave types for their tenant"
  ON leave_types FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT get_user_tenants()));

CREATE POLICY "Users can manage leave types for their tenant"
  ON leave_types FOR ALL
  TO authenticated
  USING (tenant_id IN (SELECT get_user_tenants()));

-- Leave Requests Policies
CREATE POLICY "Users can view leave requests for their tenant"
  ON staff_leave_requests FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT get_user_tenants()));

CREATE POLICY "Staff can create own leave requests"
  ON staff_leave_requests FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id IN (SELECT get_user_tenants()));

CREATE POLICY "Users can update leave requests for their tenant"
  ON staff_leave_requests FOR UPDATE
  TO authenticated
  USING (tenant_id IN (SELECT get_user_tenants()));

-- Leave Balances Policies
CREATE POLICY "Users can view leave balances for their tenant"
  ON staff_leave_balances FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT get_user_tenants()));

CREATE POLICY "Users can manage leave balances for their tenant"
  ON staff_leave_balances FOR ALL
  TO authenticated
  USING (tenant_id IN (SELECT get_user_tenants()));

-- Performance Policies
CREATE POLICY "Users can view performance for their tenant"
  ON staff_performance FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT get_user_tenants()));

CREATE POLICY "Managers can manage performance for their tenant"
  ON staff_performance FOR ALL
  TO authenticated
  USING (tenant_id IN (SELECT get_user_tenants()));

-- =====================================================
-- SEED DEFAULT LEAVE TYPES
-- =====================================================

-- This will be populated by the application when a tenant is created
-- Examples: Sick Leave, Casual Leave, Vacation, Maternity, Paternity, etc.
