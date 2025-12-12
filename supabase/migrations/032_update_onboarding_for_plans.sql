-- ============================================
-- UPDATE ONBOARDING TO HANDLE PLANS SECURELY
-- ============================================

CREATE OR REPLACE FUNCTION complete_onboarding(
    p_salon_name TEXT,
    p_branch_name TEXT,
    p_phone TEXT,
    p_address TEXT,
    p_user_full_name TEXT,
    p_plan_code TEXT DEFAULT 'TRIAL' -- Kept for backward compatibility/UI, but logic will override
)
RETURNS JSON AS $$
DECLARE
    v_user_id UUID;
    v_user_email TEXT;
    v_tenant_id UUID;
    v_branch_id UUID;
    v_slug TEXT;
    v_result JSON;
    v_subscription_status subscription_status;
    v_final_plan_code TEXT;
    v_token_plan TEXT;
BEGIN
    -- Get current user ID and Email
    v_user_id := auth.uid();
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Check if user already has a tenant
    IF EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = v_user_id 
        AND default_tenant_id IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'User already onboarded';
    END IF;

    -- SECURITY CHECK: Look for a valid, recently redeemed token for this user
    -- This prevents users from manipulating the URL to get a better plan
    SELECT plan_code INTO v_token_plan
    FROM public.subscription_tokens
    WHERE email = v_user_email
    AND is_used = true
    AND created_at > (NOW() - INTERVAL '1 hour') -- Token must have been created recently
    ORDER BY created_at DESC
    LIMIT 1;

    -- Determine final plan
    IF v_token_plan IS NOT NULL THEN
        v_final_plan_code := v_token_plan;
        v_subscription_status := 'ACTIVE';
    ELSE
        -- STRICT MODE: No Free Trial allowed
        RAISE EXCEPTION 'No valid subscription found. Please subscribe to a plan to continue.';
    END IF;

    -- Generate unique slug
    v_slug := lower(regexp_replace(p_salon_name, '[^a-zA-Z0-9]+', '-', 'g')) 
              || '-' || substr(md5(random()::text), 1, 6);

    -- Create tenant
    INSERT INTO public.tenants (name, slug, owner_user_id, phone, address, plan_code)
    VALUES (p_salon_name, v_slug, v_user_id, p_phone, p_address, v_final_plan_code)
    RETURNING id INTO v_tenant_id;

    -- Create default branch
    INSERT INTO public.branches (tenant_id, name, code, phone, address)
    VALUES (v_tenant_id, COALESCE(p_branch_name, 'Main Branch'), 'MAIN', p_phone, p_address)
    RETURNING id INTO v_branch_id;

    -- Add user to tenant as OWNER
    INSERT INTO public.tenant_users (tenant_id, user_id, role)
    VALUES (v_tenant_id, v_user_id, 'OWNER');

    -- Ensure profile exists and update default tenant
    INSERT INTO public.profiles (id, full_name, default_tenant_id)
    VALUES (v_user_id, COALESCE(p_user_full_name, 'Owner'), v_tenant_id)
    ON CONFLICT (id) DO UPDATE 
    SET default_tenant_id = v_tenant_id,
        full_name = COALESCE(profiles.full_name, EXCLUDED.full_name);

    -- Create staff profile for owner
    INSERT INTO public.staff (tenant_id, user_id, branch_id, display_name)
    VALUES (v_tenant_id, v_user_id, v_branch_id, COALESCE(p_user_full_name, 'Owner'));

    -- Create Subscription Record
    INSERT INTO public.tenant_subscriptions (
        tenant_id, 
        plan_code, 
        status, 
        billing_period, 
        current_period_start, 
        current_period_end,
        trial_ends_at
    )
    VALUES (
        v_tenant_id,
        v_final_plan_code,
        v_subscription_status,
        'monthly',
        CURRENT_DATE,
        CASE 
            WHEN v_subscription_status = 'TRIAL' THEN CURRENT_DATE + INTERVAL '14 days'
            ELSE CURRENT_DATE + INTERVAL '1 month'
        END,
        CASE 
            WHEN v_subscription_status = 'TRIAL' THEN CURRENT_DATE + INTERVAL '14 days'
            ELSE NULL
        END
    );

    -- Return result
    v_result := json_build_object(
        'tenant_id', v_tenant_id,
        'branch_id', v_branch_id,
        'plan', v_final_plan_code,
        'success', true
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
