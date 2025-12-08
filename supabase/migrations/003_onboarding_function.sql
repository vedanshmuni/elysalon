-- Function to handle complete onboarding flow
-- This bypasses RLS to create tenant, branch, tenant_user, and staff records atomically

CREATE OR REPLACE FUNCTION complete_onboarding(
    p_salon_name TEXT,
    p_branch_name TEXT,
    p_phone TEXT,
    p_address TEXT,
    p_user_full_name TEXT
)
RETURNS JSON AS $$
DECLARE
    v_user_id UUID;
    v_tenant_id UUID;
    v_branch_id UUID;
    v_slug TEXT;
    v_result JSON;
BEGIN
    -- Get current user ID
    v_user_id := auth.uid();
    
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

    -- Generate unique slug
    v_slug := lower(regexp_replace(p_salon_name, '[^a-zA-Z0-9]+', '-', 'g')) 
              || '-' || substr(md5(random()::text), 1, 6);

    -- Create tenant
    INSERT INTO public.tenants (name, slug, owner_user_id, phone, address)
    VALUES (p_salon_name, v_slug, v_user_id, p_phone, p_address)
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

    -- Create staff profile
    INSERT INTO public.staff (tenant_id, user_id, branch_id, display_name)
    VALUES (v_tenant_id, v_user_id, v_branch_id, COALESCE(p_user_full_name, 'Owner'));

    -- Return result
    v_result := json_build_object(
        'tenant_id', v_tenant_id,
        'branch_id', v_branch_id,
        'success', true
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION complete_onboarding(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
