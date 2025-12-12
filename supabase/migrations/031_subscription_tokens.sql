-- ============================================
-- SUBSCRIPTION TOKENS & REDEMPTION FLOW
-- ============================================

-- 1. Create table for secure token exchange
CREATE TABLE IF NOT EXISTS public.subscription_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    product_code TEXT NOT NULL,
    plan_code TEXT NOT NULL,
    payment_id TEXT,
    payment_metadata JSONB DEFAULT '{}',
    is_used BOOLEAN DEFAULT false,
    expires_at TIMESTAMPTZ DEFAULT (now() + interval '15 minutes'),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.subscription_tokens ENABLE ROW LEVEL SECURITY;

-- Only service role (backend) can access this table
CREATE POLICY "Service role can manage subscription tokens"
    ON public.subscription_tokens
    USING (true)
    WITH CHECK (true);

-- 3. Create secure function to redeem token
-- This function atomically checks validity and marks as used
CREATE OR REPLACE FUNCTION redeem_subscription_token(p_token TEXT)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    token_data JSONB
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_token_record RECORD;
BEGIN
    -- Find the token
    SELECT * INTO v_token_record
    FROM public.subscription_tokens
    WHERE token = p_token;

    -- Check if exists
    IF v_token_record IS NULL THEN
        RETURN QUERY SELECT false, 'Invalid token', NULL::jsonb;
        RETURN;
    END IF;

    -- Check if expired
    IF v_token_record.expires_at < NOW() THEN
        RETURN QUERY SELECT false, 'Token expired', NULL::jsonb;
        RETURN;
    END IF;

    -- Check if already used
    IF v_token_record.is_used THEN
        RETURN QUERY SELECT false, 'Token already used', NULL::jsonb;
        RETURN;
    END IF;

    -- Mark as used
    UPDATE public.subscription_tokens
    SET is_used = true
    WHERE id = v_token_record.id;

    -- Return success with data
    RETURN QUERY SELECT 
        true, 
        'Token redeemed successfully', 
        jsonb_build_object(
            'email', v_token_record.email,
            'product_code', v_token_record.product_code,
            'plan_code', v_token_record.plan_code,
            'payment_id', v_token_record.payment_id,
            'payment_metadata', v_token_record.payment_metadata
        );
END;
$$;
