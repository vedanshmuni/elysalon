import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export type UserRole = 'SUPER_ADMIN' | 'OWNER' | 'MANAGER' | 'STAFF' | 'CASHIER' | 'READ_ONLY';

export interface UserRoleInfo {
  role: UserRole;
  userId: string;
  tenantId: string;
}

/**
 * Get the current user's role for their default tenant
 * Can be used in server components and server actions
 */
export async function getUserRole(): Promise<UserRoleInfo | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('default_tenant_id')
    .eq('id', user.id)
    .single();

  if (!profile?.default_tenant_id) return null;

  const { data: tenantUser } = await supabase
    .from('tenant_users')
    .select('role')
    .eq('tenant_id', profile.default_tenant_id)
    .eq('user_id', user.id)
    .single();

  return {
    role: (tenantUser?.role as UserRole) || 'STAFF',
    userId: user.id,
    tenantId: profile.default_tenant_id,
  };
}

/**
 * Check if user has one of the allowed roles
 * Returns true if user has permission, false otherwise
 */
export function hasRole(userRole: UserRole, allowedRoles: UserRole[]): boolean {
  return allowedRoles.includes(userRole);
}

/**
 * Require one of the allowed roles, redirect to dashboard if not authorized
 * Use this at the top of server components to protect pages
 */
export async function requireRole(allowedRoles: UserRole[]): Promise<UserRoleInfo> {
  const roleInfo = await getUserRole();

  if (!roleInfo) {
    redirect('/signin');
  }

  if (!allowedRoles.includes(roleInfo.role)) {
    redirect('/dashboard?error=unauthorized');
  }

  return roleInfo;
}

/**
 * Define which roles can access different features
 */
export const FEATURE_PERMISSIONS = {
  // Staff & HR Management
  manageStaff: ['SUPER_ADMIN', 'OWNER', 'MANAGER'] as UserRole[],
  viewStaff: ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'STAFF'] as UserRole[],
  viewAttendance: ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'STAFF'] as UserRole[],
  clockInOut: ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'STAFF'] as UserRole[],

  // Client Management
  manageClients: ['SUPER_ADMIN', 'OWNER', 'MANAGER'] as UserRole[],
  viewClients: ['SUPER_ADMIN', 'OWNER', 'MANAGER'] as UserRole[],

  // Inventory
  manageInventory: ['SUPER_ADMIN', 'OWNER', 'MANAGER'] as UserRole[],
  viewInventory: ['SUPER_ADMIN', 'OWNER', 'MANAGER'] as UserRole[],

  // Financial
  processPayments: ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'CASHIER'] as UserRole[],
  viewAnalytics: ['SUPER_ADMIN', 'OWNER', 'MANAGER'] as UserRole[],
  viewPOS: ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'CASHIER'] as UserRole[],

  // Marketing
  manageMarketing: ['SUPER_ADMIN', 'OWNER', 'MANAGER'] as UserRole[],
  sendBroadcasts: ['SUPER_ADMIN', 'OWNER', 'MANAGER'] as UserRole[],

  // Bookings
  manageBookings: ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'STAFF', 'CASHIER'] as UserRole[],
  viewBookings: ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'STAFF', 'CASHIER', 'READ_ONLY'] as UserRole[],
  
  // Calendar
  viewCalendar: ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'STAFF', 'CASHIER', 'READ_ONLY'] as UserRole[],

  // Services
  manageServices: ['SUPER_ADMIN', 'OWNER', 'MANAGER'] as UserRole[],
  viewServices: ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'STAFF', 'READ_ONLY'] as UserRole[],

  // Settings
  manageSettings: ['SUPER_ADMIN', 'OWNER'] as UserRole[],
  viewSettings: ['SUPER_ADMIN', 'OWNER'] as UserRole[],
};

/**
 * Convenience function to check feature permission
 */
export function canAccessFeature(
  userRole: UserRole,
  feature: keyof typeof FEATURE_PERMISSIONS
): boolean {
  return FEATURE_PERMISSIONS[feature].includes(userRole);
}
