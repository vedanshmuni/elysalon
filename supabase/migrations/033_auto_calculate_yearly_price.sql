-- Migration: Auto-calculate yearly price based on monthly price and discount
-- Description: Adds a discount percentage column and a trigger to automatically update yearly prices.

-- 1. Add the discount percentage column
ALTER TABLE public.plans 
ADD COLUMN IF NOT EXISTS yearly_discount_percent DECIMAL(5,2) DEFAULT 15.00;

-- 2. Create the trigger function
CREATE OR REPLACE FUNCTION public.calculate_yearly_price()
RETURNS TRIGGER AS $$
BEGIN
    -- Only calculate if monthly_price or discount changes
    -- Formula: (Monthly * 12) * (1 - Discount/100)
    -- We round to 2 decimal places
    
    -- If yearly_discount_percent is NULL, default to 0 (no discount)
    IF NEW.yearly_discount_percent IS NULL THEN
        NEW.yearly_discount_percent := 0;
    END IF;

    NEW.yearly_price_in_inr := ROUND(
        (NEW.monthly_price_in_inr * 12) * (1 - (NEW.yearly_discount_percent / 100.0)), 
        2
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create the trigger
DROP TRIGGER IF EXISTS trigger_calculate_yearly_price ON public.plans;

CREATE TRIGGER trigger_calculate_yearly_price
BEFORE INSERT OR UPDATE OF monthly_price_in_inr, yearly_discount_percent
ON public.plans
FOR EACH ROW
EXECUTE FUNCTION public.calculate_yearly_price();

-- 4. Update existing plans to ensure consistency (Optional, but good for sync)
-- This will trigger the calculation for all existing rows using the default 15% or existing values
UPDATE public.plans SET yearly_discount_percent = 15.00 WHERE yearly_discount_percent IS NULL;
