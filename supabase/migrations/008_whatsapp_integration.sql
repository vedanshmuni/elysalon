-- Add WhatsApp number to tenants table
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;

-- Add index for faster WhatsApp number lookups
CREATE INDEX IF NOT EXISTS idx_tenants_whatsapp_number 
ON tenants(whatsapp_number) WHERE whatsapp_number IS NOT NULL;

-- Update your tenant with the WhatsApp number (update this with your actual tenant ID if different)
-- To find your tenant_id, run: SELECT id, name FROM tenants;
-- Then update with: UPDATE tenants SET whatsapp_number = '919920047759' WHERE id = 'your-tenant-id';
COMMENT ON COLUMN tenants.whatsapp_number IS 'Business WhatsApp number in format: country_code + phone (e.g., 919920047759)';

-- Create booking_requests table for WhatsApp booking requests
CREATE TABLE IF NOT EXISTS public.booking_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id),
    phone_number TEXT NOT NULL,
    message TEXT,
    parsed_service TEXT,
    parsed_date DATE,
    parsed_time TIME,
    status TEXT DEFAULT 'PENDING', -- PENDING, ACCEPTED, DECLINED, CONVERTED
    source TEXT DEFAULT 'WHATSAPP', -- WHATSAPP, WEB, PHONE
    booking_id UUID REFERENCES public.bookings(id),
    notes TEXT,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    responded_by_user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_booking_requests_tenant_status 
ON booking_requests(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_booking_requests_phone 
ON booking_requests(phone_number);

-- Enable RLS
ALTER TABLE booking_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view booking requests from their tenant" ON booking_requests;
DROP POLICY IF EXISTS "Users can insert booking requests" ON booking_requests;
DROP POLICY IF EXISTS "Users can update booking requests from their tenant" ON booking_requests;

-- RLS Policy for booking_requests
CREATE POLICY "Users can view booking requests from their tenant"
ON booking_requests FOR SELECT
USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can insert booking requests"
ON booking_requests FOR INSERT
WITH CHECK (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can update booking requests from their tenant"
ON booking_requests FOR UPDATE
USING (user_belongs_to_tenant(tenant_id));

-- Add reminder_sent flag to bookings table
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

-- Add invoice_sent_via_whatsapp flag to invoices table
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS invoice_sent_via_whatsapp BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS invoice_sent_at TIMESTAMPTZ;

-- Create broadcasts table for marketing/offers
CREATE TABLE IF NOT EXISTS public.broadcasts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    broadcast_type TEXT DEFAULT 'marketing', -- marketing, event, announcement, offer
    target_type TEXT DEFAULT 'all', -- all, active, inactive, selected, consent_whatsapp
    image_url TEXT,
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    status TEXT DEFAULT 'PENDING', -- PENDING, SENDING, COMPLETED, FAILED, CANCELLED
    target_count INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create broadcast_recipients table for tracking individual sends
CREATE TABLE IF NOT EXISTS public.broadcast_recipients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    broadcast_id UUID NOT NULL REFERENCES public.broadcasts(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING', -- PENDING, SENT, FAILED
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    whatsapp_message_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for broadcasts
CREATE INDEX IF NOT EXISTS idx_broadcasts_tenant_status 
ON broadcasts(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_broadcasts_created_at 
ON broadcasts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_broadcast 
ON broadcast_recipients(broadcast_id);

CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_client 
ON broadcast_recipients(client_id);

-- Enable RLS
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_recipients ENABLE ROW LEVEL SECURITY;

-- RLS Policies for broadcasts
DROP POLICY IF EXISTS "Users can view broadcasts from their tenant" ON broadcasts;
DROP POLICY IF EXISTS "Users can insert broadcasts to their tenant" ON broadcasts;
DROP POLICY IF EXISTS "Users can update broadcasts from their tenant" ON broadcasts;
DROP POLICY IF EXISTS "Users can delete broadcasts from their tenant" ON broadcasts;

CREATE POLICY "Users can view broadcasts from their tenant"
ON broadcasts FOR SELECT
USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can insert broadcasts to their tenant"
ON broadcasts FOR INSERT
WITH CHECK (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can update broadcasts from their tenant"
ON broadcasts FOR UPDATE
USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can delete broadcasts from their tenant"
ON broadcasts FOR DELETE
USING (user_belongs_to_tenant(tenant_id));

-- RLS Policies for broadcast_recipients
DROP POLICY IF EXISTS "Users can view broadcast recipients from their tenant" ON broadcast_recipients;
DROP POLICY IF EXISTS "Users can insert broadcast recipients" ON broadcast_recipients;
DROP POLICY IF EXISTS "Users can update broadcast recipients from their tenant" ON broadcast_recipients;

CREATE POLICY "Users can view broadcast recipients from their tenant"
ON broadcast_recipients FOR SELECT
USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can insert broadcast recipients"
ON broadcast_recipients FOR INSERT
WITH CHECK (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can update broadcast recipients from their tenant"
ON broadcast_recipients FOR UPDATE
USING (user_belongs_to_tenant(tenant_id));
