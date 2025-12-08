import { createClient as createServerClient } from './supabase/server';

export type UserRole = 'SUPER_ADMIN' | 'OWNER' | 'MANAGER' | 'STAFF' | 'CASHIER' | 'READ_ONLY';

export interface TenantMembership {
  tenantId: string;
  role: UserRole;
  isActive: boolean;
}

/**
 * Get the current user's profile and tenant memberships
 */
export async function getCurrentUser() {
  const supabase = await createServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  // Get profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // Get tenant memberships
  const { data: memberships } = await supabase
    .from('tenant_users')
    .select('tenant_id, role, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true);

  return {
    user,
    profile,
    memberships: memberships || [],
  };
}

/**
 * Check if user has specific role in tenant
 */
export async function hasRole(tenantId: string, requiredRoles: UserRole[]): Promise<boolean> {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

  const { data: membership } = await supabase
    .from('tenant_users')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (!membership) return false;

  return requiredRoles.includes(membership.role as UserRole);
}

/**
 * Check if user is owner or manager
 */
export async function isOwnerOrManager(tenantId: string): Promise<boolean> {
  return hasRole(tenantId, ['SUPER_ADMIN', 'OWNER', 'MANAGER']);
}

/**
 * Get user's role in tenant
 */
export async function getUserRole(tenantId: string): Promise<UserRole | null> {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: membership } = await supabase
    .from('tenant_users')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  return membership?.role as UserRole | null;
}

/**
 * Role hierarchy for permission checks
 */
const roleHierarchy: Record<UserRole, number> = {
  SUPER_ADMIN: 100,
  OWNER: 80,
  MANAGER: 60,
  CASHIER: 40,
  STAFF: 20,
  READ_ONLY: 10,
};

/**
 * Check if user's role has sufficient permission
 */
export function hasPermission(userRole: UserRole, requiredRole: UserRole): boolean {
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}
