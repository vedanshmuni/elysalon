-- ============================================
-- DEBUG: Check Subscriptions
-- Run this to see what subscriptions exist
-- ============================================

-- 1. Check all subscriptions
SELECT 
    id,
    razorpay_subscription_id,
    email,
    user_id,
    plan_code,
    billing_cycle,
    status,
    current_period_end,
    created_at
FROM public.user_subscriptions
ORDER BY created_at DESC
LIMIT 20;

-- 2. Check subscriptions for a specific email (replace with actual email)
-- SELECT * FROM public.user_subscriptions 
-- WHERE LOWER(TRIM(email)) = LOWER(TRIM('user@example.com'));

-- 3. Check if any subscriptions are missing user_id
-- SELECT * FROM public.user_subscriptions 
-- WHERE user_id IS NULL;

