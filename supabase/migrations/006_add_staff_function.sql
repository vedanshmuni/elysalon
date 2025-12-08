-- Migration: Add function to properly add staff with tenant membership
-- This ensures staff members are also added to tenant_users for RLS to work

-- Function to add an existing user as staff
-- This handles both tenant_users and staff table entries
CREATE OR REPLACE FUNCTION add_staff_member(
    p_tenant_id UUID,
    p_user_id UUID,
    p_display_name TEXT,
    p_role_label TEXT,
    p_branch_id UUID DEFAULT NULL,
    p_skills TEXT[] DEFAULT '{}',
    p_target_revenue NUMERIC DEFAULT NULL,
    p_target_retail NUMERIC DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT true
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
    v_staff_id UUID;
    v_tenant_user_exists BOOLEAN;
BEGIN
    -- Verify caller has permission (must be owner or manager)
    IF NOT user_is_owner_or_manager(p_tenant_id) THEN
        RAISE EXCEPTION 'Permission denied: Only owners and managers can add staff';
    END IF;

    -- Check if user already has tenant membership
    SELECT EXISTS(
        SELECT 1 FROM public.tenant_users
        WHERE tenant_id = p_tenant_id
        AND user_id = p_user_id
    ) INTO v_tenant_user_exists;

    -- Add to tenant_users if not already a member
    IF NOT v_tenant_user_exists THEN
        INSERT INTO public.tenant_users (tenant_id, user_id, role, is_active)
        VALUES (p_tenant_id, p_user_id, 'STAFF', true);
    END IF;

    -- Check if already staff
    IF EXISTS(
        SELECT 1 FROM public.staff
        WHERE tenant_id = p_tenant_id
        AND user_id = p_user_id
    ) THEN
        RAISE EXCEPTION 'User is already a staff member';
    END IF;

    -- Create staff record
    INSERT INTO public.staff (
        tenant_id,
        user_id,
        display_name,
        role_label,
        branch_id,
        skills,
        target_revenue,
        target_retail,
        is_active
    ) VALUES (
        p_tenant_id,
        p_user_id,
        p_display_name,
        p_role_label,
        p_branch_id,
        p_skills,
        p_target_revenue,
        p_target_retail,
        p_is_active
    )
    RETURNING id INTO v_staff_id;

    -- Return success
    SELECT json_build_object(
        'success', true,
        'staff_id', v_staff_id,
        'message', 'Staff member added successfully'
    ) INTO v_result;

    RETURN v_result;

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION add_staff_member TO authenticated;

-- Add comment
COMMENT ON FUNCTION add_staff_member IS 'Adds an existing user as staff member, ensuring they also have tenant membership for RLS to work correctly';
