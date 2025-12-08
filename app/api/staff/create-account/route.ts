import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Create Supabase client with service role for admin operations
// Service role bypasses RLS policies
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    db: {
      schema: 'public'
    }
  }
);

export async function POST(request: NextRequest) {
  try {
    const {
      tenantId,
      email,
      password,
      fullName,
      role,
      branchId,
      displayName,
      phone,
      roleLabel
    } = await request.json();

    // Validate required fields
    if (!tenantId || !email || !password || !fullName) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get current user from request to verify permissions
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Verify caller has permissions (owner or manager)
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: currentUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !currentUser) {
      return NextResponse.json(
        { success: false, error: 'Invalid authentication' },
        { status: 401 }
      );
    }

    // Check if user is owner/manager of the tenant
    const { data: membership } = await supabaseAdmin
      .from('tenant_users')
      .select('role')
      .eq('tenant_id', tenantId)
      .eq('user_id', currentUser.id)
      .single();

    if (!membership || !['OWNER', 'MANAGER', 'SUPER_ADMIN'].includes(membership.role)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Create the user account using Admin API
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password: password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: fullName
      }
    });

    if (createError) {
      console.error('Error creating user:', createError);
      return NextResponse.json(
        { success: false, error: createError.message },
        { status: 400 }
      );
    }

    if (!newUser.user) {
      return NextResponse.json(
        { success: false, error: 'Failed to create user' },
        { status: 500 }
      );
    }

    // Wait a bit for profile trigger to create profile
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Update profile with additional details
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name: fullName,
        phone: phone,
        default_tenant_id: tenantId
      })
      .eq('id', newUser.user.id);

    if (profileError) {
      console.error('Error updating profile:', profileError);
    }

    // Use the RPC function to add staff (bypasses RLS with SECURITY DEFINER)
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('add_staff_to_tenant', {
      p_tenant_id: tenantId,
      p_user_id: newUser.user.id,
      p_role: role || 'STAFF',
      p_branch_id: branchId || null,
      p_display_name: displayName || fullName,
      p_role_label: roleLabel || 'Staff'
    });

    if (rpcError) {
      console.error('Error calling add_staff_to_tenant:', rpcError);
      return NextResponse.json(
        { 
          success: false, 
          error: `Failed to add staff: ${rpcError.message}`,
          userId: newUser.user.id
        },
        { status: 500 }
      );
    }

    if (!rpcResult?.success) {
      console.error('add_staff_to_tenant failed:', rpcResult?.error);
      return NextResponse.json(
        { 
          success: false, 
          error: `Failed to add staff: ${rpcResult?.error}`,
          userId: newUser.user.id
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      userId: newUser.user.id,
      staffId: rpcResult.staff_id,
      message: 'Staff account created successfully'
    });

  } catch (error: any) {
    console.error('Error in create-staff-account API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
