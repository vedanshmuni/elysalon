-- ============================================
-- FINAL FIX: Make onboarding find subscriptions reliably
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
    v_subscription_status subscription_status;
    v_final_plan_code TEXT;
    v_subscription_record RECORD;
    v_found BOOLEAN := false;
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

    -- STRATEGY 1: Find by user_id (if subscription is already linked)
    SELECT * INTO v_subscription_record
    FROM public.user_subscriptions
    WHERE user_id = v_user_id
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_subscription_record IS NOT NULL THEN
        v_found := true;
    END IF;
    
    -- STRATEGY 2: Find by email (case-insensitive, any status)
    IF NOT v_found THEN
        SELECT * INTO v_subscription_record
        FROM public.user_subscriptions
        WHERE LOWER(TRIM(email)) = LOWER(TRIM(v_user_email))
        ORDER BY created_at DESC
        LIMIT 1;
        
        IF v_subscription_record IS NOT NULL THEN
            v_found := true;
        END IF;
    END IF;
    
    -- STRATEGY 3: Find by email with LIKE (more lenient)
    IF NOT v_found THEN
        SELECT * INTO v_subscription_record
        FROM public.user_subscriptions
        WHERE LOWER(email) LIKE '%' || LOWER(TRIM(v_user_email)) || '%'
        ORDER BY created_at DESC
        LIMIT 1;
        
        IF v_subscription_record IS NOT NULL THEN
            v_found := true;
        END IF;
    END IF;

    -- If subscription found, use it
    IF v_found AND v_subscription_record IS NOT NULL THEN
        v_final_plan_code := v_subscription_record.plan_code;
        v_subscription_status := 'ACTIVE';  -- Always set to ACTIVE for onboarding
        
        -- Link subscription to user if not already linked
        IF v_subscription_record.user_id IS NULL OR v_subscription_record.user_id != v_user_id THEN
            UPDATE public.user_subscriptions
            SET user_id = v_user_id, updated_at = NOW()
            WHERE id = v_subscription_record.id;
        END IF;
        
        -- Update status to active if it's not already
        IF v_subscription_record.status NOT IN ('active', 'cancelled') THEN
            UPDATE public.user_subscriptions
            SET status = 'active', updated_at = NOW()
            WHERE id = v_subscription_record.id;
        END IF;
    ELSE
        -- No subscription found - provide helpful error
        RAISE EXCEPTION 'No subscription found for email: %. Please ensure you have completed payment and subscription was created.', v_user_email;
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
        COALESCE(v_subscription_record.billing_cycle, 'monthly'),
        COALESCE(v_subscription_record.current_period_start, CURRENT_DATE),
        COALESCE(v_subscription_record.current_period_end, 
            CASE 
                WHEN COALESCE(v_subscription_record.billing_cycle, 'monthly') = 'yearly' THEN CURRENT_DATE + INTERVAL '1 year'
                ELSE CURRENT_DATE + INTERVAL '1 month'
            END
        )
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

-- Also ensure RLS allows the function to read subscriptions
DROP POLICY IF EXISTS "Function can read subscriptions by email" ON public.user_subscriptions;
CREATE POLICY "Function can read subscriptions by email"
    ON public.user_subscriptions FOR SELECT
    USING (true);

