-- Add WhatsApp number to tenants table
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;

-- Add index for faster WhatsApp number lookups
CREATE INDEX IF NOT EXISTS idx_tenants_whatsapp_number 
ON tenants(whatsapp_number) WHERE whatsapp_number IS NOT NULL;

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
