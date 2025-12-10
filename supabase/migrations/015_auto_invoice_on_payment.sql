-- Migration: Auto-send invoice via WhatsApp when payment is recorded

-- Create WhatsApp send queue table
CREATE TABLE IF NOT EXISTS public.whatsapp_send_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    message_type TEXT NOT NULL, -- 'INVOICE', 'REMINDER', 'CONFIRMATION'
    reference_id UUID, -- invoice_id for INVOICE type
    reference_type TEXT,
    status TEXT DEFAULT 'PENDING', -- 'PENDING', 'SENT', 'FAILED'
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ
);

-- Create function to queue invoice WhatsApp send when payment is created
CREATE OR REPLACE FUNCTION queue_invoice_whatsapp_on_payment()
RETURNS TRIGGER AS $$
DECLARE
    v_client_phone TEXT;
BEGIN
    -- Get client phone number from invoice
    SELECT c.phone INTO v_client_phone
    FROM invoices i
    LEFT JOIN clients c ON c.id = i.client_id
    WHERE i.id = NEW.invoice_id;
    
    -- If client has phone, queue WhatsApp send
    IF v_client_phone IS NOT NULL THEN
        INSERT INTO whatsapp_send_queue (
            tenant_id,
            phone_number,
            message_type,
            reference_id,
            reference_type,
            status
        ) VALUES (
            NEW.tenant_id,
            v_client_phone,
            'INVOICE',
            NEW.invoice_id,
            'INVOICE',
            'PENDING'
        );
        
        -- Update invoice paid_at timestamp
        UPDATE invoices 
        SET paid_at = NOW(),
            status = 'PAID'
        WHERE id = NEW.invoice_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on payments table
DROP TRIGGER IF EXISTS trigger_queue_invoice_whatsapp ON public.payments;
CREATE TRIGGER trigger_queue_invoice_whatsapp
    AFTER INSERT ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION queue_invoice_whatsapp_on_payment();

-- Create index on queue
CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_status ON public.whatsapp_send_queue(status, created_at);

-- Grant permissions
GRANT ALL ON public.whatsapp_send_queue TO authenticated;
