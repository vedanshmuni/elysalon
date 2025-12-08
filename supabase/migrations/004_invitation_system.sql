-- Enhanced invitation system for staff onboarding

-- Add token field to tenant_invitations if not exists
ALTER TABLE public.tenant_invitations 
ADD COLUMN IF NOT EXISTS token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_token ON public.tenant_invitations(token);
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_email ON public.tenant_invitations(email);

-- Function to create staff invitation
CREATE OR REPLACE FUNCTION create_staff_invitation(
    p_tenant_id UUID,
    p_email TEXT,
    p_role user_role,
    p_branch_id UUID DEFAULT NULL,
    p_expires_in_days INTEGER DEFAULT 7
)
RETURNS JSON AS $$
DECLARE
    v_invitation_id UUID;
    v_token TEXT;
    v_expires_at TIMESTAMPTZ;
    v_user_id UUID;
BEGIN
    -- Get current user ID
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Check if user has permission to invite (must be OWNER or MANAGER)
    IF NOT user_is_owner_or_manager(p_tenant_id) THEN
        RAISE EXCEPTION 'Insufficient permissions to invite staff';
    END IF;

    -- Check if email is already a member
    IF EXISTS (
        SELECT 1 FROM public.tenant_users tu
        JOIN auth.users u ON tu.user_id = u.id
        WHERE tu.tenant_id = p_tenant_id 
        AND u.email = p_email
        AND tu.is_active = true
    ) THEN
        RAISE EXCEPTION 'User with this email is already a member';
    END IF;

    -- Check for pending invitation
    IF EXISTS (
        SELECT 1 FROM public.tenant_invitations
        WHERE tenant_id = p_tenant_id 
        AND email = p_email
        AND status = 'pending'
        AND expires_at > NOW()
    ) THEN
        RAISE EXCEPTION 'An active invitation already exists for this email';
    END IF;

    -- Generate secure token
    v_token := encode(gen_random_bytes(32), 'base64');
    v_token := replace(replace(replace(v_token, '+', '-'), '/', '_'), '=', '');
    
    -- Calculate expiration
    v_expires_at := NOW() + (p_expires_in_days || ' days')::INTERVAL;

    -- Create invitation
    INSERT INTO public.tenant_invitations (
        tenant_id, 
        email, 
        role, 
        invited_by, 
        token, 
        expires_at,
        branch_id,
        status
    )
    VALUES (
        p_tenant_id,
        lower(trim(p_email)),
        p_role,
        v_user_id,
        v_token,
        v_expires_at,
        p_branch_id,
        'pending'
    )
    RETURNING id INTO v_invitation_id;

    -- Return invitation details
    RETURN json_build_object(
        'invitation_id', v_invitation_id,
        'token', v_token,
        'expires_at', v_expires_at,
        'invite_url', 'https://your-domain.com/signup?invite=' || v_token,
        'success', true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to accept invitation during signup
CREATE OR REPLACE FUNCTION accept_invitation(
    p_token TEXT,
    p_user_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_invitation RECORD;
    v_tenant_name TEXT;
BEGIN
    -- Find valid invitation
    SELECT * INTO v_invitation
    FROM public.tenant_invitations
    WHERE token = p_token
    AND status = 'pending'
    AND expires_at > NOW();

    IF v_invitation IS NULL THEN
        RAISE EXCEPTION 'Invalid or expired invitation';
    END IF;

    -- Get tenant name
    SELECT name INTO v_tenant_name
    FROM public.tenants
    WHERE id = v_invitation.tenant_id;

    -- Add user to tenant
    INSERT INTO public.tenant_users (tenant_id, user_id, role)
    VALUES (v_invitation.tenant_id, p_user_id, v_invitation.role)
    ON CONFLICT (tenant_id, user_id) DO UPDATE
    SET role = EXCLUDED.role, is_active = true;

    -- Update profile with default tenant if not set
    UPDATE public.profiles
    SET default_tenant_id = COALESCE(default_tenant_id, v_invitation.tenant_id)
    WHERE id = p_user_id;

    -- Create staff profile if branch is specified
    IF v_invitation.branch_id IS NOT NULL THEN
        INSERT INTO public.staff (tenant_id, user_id, branch_id, display_name)
        SELECT 
            v_invitation.tenant_id,
            p_user_id,
            v_invitation.branch_id,
            COALESCE(p.full_name, u.email, 'Staff Member')
        FROM public.profiles p
        JOIN auth.users u ON p.id = u.id
        WHERE p.id = p_user_id
        ON CONFLICT (tenant_id, user_id) DO NOTHING;
    END IF;

    -- Mark invitation as accepted
    UPDATE public.tenant_invitations
    SET status = 'accepted',
        accepted_at = NOW()
    WHERE id = v_invitation.id;

    RETURN json_build_object(
        'success', true,
        'tenant_id', v_invitation.tenant_id,
        'tenant_name', v_tenant_name,
        'role', v_invitation.role
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get invitation details (for displaying on signup page)
CREATE OR REPLACE FUNCTION get_invitation_details(p_token TEXT)
RETURNS JSON AS $$
DECLARE
    v_invitation RECORD;
    v_tenant_name TEXT;
    v_inviter_name TEXT;
BEGIN
    -- Find invitation
    SELECT i.*, t.name as tenant_name
    INTO v_invitation
    FROM public.tenant_invitations i
    JOIN public.tenants t ON i.tenant_id = t.id
    WHERE i.token = p_token
    AND i.status = 'pending'
    AND i.expires_at > NOW();

    IF v_invitation IS NULL THEN
        RETURN json_build_object(
            'valid', false,
            'error', 'Invalid or expired invitation'
        );
    END IF;

    -- Get inviter name
    SELECT full_name INTO v_inviter_name
    FROM public.profiles
    WHERE id = v_invitation.invited_by;

    RETURN json_build_object(
        'valid', true,
        'email', v_invitation.email,
        'tenant_name', v_invitation.tenant_name,
        'role', v_invitation.role,
        'inviter_name', COALESCE(v_inviter_name, 'Admin'),
        'expires_at', v_invitation.expires_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_staff_invitation(UUID, TEXT, user_role, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_invitation(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_invitation_details(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_invitation_details(TEXT) TO anon;
