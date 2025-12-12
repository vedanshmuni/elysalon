-- ============================================
-- REMOVE SUBSCRIPTION CHECK FROM ONBOARDING
-- If user can login, they have paid - no need to check
-- ============================================

CREATE OR REPLACE FUNCTION complete_onboarding(
    p_salon_name TEXT,
    p_branch_name TEXT,
    p_phone TEXT,
    p_address TEXT,
    p_user_full_name TEXT,
    p_plan_code TEXT DEFAULT 'TRIAL'
)
RETURNS JSON AS $$
DECLARE
    v_user_id UUID;
    v_user_email TEXT;
    v_tenant_id UUID;
    v_branch_id UUID;
    v_slug TEXT;
    v_result JSON;
    v_subscription_status subscription_status := 'ACTIVE';
    v_final_plan_code TEXT;
    v_user_metadata JSONB;
BEGIN
    -- Get current user ID and Email
    v_user_id := auth.uid();
    SELECT email, raw_user_meta_data INTO v_user_email, v_user_metadata 
    FROM auth.users WHERE id = v_user_id;
    
    -- LOG: Start onboarding
    RAISE NOTICE 'Starting onboarding for user: %, email: %', v_user_id, v_user_email;
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Check if user already has a tenant
    IF EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = v_user_id 
        AND default_tenant_id IS NOT NULL
    ) THEN
        RAISE NOTICE 'User already onboarded';
        RAISE EXCEPTION 'User already onboarded';
    END IF;

    -- Get plan from user metadata (set during payment) or use provided plan
    IF v_user_metadata IS NOT NULL AND v_user_metadata->>'plan_code' IS NOT NULL THEN
        v_final_plan_code := v_user_metadata->>'plan_code';
        RAISE NOTICE 'Plan from user metadata: %', v_final_plan_code;
    ELSIF p_plan_code IS NOT NULL AND p_plan_code != 'TRIAL' THEN
        v_final_plan_code := p_plan_code;
        RAISE NOTICE 'Plan from parameter: %', v_final_plan_code;
    ELSE
        -- Try to get from subscription if exists (optional, not required)
        SELECT plan_code INTO v_final_plan_code
        FROM public.user_subscriptions
        WHERE (user_id = v_user_id OR LOWER(TRIM(email)) = LOWER(TRIM(v_user_email)))
        ORDER BY created_at DESC
        LIMIT 1;
        
        IF v_final_plan_code IS NULL THEN
            v_final_plan_code := 'BASIC';  -- Default plan
            RAISE NOTICE 'No plan found, using default: BASIC';
        ELSE
            RAISE NOTICE 'Plan from subscription: %', v_final_plan_code;
        END IF;
    END IF;

    -- Generate unique slug
    v_slug := lower(regexp_replace(p_salon_name, '[^a-zA-Z0-9]+', '-', 'g')) 
              || '-' || substr(md5(random()::text), 1, 6);
    
    RAISE NOTICE 'Generated slug: %', v_slug;

    -- Create tenant
    INSERT INTO public.tenants (name, slug, owner_user_id, phone, address, plan_code)
    VALUES (p_salon_name, v_slug, v_user_id, p_phone, p_address, v_final_plan_code)
    RETURNING id INTO v_tenant_id;
    
    RAISE NOTICE 'Tenant created: %', v_tenant_id;

    -- Create default branch
    INSERT INTO public.branches (tenant_id, name, code, phone, address)
    VALUES (v_tenant_id, COALESCE(p_branch_name, 'Main Branch'), 'MAIN', p_phone, p_address)
    RETURNING id INTO v_branch_id;
    
    RAISE NOTICE 'Branch created: %', v_branch_id;

    -- Add user to tenant as OWNER
    INSERT INTO public.tenant_users (tenant_id, user_id, role)
    VALUES (v_tenant_id, v_user_id, 'OWNER');
    
    RAISE NOTICE 'User added to tenant as OWNER';

    -- Ensure profile exists and update default tenant
    INSERT INTO public.profiles (id, full_name, default_tenant_id)
    VALUES (v_user_id, COALESCE(p_user_full_name, 'Owner'), v_tenant_id)
    ON CONFLICT (id) DO UPDATE 
    SET default_tenant_id = v_tenant_id,
        full_name = COALESCE(profiles.full_name, EXCLUDED.full_name);
    
    RAISE NOTICE 'Profile updated';

    -- Create staff profile for owner
    INSERT INTO public.staff (tenant_id, user_id, branch_id, display_name)
    VALUES (v_tenant_id, v_user_id, v_branch_id, COALESCE(p_user_full_name, 'Owner'));
    
    RAISE NOTICE 'Staff profile created';

    -- Create Subscription Record in tenant_subscriptions (for backward compatibility)
    INSERT INTO public.tenant_subscriptions (
        tenant_id, 
        plan_code, 
        status, 
        billing_period, 
        current_period_start, 
        current_period_end
    )
    VALUES (
        v_tenant_id,
        v_final_plan_code,
        v_subscription_status,
        'monthly',  -- Default billing period
        CURRENT_DATE,
        CURRENT_DATE + INTERVAL '1 month'
    );
    
    RAISE NOTICE 'Tenant subscription created';

    -- Return result
    v_result := json_build_object(
        'tenant_id', v_tenant_id,
        'branch_id', v_branch_id,
        'plan', v_final_plan_code,
        'success', true
    );

    RAISE NOTICE 'Onboarding completed successfully';
    RETURN v_result;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'ERROR in onboarding: %', SQLERRM;
        RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

