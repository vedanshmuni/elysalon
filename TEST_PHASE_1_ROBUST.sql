-- ============================================
-- ROBUST TEST SCRIPT FOR PHASE 1
-- ============================================
-- This script tests negative scenarios (hacking attempts) and the happy path.
-- Run this in Supabase SQL Editor.

DO $$
DECLARE
    v_user_a_id UUID;
    v_user_a_email TEXT := 'user_a_' || floor(random() * 10000)::text || '@test.com';
    v_user_b_id UUID;
    v_user_b_email TEXT := 'user_b_' || floor(random() * 10000)::text || '@test.com';
    v_token_a TEXT := 'token_a_' || floor(random() * 10000)::text;
    v_token_old TEXT := 'token_old_' || floor(random() * 10000)::text;
    v_result JSON;
BEGIN
    -- 1. SETUP USERS
    RAISE NOTICE '--- SETUP ---';
    
    INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
    VALUES ('00000000-0000-0000-0000-000000000000', uuid_generate_v4(), 'authenticated', 'authenticated', v_user_a_email, 'password', NOW(), NOW(), NOW())
    RETURNING id INTO v_user_a_id;
    
    INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
    VALUES ('00000000-0000-0000-0000-000000000000', uuid_generate_v4(), 'authenticated', 'authenticated', v_user_b_email, 'password', NOW(), NOW(), NOW())
    RETURNING id INTO v_user_b_id;

    RAISE NOTICE 'Created User A: %', v_user_a_email;
    RAISE NOTICE 'Created User B: %', v_user_b_email;

    -- 2. TEST: NO PAYMENT ONBOARDING
    RAISE NOTICE '--- TEST 1: No Payment Onboarding (Should Fail) ---';
    BEGIN
        PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_a_id)::text, true);
        PERFORM complete_onboarding('Salon A', 'Main', '123', 'Addr', 'Owner A', 'TRIAL');
        RAISE EXCEPTION '❌ FAILED: User A was able to onboard without payment!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%No valid subscription found%' THEN
            RAISE NOTICE '✅ PASSED: Blocked onboarding without payment.';
        ELSE
            RAISE EXCEPTION '❌ FAILED: Unexpected error: %', SQLERRM;
        END IF;
    END;

    -- 3. TEST: TOKEN HIJACKING
    RAISE NOTICE '--- TEST 2: Token Hijacking (Should Fail) ---';
    -- Create and redeem token for User A
    INSERT INTO public.subscription_tokens (token, email, product_code, plan_code, is_used, created_at)
    VALUES (v_token_a, v_user_a_email, 'salon', 'PROFESSIONAL', true, NOW());
    
    BEGIN
        -- User B tries to onboard
        PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_b_id)::text, true);
        PERFORM complete_onboarding('Salon B', 'Main', '123', 'Addr', 'Owner B', 'TRIAL');
        RAISE EXCEPTION '❌ FAILED: User B was able to onboard using User A token!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%No valid subscription found%' THEN
            RAISE NOTICE '✅ PASSED: Blocked User B from using User A token.';
        ELSE
            RAISE EXCEPTION '❌ FAILED: Unexpected error: %', SQLERRM;
        END IF;
    END;

    -- 4. TEST: EXPIRED TOKEN
    RAISE NOTICE '--- TEST 3: Expired/Old Token (Should Fail) ---';
    -- Create old token for User A (2 hours ago)
    -- NOTE: We must ensure this is the ONLY token for User A, or at least the most recent one is old.
    -- In Test 2, we created a valid token for User A (v_token_a).
    -- The query in complete_onboarding looks for ANY valid token in the last hour.
    -- Since v_token_a exists and is valid (created NOW()), the function finds it and allows access!
    -- FIX: We need to use a NEW user (User C) for this test to ensure isolation.
    
    DECLARE
        v_user_c_id UUID;
        v_user_c_email TEXT := 'user_c_' || floor(random() * 10000)::text || '@test.com';
    BEGIN
        INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
        VALUES ('00000000-0000-0000-0000-000000000000', uuid_generate_v4(), 'authenticated', 'authenticated', v_user_c_email, 'password', NOW(), NOW(), NOW())
        RETURNING id INTO v_user_c_id;
        
        INSERT INTO public.subscription_tokens (token, email, product_code, plan_code, is_used, created_at)
        VALUES (v_token_old, v_user_c_email, 'salon', 'PROFESSIONAL', true, NOW() - INTERVAL '2 hours');
        
        BEGIN
            PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_c_id)::text, true);
            PERFORM complete_onboarding('Salon C Old', 'Main', '123', 'Addr', 'Owner C', 'TRIAL');
            RAISE EXCEPTION '❌ FAILED: User C was able to onboard with old token!';
        EXCEPTION WHEN OTHERS THEN
            IF SQLERRM LIKE '%No valid subscription found%' THEN
                RAISE NOTICE '✅ PASSED: Blocked onboarding with expired token.';
            ELSE
                RAISE EXCEPTION '❌ FAILED: Unexpected error: %', SQLERRM;
            END IF;
        END;
    END;

    -- 5. TEST: HAPPY PATH
    RAISE NOTICE '--- TEST 4: Happy Path (Should Succeed) ---';
    -- User A already has a valid token v_token_a created in step 3 (created_at = NOW())
    -- We reuse it here.
    
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_a_id)::text, true);
    SELECT complete_onboarding('Salon A Success', 'Main', '123', 'Addr', 'Owner A', 'TRIAL') INTO v_result;
    
    RAISE NOTICE 'Onboarding Result: %', v_result;
    
    -- Verify Plan
    PERFORM * FROM public.tenants WHERE id = (v_result->>'tenant_id')::uuid AND plan_code = 'PROFESSIONAL';
    IF FOUND THEN
        RAISE NOTICE '✅ PASSED: Tenant created with correct plan.';
    ELSE
        RAISE EXCEPTION '❌ FAILED: Tenant has wrong plan.';
    END IF;

    RAISE NOTICE '--- ALL TESTS PASSED ---';

END $$;
