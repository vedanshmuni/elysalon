-- Migration: Enhanced booking features for calendar system
-- Adds support for: recurring appointments, breaks, resources, notifications, preferences

-- Add new columns to bookings table
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS color_code TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN DEFAULT false;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS allow_overlap BOOLEAN DEFAULT false;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS is_confirmed BOOLEAN DEFAULT false;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS confirmation_method TEXT; -- 'sms', 'email', 'two_way_text'
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS sms_reminder_sent BOOLEAN DEFAULT false;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS email_reminder_sent BOOLEAN DEFAULT false;

-- Add recurring appointment support
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS recurrence_rule TEXT; -- RRULE format
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS recurrence_end_date DATE;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS parent_booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE;

-- Add service timing details
ALTER TABLE public.booking_items ADD COLUMN IF NOT EXISTS prep_time_minutes INTEGER DEFAULT 0;
ALTER TABLE public.booking_items ADD COLUMN IF NOT EXISTS cleanup_time_minutes INTEGER DEFAULT 0;
ALTER TABLE public.booking_items ADD COLUMN IF NOT EXISTS curing_time_minutes INTEGER DEFAULT 0;

-- Create staff breaks/blocks table
CREATE TABLE IF NOT EXISTS public.staff_breaks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
    break_start TIMESTAMPTZ NOT NULL,
    break_end TIMESTAMPTZ NOT NULL,
    break_type TEXT DEFAULT 'break', -- 'break', 'block', 'leave'
    reason TEXT,
    is_recurring BOOLEAN DEFAULT false,
    recurrence_rule TEXT,
    recurrence_end_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create resources table
CREATE TABLE IF NOT EXISTS public.resources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    resource_type TEXT NOT NULL, -- 'room', 'equipment', 'chair', 'bed'
    is_shared BOOLEAN DEFAULT true,
    capacity INTEGER DEFAULT 1,
    branch_id UUID REFERENCES public.branches(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link resources to bookings
CREATE TABLE IF NOT EXISTS public.booking_resources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(booking_id, resource_id)
);

-- Add staff preferences
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS preferred_by_clients UUID[] DEFAULT '{}';
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS color_code TEXT;

-- Add client preferences
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS preferred_staff_id UUID REFERENCES public.staff(id);
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS preferred_time_of_day TEXT; -- 'morning', 'afternoon', 'evening'
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS reminder_preference TEXT DEFAULT 'both'; -- 'sms', 'email', 'both', 'none'

-- Add service timing defaults
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS default_prep_time INTEGER DEFAULT 0;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS default_cleanup_time INTEGER DEFAULT 0;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS default_curing_time INTEGER DEFAULT 0;

-- Create calendar settings table
CREATE TABLE IF NOT EXISTS public.calendar_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    time_slot_interval INTEGER DEFAULT 15, -- 5, 10, 15, 30, 60 minutes
    time_format TEXT DEFAULT '12h', -- '12h' or '24h'
    allow_double_booking BOOLEAN DEFAULT false,
    auto_freeze_confirmed BOOLEAN DEFAULT true,
    default_reminder_hours INTEGER DEFAULT 24,
    working_hours_start TIME DEFAULT '09:00',
    working_hours_end TIME DEFAULT '18:00',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id)
);

-- Create notification log table
CREATE TABLE IF NOT EXISTS public.notification_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
    recipient_type TEXT NOT NULL, -- 'client', 'staff'
    recipient_id UUID NOT NULL,
    notification_type TEXT NOT NULL, -- 'reminder', 'confirmation', 'cancellation', 'reschedule'
    channel TEXT NOT NULL, -- 'sms', 'email'
    status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed'
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_staff_breaks_staff_time ON public.staff_breaks(staff_id, break_start, break_end);
CREATE INDEX IF NOT EXISTS idx_bookings_recurring ON public.bookings(parent_booking_id) WHERE is_recurring = true;
CREATE INDEX IF NOT EXISTS idx_bookings_scheduled ON public.bookings(tenant_id, scheduled_start, scheduled_end);
CREATE INDEX IF NOT EXISTS idx_notification_log_booking ON public.notification_log(booking_id);
CREATE INDEX IF NOT EXISTS idx_resources_branch ON public.resources(branch_id, is_active);

-- RLS Policies
ALTER TABLE public.staff_breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

-- Staff breaks policies
DROP POLICY IF EXISTS "Users can view staff breaks" ON public.staff_breaks;
DROP POLICY IF EXISTS "Managers can manage staff breaks" ON public.staff_breaks;

CREATE POLICY "Users can view staff breaks" ON public.staff_breaks
    FOR SELECT USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Managers can manage staff breaks" ON public.staff_breaks
    FOR ALL USING (user_is_owner_or_manager(tenant_id));

-- Resources policies
DROP POLICY IF EXISTS "Users can view resources" ON public.resources;
DROP POLICY IF EXISTS "Managers can manage resources" ON public.resources;

CREATE POLICY "Users can view resources" ON public.resources
    FOR SELECT USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Managers can manage resources" ON public.resources
    FOR ALL USING (user_is_owner_or_manager(tenant_id));

-- Booking resources policies
DROP POLICY IF EXISTS "Users can view booking resources" ON public.booking_resources;
DROP POLICY IF EXISTS "Managers can manage booking resources" ON public.booking_resources;

CREATE POLICY "Users can view booking resources" ON public.booking_resources
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.bookings b
            WHERE b.id = booking_resources.booking_id
            AND user_belongs_to_tenant(b.tenant_id)
        )
    );

CREATE POLICY "Managers can manage booking resources" ON public.booking_resources
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.bookings b
            WHERE b.id = booking_resources.booking_id
            AND user_is_owner_or_manager(b.tenant_id)
        )
    );

-- Calendar settings policies
DROP POLICY IF EXISTS "Users can view calendar settings" ON public.calendar_settings;
DROP POLICY IF EXISTS "Managers can manage calendar settings" ON public.calendar_settings;

CREATE POLICY "Users can view calendar settings" ON public.calendar_settings
    FOR SELECT USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Managers can manage calendar settings" ON public.calendar_settings
    FOR ALL USING (user_is_owner_or_manager(tenant_id));

-- Notification log policies
DROP POLICY IF EXISTS "Users can view notification logs" ON public.notification_log;
DROP POLICY IF EXISTS "System can insert notification logs" ON public.notification_log;

CREATE POLICY "Users can view notification logs" ON public.notification_log
    FOR SELECT USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "System can insert notification logs" ON public.notification_log
    FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));

-- Function to check booking conflicts
CREATE OR REPLACE FUNCTION check_booking_conflict(
    p_staff_id UUID,
    p_start TIMESTAMPTZ,
    p_end TIMESTAMPTZ,
    p_booking_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.booking_items bi
        JOIN public.bookings b ON bi.booking_id = b.id
        WHERE bi.staff_id = p_staff_id
        AND b.status NOT IN ('CANCELLED', 'NO_SHOW')
        AND (p_booking_id IS NULL OR b.id != p_booking_id)
        AND (
            (p_start >= b.scheduled_start AND p_start < b.scheduled_end)
            OR (p_end > b.scheduled_start AND p_end <= b.scheduled_end)
            OR (p_start <= b.scheduled_start AND p_end >= b.scheduled_end)
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate recurring bookings
CREATE OR REPLACE FUNCTION generate_recurring_bookings(
    p_parent_booking_id UUID,
    p_occurrences INTEGER DEFAULT 10
)
RETURNS JSON AS $$
DECLARE
    v_parent RECORD;
    v_duration INTERVAL;
    v_current_date DATE;
    v_end_date DATE;
    v_new_booking_id UUID;
    v_count INTEGER := 0;
    v_booking_ids UUID[] := '{}';
BEGIN
    -- Get parent booking details
    SELECT * INTO v_parent FROM public.bookings WHERE id = p_parent_booking_id;
    
    IF v_parent IS NULL THEN
        RAISE EXCEPTION 'Parent booking not found';
    END IF;
    
    IF NOT v_parent.is_recurring THEN
        RAISE EXCEPTION 'Booking is not marked as recurring';
    END IF;
    
    v_duration := v_parent.scheduled_end - v_parent.scheduled_start;
    v_current_date := (v_parent.scheduled_start + INTERVAL '1 week')::DATE;
    v_end_date := COALESCE(v_parent.recurrence_end_date, v_current_date + INTERVAL '3 months');
    
    -- Generate weekly recurring bookings (simplified - can be extended for other patterns)
    WHILE v_current_date <= v_end_date AND v_count < p_occurrences LOOP
        -- Create new booking
        INSERT INTO public.bookings (
            tenant_id, branch_id, client_id, status, source,
            scheduled_start, scheduled_end, notes,
            is_recurring, parent_booking_id, color_code, allow_overlap
        ) VALUES (
            v_parent.tenant_id, v_parent.branch_id, v_parent.client_id,
            'PENDING', v_parent.source,
            v_current_date + (v_parent.scheduled_start::TIME),
            v_current_date + (v_parent.scheduled_start::TIME) + v_duration,
            v_parent.notes,
            true, p_parent_booking_id, v_parent.color_code, v_parent.allow_overlap
        ) RETURNING id INTO v_new_booking_id;
        
        v_booking_ids := array_append(v_booking_ids, v_new_booking_id);
        
        -- Copy booking items
        INSERT INTO public.booking_items (
            tenant_id, booking_id, service_id, staff_id,
            duration_minutes, price, prep_time_minutes, cleanup_time_minutes, curing_time_minutes
        )
        SELECT 
            tenant_id, v_new_booking_id, service_id, staff_id,
            duration_minutes, price, prep_time_minutes, cleanup_time_minutes, curing_time_minutes
        FROM public.booking_items
        WHERE booking_id = p_parent_booking_id;
        
        v_current_date := v_current_date + INTERVAL '1 week';
        v_count := v_count + 1;
    END LOOP;
    
    RETURN json_build_object(
        'success', true,
        'bookings_created', v_count,
        'booking_ids', v_booking_ids
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION check_booking_conflict TO authenticated;
GRANT EXECUTE ON FUNCTION generate_recurring_bookings TO authenticated;

-- Comments
COMMENT ON TABLE public.staff_breaks IS 'Staff breaks, blocks, and leave time';
COMMENT ON TABLE public.resources IS 'Shared resources like rooms, equipment';
COMMENT ON TABLE public.calendar_settings IS 'Per-tenant calendar configuration';
COMMENT ON TABLE public.notification_log IS 'Track all notifications sent to clients and staff';
COMMENT ON COLUMN public.bookings.color_code IS 'Calendar color for visual categorization';
COMMENT ON COLUMN public.bookings.is_frozen IS 'Prevent accidental edits to confirmed bookings';
COMMENT ON COLUMN public.bookings.allow_overlap IS 'Allow double booking for this appointment';
