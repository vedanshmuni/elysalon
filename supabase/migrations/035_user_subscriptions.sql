-- ============================================
-- USER SUBSCRIPTIONS TABLE
-- Tracks Razorpay subscription lifecycle
-- ============================================

-- 1. Create user_subscriptions table
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- User reference (linked after account creation)
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    email TEXT NOT NULL,
    
    -- Razorpay subscription details
    razorpay_subscription_id TEXT UNIQUE NOT NULL,
    razorpay_customer_id TEXT,
    
    -- Plan details
    plan_code TEXT NOT NULL,
    billing_cycle TEXT NOT NULL DEFAULT 'monthly', -- 'monthly' or 'yearly'
    product_code TEXT NOT NULL DEFAULT 'salon',
    
    -- Subscription status
    -- authenticated: subscription created, awaiting first payment
    -- active: subscription is active and paid
    -- cancelled: user cancelled, access until current_period_end
    -- halted: payment failed multiple times
    -- completed: all billing cycles completed
    -- expired: subscription period ended
    status TEXT NOT NULL DEFAULT 'authenticated',
    
    -- Current billing period
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    
    -- Last payment info
    last_payment_id TEXT,
    last_payment_amount DECIMAL(10,2),
    last_payment_at TIMESTAMPTZ,
    
    -- Cancellation
    cancelled_at TIMESTAMPTZ,
    cancel_reason TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create subscription_payments table (payment history)
CREATE TABLE IF NOT EXISTS public.subscription_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Subscription reference
    razorpay_subscription_id TEXT NOT NULL REFERENCES public.user_subscriptions(razorpay_subscription_id) ON DELETE CASCADE,
    
    -- Payment details
    razorpay_payment_id TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'INR',
    
    -- Status: captured, failed, refunded
    status TEXT NOT NULL DEFAULT 'captured',
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_email ON public.user_subscriptions(email);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON public.user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_razorpay_id ON public.user_subscriptions(razorpay_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_sub_id ON public.subscription_payments(razorpay_subscription_id);

-- 4. Enable RLS
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for user_subscriptions

-- Users can view their own subscriptions
CREATE POLICY "Users can view own subscriptions"
    ON public.user_subscriptions FOR SELECT
    USING (auth.uid() = user_id);

-- Service role can manage all subscriptions (for webhooks)
CREATE POLICY "Service role full access to subscriptions"
    ON public.user_subscriptions
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 6. RLS Policies for subscription_payments

-- Users can view payments for their subscriptions
CREATE POLICY "Users can view own subscription payments"
    ON public.subscription_payments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_subscriptions us
            WHERE us.razorpay_subscription_id = subscription_payments.razorpay_subscription_id
            AND us.user_id = auth.uid()
        )
    );

-- Service role can manage all payments (for webhooks)
CREATE POLICY "Service role full access to payments"
    ON public.subscription_payments
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 7. Function to check if user has active subscription
CREATE OR REPLACE FUNCTION public.has_active_subscription(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_subscriptions
        WHERE user_id = p_user_id
        AND status IN ('active', 'cancelled')  -- cancelled still has access until period end
        AND (current_period_end IS NULL OR current_period_end > NOW())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Function to get user's subscription details
CREATE OR REPLACE FUNCTION public.get_user_subscription(p_user_id UUID)
RETURNS TABLE (
    subscription_id UUID,
    plan_code TEXT,
    billing_cycle TEXT,
    status TEXT,
    current_period_end TIMESTAMPTZ,
    is_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        us.id,
        us.plan_code,
        us.billing_cycle,
        us.status,
        us.current_period_end,
        (us.status IN ('active', 'cancelled') AND (us.current_period_end IS NULL OR us.current_period_end > NOW())) as is_active
    FROM public.user_subscriptions us
    WHERE us.user_id = p_user_id
    ORDER BY us.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Function to link subscription to user after account creation
CREATE OR REPLACE FUNCTION public.link_subscription_to_user(p_email TEXT, p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.user_subscriptions
    SET user_id = p_user_id, updated_at = NOW()
    WHERE email = p_email AND user_id IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Trigger to auto-link subscription when user is created
CREATE OR REPLACE FUNCTION public.auto_link_subscription()
RETURNS TRIGGER AS $$
BEGIN
    -- Link any pending subscriptions to this user
    UPDATE public.user_subscriptions
    SET user_id = NEW.id, updated_at = NOW()
    WHERE email = NEW.email AND user_id IS NULL;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users (if not exists)
DROP TRIGGER IF EXISTS link_subscription_on_signup ON auth.users;
CREATE TRIGGER link_subscription_on_signup
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_link_subscription();

