-- ============================================
-- QUICK FIX: Check and Fix Subscriptions
-- Run this to diagnose and fix subscription issues
-- ============================================

-- 1. Check if subscriptions table exists and has data
SELECT 
    'Total Subscriptions' as check_type,
    COUNT(*) as count
FROM public.user_subscriptions;

-- 2. Show all subscriptions
SELECT 
    id,
    razorpay_subscription_id,
    email,
    user_id,
    plan_code,
    status,
    created_at
FROM public.user_subscriptions
ORDER BY created_at DESC;

-- 3. Fix RLS - Allow function to read all subscriptions
DROP POLICY IF EXISTS "Function can read subscriptions by email" ON public.user_subscriptions;

-- This policy allows SECURITY DEFINER functions to read subscriptions
CREATE POLICY "Function can read subscriptions by email"
    ON public.user_subscriptions FOR SELECT
    USING (true);

-- 4. Also allow service role to read (for debugging)
-- Note: Service role already has full access, but this ensures it works

-- 5. If you need to manually create a subscription for testing:
-- (Replace with actual values)
/*
INSERT INTO public.user_subscriptions (
    razorpay_subscription_id,
    email,
    plan_code,
    billing_cycle,
    status,
    current_period_end
) VALUES (
    'sub_test123',
    'user@example.com',  -- Replace with actual email
    'PROFESSIONAL',  -- Replace with actual plan
    'monthly',
    'active',
    NOW() + INTERVAL '1 month'
) ON CONFLICT (razorpay_subscription_id) DO NOTHING;
*/

