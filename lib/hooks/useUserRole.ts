'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export type UserRole = 'SUPER_ADMIN' | 'OWNER' | 'MANAGER' | 'STAFF' | 'CASHIER' | 'READ_ONLY';

interface UserPermissions {
  role: UserRole;
  userId: string | null;
  tenantId: string | null;
  loading: boolean;
  // Permission checks
  canManageStaff: boolean;
  canManageInventory: boolean;
  canViewAnalytics: boolean;
  canManageSettings: boolean;
  canProcessPayments: boolean;
  canViewClients: boolean;
  canSendBroadcasts: boolean;
  canManageBookings: boolean;
  canApproveLeave: boolean;
  canViewAllAttendance: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isStaff: boolean;
}

export function useUserRole(): UserPermissions {
  const [permissions, setPermissions] = useState<UserPermissions>({
    role: 'STAFF',
    userId: null,
    tenantId: null,
    loading: true,
    canManageStaff: false,
    canManageInventory: false,
    canViewAnalytics: false,
    canManageSettings: false,
    canProcessPayments: false,
    canViewClients: false,
    canSendBroadcasts: false,
    canManageBookings: false,
    canApproveLeave: false,
    canViewAllAttendance: false,
    isAdmin: false,
    isManager: false,
    isStaff: true,
  });

  useEffect(() => {
    async function loadUserRole() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setPermissions(prev => ({ ...prev, loading: false }));
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('default_tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile?.default_tenant_id) {
        setPermissions(prev => ({ 
          ...prev, 
          loading: false, 
          userId: user.id 
        }));
        return;
      }

      const { data: tenantUser } = await supabase
        .from('tenant_users')
        .select('role')
        .eq('user_id', user.id)
        .eq('tenant_id', profile.default_tenant_id)
        .eq('is_active', true)
        .single();

      const role = (tenantUser?.role as UserRole) || 'STAFF';
      
      // Calculate permissions based on role
      const isAdmin = ['SUPER_ADMIN', 'OWNER'].includes(role);
      const isManager = ['SUPER_ADMIN', 'OWNER', 'MANAGER'].includes(role);
      const isCashier = role === 'CASHIER';
      
      setPermissions({
        role,
        userId: user.id,
        tenantId: profile.default_tenant_id,
        loading: false,
        canManageStaff: isManager,
        canManageInventory: isManager,
        canViewAnalytics: isManager,
        canManageSettings: isAdmin,
        canProcessPayments: isManager || isCashier,
        canViewClients: isManager,
        canSendBroadcasts: isManager,
        canManageBookings: isManager || role === 'STAFF' || isCashier,
        canApproveLeave: isManager,
        canViewAllAttendance: isManager,
        isAdmin,
        isManager,
        isStaff: role === 'STAFF',
      });
    }

    loadUserRole();
  }, []);

  return permissions;
}

// Server-side role check (for use in server components)
export async function getUserRoleServer(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('default_tenant_id')
    .eq('id', userId)
    .single();

  if (!profile?.default_tenant_id) {
    return { role: 'STAFF' as UserRole, tenantId: null };
  }

  const { data: tenantUser } = await supabase
    .from('tenant_users')
    .select('role')
    .eq('user_id', userId)
    .eq('tenant_id', profile.default_tenant_id)
    .eq('is_active', true)
    .single();

  return {
    role: (tenantUser?.role as UserRole) || 'STAFF',
    tenantId: profile.default_tenant_id,
  };
}

// Permission matrix for reference
export const ROLE_PERMISSIONS = {
  SUPER_ADMIN: {
    description: 'Full system access',
    canAccess: ['*'],
  },
  OWNER: {
    description: 'Full salon access',
    canAccess: ['dashboard', 'bookings', 'calendar', 'clients', 'pos', 'marketing', 'broadcasts', 'staff', 'attendance', 'services', 'inventory', 'analytics', 'settings'],
  },
  MANAGER: {
    description: 'Manage daily operations',
    canAccess: ['dashboard', 'bookings', 'calendar', 'clients', 'pos', 'marketing', 'broadcasts', 'staff', 'attendance', 'services', 'inventory', 'analytics'],
    cannotAccess: ['settings'],
  },
  STAFF: {
    description: 'Service provider',
    canAccess: ['dashboard', 'bookings', 'calendar', 'my-attendance'],
    cannotAccess: ['clients', 'pos', 'marketing', 'broadcasts', 'staff', 'inventory', 'analytics', 'settings'],
  },
  CASHIER: {
    description: 'Handle payments',
    canAccess: ['dashboard', 'bookings', 'pos', 'my-attendance'],
    cannotAccess: ['clients', 'marketing', 'broadcasts', 'staff', 'inventory', 'analytics', 'settings'],
  },
  READ_ONLY: {
    description: 'View only access',
    canAccess: ['dashboard'],
    cannotAccess: ['bookings', 'calendar', 'clients', 'pos', 'marketing', 'broadcasts', 'staff', 'inventory', 'analytics', 'settings'],
  },
};
