-- Helper function to link existing user to tenant as staff
-- This is called after user is created via API

CREATE OR REPLACE FUNCTION add_staff_to_tenant(
    p_tenant_id UUID,
    p_user_id UUID,
    p_role user_role DEFAULT 'STAFF',
    p_branch_id UUID DEFAULT NULL,
    p_display_name TEXT DEFAULT NULL,
    p_role_label TEXT DEFAULT 'Staff'
)
RETURNS JSON AS $$
DECLARE
    v_staff_id UUID;
    v_user_email TEXT;
    v_user_name TEXT;
BEGIN
    -- Check if caller has permission
    IF NOT user_is_owner_or_manager(p_tenant_id) THEN
        RAISE EXCEPTION 'Insufficient permissions';
    END IF;

    -- Get user details
    SELECT email INTO v_user_email FROM auth.users WHERE id = p_user_id;
    SELECT full_name INTO v_user_name FROM public.profiles WHERE id = p_user_id;

    IF v_user_email IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    -- Check if already a member
    IF EXISTS (
        SELECT 1 FROM public.tenant_users 
        WHERE tenant_id = p_tenant_id AND user_id = p_user_id
    ) THEN
        RAISE EXCEPTION 'User is already a member of this tenant';
    END IF;

    -- Update profile with tenant
    UPDATE public.profiles
    SET default_tenant_id = COALESCE(default_tenant_id, p_tenant_id)
    WHERE id = p_user_id;

    -- Add user to tenant
    INSERT INTO public.tenant_users (tenant_id, user_id, role, is_active)
    VALUES (p_tenant_id, p_user_id, p_role, true);

    -- Create staff record
    INSERT INTO public.staff (
        tenant_id,
        user_id,
        branch_id,
        display_name,
        role_label,
        is_active
    )
    VALUES (
        p_tenant_id,
        p_user_id,
        p_branch_id,
        COALESCE(p_display_name, v_user_name, v_user_email),
        p_role_label,
        true
    )
    RETURNING id INTO v_staff_id;

    RETURN json_build_object(
        'success', true,
        'staff_id', v_staff_id
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION add_staff_to_tenant(UUID, UUID, user_role, UUID, TEXT, TEXT) TO authenticated;
