# Staff Attendance & Management System

## Overview

A comprehensive staff attendance tracking and leave management system inspired by leading salon management platforms like Square, Vagaro, and Zenoti.

## Features Implemented

### 1. **Attendance Tracking** ✅
- **Clock In/Out**: Staff can clock in and out with timestamp recording
- **Geolocation Support**: Optional GPS coordinates for mobile clock-in verification
- **Break Management**: Track breaks during work hours (regular, lunch, emergency)
- **Real-time Status**: See who's working, on break, or clocked out
- **Automatic Calculations**: 
  - Total hours worked
  - Break time deductions
  - Overtime hours (over 8 hours/day)

### 2. **Leave Management** ✅
- **Leave Types Configuration**: Create custom leave types (Sick, Casual, Vacation, etc.)
  - Days per year allocation
  - Paid/unpaid designation
  - Approval requirements
  - Minimum notice period
  - Carry-forward rules
- **Leave Requests**: Staff can request leave with reason
- **Approval Workflow**: Managers approve/reject with notes
- **Leave Balances**: Automatic tracking of allocated, used, pending, and remaining days
- **Calendar Integration**: Leave blocks calendar availability

### 3. **Performance Metrics** ✅
- Track per staff member:
  - Total services completed
  - Revenue generated
  - Average service rating
  - Client rebooking rate
  - Attendance metrics (days worked, absent, late)
  - Total hours worked
  - Performance ratings by managers

### 4. **Dashboard & Reports** ✅
- Real-time attendance dashboard
- Today's attendance overview
- Staff status at-a-glance
- Pending leave request alerts
- Comprehensive reporting capabilities

## Database Schema

### Tables Created

#### `staff_attendance`
```sql
- id (UUID)
- tenant_id (UUID)
- staff_id (UUID)
- branch_id (UUID)
- clock_in (TIMESTAMPTZ)
- clock_out (TIMESTAMPTZ)
- clock_in_lat/lng (DECIMAL) - GPS coordinates
- clock_out_lat/lng (DECIMAL)
- total_break_minutes (INTEGER)
- notes, clock_in_notes, clock_out_notes (TEXT)
- status (clocked_in | on_break | clocked_out)
- total_hours (DECIMAL)
- overtime_hours (DECIMAL)
```

#### `staff_breaks`
```sql
- id (UUID)
- attendance_id (UUID)
- break_start (TIMESTAMPTZ)
- break_end (TIMESTAMPTZ)
- break_minutes (INTEGER)
- break_type (regular | lunch | emergency)
- notes (TEXT)
```

#### `leave_types`
```sql
- id (UUID)
- tenant_id (UUID)
- name (TEXT)
- description (TEXT)
- color (TEXT)
- days_per_year (INTEGER)
- requires_approval (BOOLEAN)
- paid (BOOLEAN)
- min_notice_days (INTEGER)
- max_consecutive_days (INTEGER)
- can_carry_forward (BOOLEAN)
- is_active (BOOLEAN)
```

#### `staff_leave_requests`
```sql
- id (UUID)
- tenant_id (UUID)
- staff_id (UUID)
- leave_type_id (UUID)
- start_date (DATE)
- end_date (DATE)
- total_days (DECIMAL) - supports half days
- reason (TEXT)
- status (pending | approved | rejected | cancelled)
- requested_at (TIMESTAMPTZ)
- reviewed_by (UUID)
- reviewed_at (TIMESTAMPTZ)
- review_notes (TEXT)
```

#### `staff_leave_balances`
```sql
- id (UUID)
- tenant_id (UUID)
- staff_id (UUID)
- leave_type_id (UUID)
- year (INTEGER)
- total_allocated (DECIMAL)
- total_used (DECIMAL)
- total_pending (DECIMAL)
- total_remaining (DECIMAL) - computed
- carried_forward (DECIMAL)
```

#### `staff_performance`
```sql
- id (UUID)
- tenant_id (UUID)
- staff_id (UUID)
- period_start/end (DATE)
- total_services_completed (INTEGER)
- total_revenue (DECIMAL)
- average_service_rating (DECIMAL)
- client_rebooking_rate (DECIMAL)
- days_worked/absent/late (INTEGER)
- total_hours_worked (DECIMAL)
- overall_rating (INTEGER 1-5)
- rating_notes (TEXT)
- rated_by (UUID)
```

## API Endpoints

### `/api/attendance` (POST)

Clock in/out operations:

```typescript
// Clock In
{
  action: 'clock_in',
  staff_id: string,
  branch_id?: string,
  notes?: string,
  latitude?: number,
  longitude?: number
}

// Clock Out
{
  action: 'clock_out',
  staff_id: string,
  notes?: string,
  latitude?: number,
  longitude?: number
}

// Start Break
{
  action: 'start_break',
  staff_id: string,
  break_type?: 'regular' | 'lunch' | 'emergency',
  notes?: string
}

// End Break
{
  action: 'end_break',
  staff_id: string
}
```

### `/api/attendance` (GET)

Get current attendance status:

```typescript
GET /api/attendance?staff_id={id}
```

## Pages Created

### 1. `/dashboard/staff/attendance`
- Main attendance dashboard
- Today's attendance table
- Stats cards (total staff, clocked in, clocked out, hours)
- Pending leave request alerts
- Quick links to reports and leave requests

### 2. `/dashboard/staff/attendance/leave-requests`
- View all leave requests with filtering
- Create new leave requests
- Approve/reject workflow
- Status tracking (pending, approved, rejected, cancelled)

### 3. `/dashboard/staff/attendance/reports` (TODO)
- Attendance reports by date range
- Staff attendance summary
- Leave utilization reports
- Export capabilities

## Automated Features

### Triggers & Functions

1. **Auto-calculate hours worked**
   - Triggered on clock-out
   - Calculates: total hours, overtime, deducts break time

2. **Auto-update break totals**
   - Updates attendance record when break ends
   - Sums all break minutes

3. **Auto-update leave balances**
   - When leave approved: moves from pending to used
   - When leave rejected: removes from pending
   - When leave requested: adds to pending

## Usage Guide

### For Managers

1. **View Daily Attendance**
   - Go to Staff → Attendance
   - See real-time who's working
   - Check total hours

2. **Manage Leave Requests**
   - Review pending requests
   - Approve/reject with notes
   - Track leave balances

3. **Setup Leave Types**
   - Define annual leave allowances
   - Set approval requirements
   - Configure carry-forward rules

### For Staff (Future Enhancement)

1. **Self Clock-In/Out** (mobile app)
   - Clock in when arriving
   - Take breaks as needed
   - Clock out when leaving

2. **Request Leave**
   - Select leave type
   - Choose dates
   - Provide reason
   - Track status

## Integration Points

### Current Integrations
- ✅ Staff table (existing)
- ✅ Branches table (location tracking)
- ✅ Profiles (approval workflow)

### Future Integrations
- 🔄 Calendar system (block staff availability during leave)
- 🔄 Payroll system (hours worked → wages)
- 🔄 Shift scheduling (auto-schedule based on attendance patterns)
- 🔄 WhatsApp notifications (leave approval/rejection)
- 🔄 Mobile app (staff self-service)

## Competitor Feature Comparison

| Feature | Square | Vagaro | Zenoti | Our System |
|---------|--------|--------|--------|------------|
| Clock In/Out | ✅ | ✅ | ✅ | ✅ |
| Break Tracking | ✅ | ❌ | ✅ | ✅ |
| GPS Verification | ✅ | ❌ | ✅ | ✅ |
| Leave Management | ✅ | ✅ | ✅ | ✅ |
| Leave Approval Workflow | ✅ | ✅ | ✅ | ✅ |
| Leave Balance Tracking | ✅ | ✅ | ✅ | ✅ |
| Performance Metrics | ✅ | ✅ | ✅ | ✅ |
| Overtime Calculation | ✅ | ❌ | ✅ | ✅ |
| Mobile App | ✅ | ✅ | ✅ | 🔄 |

## Next Steps / Roadmap

### Phase 2 - Enhanced Features
- [ ] Mobile app for staff self-service
- [ ] Shift templates and recurring schedules
- [ ] Attendance vs. scheduled shift comparison
- [ ] Late arrival tracking and alerts
- [ ] Geofencing for clock-in restrictions
- [ ] Facial recognition for clock-in
- [ ] Integration with calendar for availability
- [ ] WhatsApp notifications for leave updates
- [ ] Export reports to PDF/Excel
- [ ] Payroll integration

### Phase 3 - Advanced Analytics
- [ ] Attendance patterns analysis
- [ ] Staff productivity metrics
- [ ] Predictive scheduling (AI-based)
- [ ] No-show predictions
- [ ] Labor cost optimization
- [ ] Compliance tracking (labor laws)

## Configuration

### Initial Setup

1. **Run Migration**
```bash
# Apply the migration
supabase db push
```

2. **Create Default Leave Types**
```sql
INSERT INTO leave_types (tenant_id, name, days_per_year, paid) VALUES
  ('{tenant_id}', 'Casual Leave', 12, true),
  ('{tenant_id}', 'Sick Leave', 12, true),
  ('{tenant_id}', 'Vacation', 15, true),
  ('{tenant_id}', 'Maternity Leave', 180, true),
  ('{tenant_id}', 'Paternity Leave', 15, true);
```

3. **Initialize Staff Leave Balances**
```sql
-- For each staff member and leave type
INSERT INTO staff_leave_balances (tenant_id, staff_id, leave_type_id, year, total_allocated)
SELECT 
  s.tenant_id,
  s.id,
  lt.id,
  EXTRACT(YEAR FROM CURRENT_DATE),
  lt.days_per_year
FROM staff s
CROSS JOIN leave_types lt
WHERE s.tenant_id = lt.tenant_id AND s.is_active = true;
```

## Best Practices

1. **Clock In/Out**
   - Ensure staff clock out daily
   - Review unclosed shifts weekly
   - Address discrepancies promptly

2. **Leave Management**
   - Set minimum notice periods
   - Review and respond to requests within 24-48 hours
   - Maintain adequate staffing levels

3. **Performance Tracking**
   - Conduct quarterly performance reviews
   - Use data for fair compensation
   - Recognize high performers

## Security & Privacy

- All attendance data is tenant-isolated (RLS policies)
- GPS coordinates are optional and encrypted
- Only managers can approve leave
- Staff can only view their own attendance
- Audit trail for all changes

## Support

For issues or feature requests, contact the development team or create an issue in the repository.

---

**Last Updated**: December 10, 2025
**Version**: 1.0.0
