-- ============================================
-- TEST SCRIPT FOR PHASE 1 (SUBSCRIPTION FLOW)
-- ============================================
-- Run this script in your Supabase SQL Editor to verify the flow.

DO $$
DECLARE
    v_user_id UUID;
    v_user_email TEXT := 'test_user_' || floor(random() * 1000)::text || '@example.com';
    v_token TEXT := 'test_token_' || floor(random() * 1000)::text;
    v_redeem_result RECORD;
    v_onboarding_result JSON;
BEGIN
    RAISE NOTICE '1. Creating a test user...';
    -- Create a fake user in auth.users (simulating signup)
    INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    VALUES ('00000000-0000-0000-0000-000000000000', uuid_generate_v4(), 'authenticated', 'authenticated', v_user_email, 'encrypted_password', NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW(), '', '', '', '')
    RETURNING id INTO v_user_id;
    
    RAISE NOTICE 'User created: % (ID: %)', v_user_email, v_user_id;

    RAISE NOTICE '2. Simulating Payment & Token Generation...';
    -- Insert a token as if payment succeeded
    INSERT INTO public.subscription_tokens (token, email, product_code, plan_code, payment_id)
    VALUES (v_token, v_user_email, 'salon', 'PROFESSIONAL', 'pay_test_123');

    RAISE NOTICE '3. Simulating Token Redemption (API Call)...';
    -- Call the redemption function
    SELECT * INTO v_redeem_result FROM redeem_subscription_token(v_token);
    
    IF v_redeem_result.success THEN
        RAISE NOTICE 'Token redeemed successfully!';
    ELSE
        RAISE EXCEPTION 'Token redemption failed: %', v_redeem_result.message;
    END IF;

    RAISE NOTICE '4. Simulating Onboarding (Frontend Call)...';
    -- We need to impersonate the user for the RLS/Auth check in complete_onboarding
    -- Since we can't easily "become" the user in a DO block without setting request.jwt.claim.sub,
    -- we will temporarily modify the function or just trust the logic.
    -- ACTUALLY, complete_onboarding uses auth.uid(). In a pure SQL script, auth.uid() is null.
    -- We can mock auth.uid() by setting a config variable if using PostgREST, but here in SQL Editor it's hard.
    
    -- WORKAROUND: We will call the function but we need to hack the auth check for this test ONLY.
    -- OR better: We verify the logic by checking the tables.
    
    -- Let's try to set the local config for auth.uid (works in some Supabase environments)
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_id)::text, true);
    
    -- Now call onboarding
    -- Note: We pass 'TRIAL' but expect 'PROFESSIONAL' because of the token
    SELECT complete_onboarding(
        'Test Salon',
        'Main Branch',
        '555-0123',
        '123 Test St',
        'Test Owner',
        'TRIAL' 
    ) INTO v_onboarding_result;
    
    RAISE NOTICE 'Onboarding Result: %', v_onboarding_result;

    RAISE NOTICE '5. Verifying Results...';
    
    -- Check Tenant
    PERFORM * FROM public.tenants WHERE owner_user_id = v_user_id AND plan_code = 'PROFESSIONAL';
    IF FOUND THEN
        RAISE NOTICE '✅ SUCCESS: Tenant created with PROFESSIONAL plan (ignoring TRIAL input)';
    ELSE
        RAISE EXCEPTION '❌ FAILURE: Tenant not found or wrong plan';
    END IF;

    -- Check Subscription
    PERFORM * FROM public.tenant_subscriptions WHERE tenant_id = (v_onboarding_result->>'tenant_id')::uuid AND status = 'ACTIVE';
    IF FOUND THEN
        RAISE NOTICE '✅ SUCCESS: Subscription is ACTIVE (No Trial)';
    ELSE
        RAISE EXCEPTION '❌ FAILURE: Subscription not active';
    END IF;

    -- Clean up (Optional)
    -- DELETE FROM auth.users WHERE id = v_user_id;
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Test Failed: %', SQLERRM;
END $$;
