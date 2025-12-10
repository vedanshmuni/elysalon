-- Migration: Update invoice status when payment is recorded

-- Create function to update invoice status when payment is created
CREATE OR REPLACE FUNCTION update_invoice_on_payment()
RETURNS TRIGGER AS $$
BEGIN
    -- Update invoice paid_at timestamp and status
    UPDATE invoices 
    SET paid_at = NOW(),
        status = 'PAID'
    WHERE id = NEW.invoice_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on payments table
DROP TRIGGER IF EXISTS trigger_update_invoice_on_payment ON public.payments;
CREATE TRIGGER trigger_update_invoice_on_payment
    AFTER INSERT ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION update_invoice_on_payment();
