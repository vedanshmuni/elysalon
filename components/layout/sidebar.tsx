'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Calendar,
  Users,
  Package,
  ShoppingCart,
  BarChart3,
  Settings,
  Building2,
  Mail,
  LogOut,
  MessageSquare,
  Send,
  Briefcase,
  Store,
  Clock,
  User,
  CalendarDays,
  Gift,
} from 'lucide-react';
import { cn } from '@/lib/utils/helpers';
import { useState, useEffect } from 'react';
import { useTenantFeatures } from '@/lib/features/hooks';
import type { FeatureKey } from '@/lib/features/access';

type UserRole = 'SUPER_ADMIN' | 'OWNER' | 'MANAGER' | 'STAFF' | 'CASHIER' | 'READ_ONLY';

interface NavItem {
  name: string;
  href: string;
  icon: any;
  allowedRoles: UserRole[];
  requiredFeature?: FeatureKey; // NEW: Feature required to see this menu item
}

// Client-facing operations (front office)
const clientOperations: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, allowedRoles: ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'STAFF', 'CASHIER', 'READ_ONLY'] },
  { name: 'My Attendance', href: '/dashboard/staff/attendance/clock', icon: Clock, allowedRoles: ['STAFF', 'CASHIER'], requiredFeature: 'attendance_management' },
  { name: 'My Leave', href: '/dashboard/staff/attendance/leave-requests', icon: CalendarDays, allowedRoles: ['STAFF', 'CASHIER'], requiredFeature: 'attendance_management' },
  { name: 'Bookings', href: '/dashboard/bookings', icon: Calendar, allowedRoles: ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'STAFF', 'CASHIER'], requiredFeature: 'bookings' },
  { name: 'Booking Requests', href: '/dashboard/bookings/requests', icon: MessageSquare, allowedRoles: ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'STAFF'], requiredFeature: 'bookings' },
  { name: 'Calendar', href: '/dashboard/calendar', icon: Calendar, allowedRoles: ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'STAFF'], requiredFeature: 'calendar' },
  { name: 'Clients', href: '/dashboard/clients', icon: Users, allowedRoles: ['SUPER_ADMIN', 'OWNER', 'MANAGER'], requiredFeature: 'clients' },
  { name: 'POS', href: '/dashboard/pos', icon: ShoppingCart, allowedRoles: ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'CASHIER'], requiredFeature: 'pos' },
  { name: 'Marketing', href: '/dashboard/marketing', icon: Mail, allowedRoles: ['SUPER_ADMIN', 'OWNER', 'MANAGER'], requiredFeature: 'marketing' },
  { name: 'Loyalty Program', href: '/dashboard/loyalty', icon: Gift, allowedRoles: ['SUPER_ADMIN', 'OWNER', 'MANAGER'], requiredFeature: 'loyalty_programs' },
  { name: 'WhatsApp Broadcasts', href: '/dashboard/broadcasts', icon: Send, allowedRoles: ['SUPER_ADMIN', 'OWNER', 'MANAGER'], requiredFeature: 'broadcasts' },
];

// Internal operations (back office)
const internalOperations: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, allowedRoles: ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'STAFF', 'CASHIER', 'READ_ONLY'] },
  { name: 'My Attendance', href: '/dashboard/staff/attendance/clock', icon: Clock, allowedRoles: ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'STAFF', 'CASHIER'], requiredFeature: 'attendance_management' },
  { name: 'Staff Management', href: '/dashboard/staff', icon: Users, allowedRoles: ['SUPER_ADMIN', 'OWNER', 'MANAGER'], requiredFeature: 'staff' },
  { name: 'All Attendance', href: '/dashboard/staff/attendance', icon: Clock, allowedRoles: ['SUPER_ADMIN', 'OWNER', 'MANAGER'], requiredFeature: 'attendance_management' },
  { name: 'Leave Requests', href: '/dashboard/staff/attendance/leave-requests', icon: CalendarDays, allowedRoles: ['SUPER_ADMIN', 'OWNER', 'MANAGER'], requiredFeature: 'attendance_management' },
  { name: 'Services', href: '/dashboard/services', icon: Package, allowedRoles: ['SUPER_ADMIN', 'OWNER', 'MANAGER'], requiredFeature: 'services' },
  { name: 'Inventory', href: '/dashboard/inventory', icon: Package, allowedRoles: ['SUPER_ADMIN', 'OWNER', 'MANAGER'], requiredFeature: 'inventory' },
  { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3, allowedRoles: ['SUPER_ADMIN', 'OWNER', 'MANAGER'], requiredFeature: 'analytics' },
  { name: 'Loyalty Program', href: '/dashboard/loyalty', icon: Gift, allowedRoles: ['SUPER_ADMIN', 'OWNER', 'MANAGER'], requiredFeature: 'loyalty_programs' },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings, allowedRoles: ['SUPER_ADMIN', 'OWNER'] },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'client' | 'internal'>('client');
  const [userRole, setUserRole] = useState<UserRole>('STAFF');
  const [userName, setUserName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  
  // Get tenant features for filtering navigation
  const { features, planCode } = useTenantFeatures();

  // Load user role and view mode
  useEffect(() => {
    async function loadUserData() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setLoading(false);
        return;
      }

      // Get user's profile and tenant role
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, default_tenant_id')
        .eq('id', user.id)
        .single();

      if (profile?.full_name) {
        setUserName(profile.full_name);
      }

      if (profile?.default_tenant_id) {
        // Get user's role in the tenant
        const { data: tenantUser } = await supabase
          .from('tenant_users')
          .select('role')
          .eq('user_id', user.id)
          .eq('tenant_id', profile.default_tenant_id)
          .eq('is_active', true)
          .single();

        if (tenantUser?.role) {
          setUserRole(tenantUser.role as UserRole);
        }
      }

      // Load saved view mode
      const savedMode = localStorage.getItem('salon_view_mode') as 'client' | 'internal';
      if (savedMode) {
        setViewMode(savedMode);
      }

      setLoading(false);
    }

    loadUserData();
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/signin');
    router.refresh();
  };

  // Filter navigation based on user role AND plan features
  const filterByRoleAndFeatures = (items: NavItem[]) => {
    return items.filter(item => {
      // First check role
      if (!item.allowedRoles.includes(userRole)) {
        return false;
      }
      
      // Then check feature access (if required)
      if (item.requiredFeature && features) {
        return features[item.requiredFeature] === true;
      }
      
      // If no feature required or features not loaded yet, show item
      return true;
    });
  };

  const navigation = viewMode === 'client' 
    ? filterByRoleAndFeatures(clientOperations) 
    : filterByRoleAndFeatures(internalOperations);

  // Check if user can see internal operations toggle
  const canSeeInternalOps = ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'STAFF', 'CASHIER'].includes(userRole);

  // Get role display name
  const getRoleDisplay = (role: UserRole) => {
    const roleNames: Record<UserRole, string> = {
      'SUPER_ADMIN': 'Super Admin',
      'OWNER': 'Owner',
      'MANAGER': 'Manager',
      'STAFF': 'Staff',
      'CASHIER': 'Cashier',
      'READ_ONLY': 'View Only',
    };
    return roleNames[role];
  };

  // Get role color
  const getRoleColor = (role: UserRole) => {
    const colors: Record<UserRole, string> = {
      'SUPER_ADMIN': 'bg-purple-100 text-purple-800',
      'OWNER': 'bg-blue-100 text-blue-800',
      'MANAGER': 'bg-green-100 text-green-800',
      'STAFF': 'bg-gray-100 text-gray-800',
      'CASHIER': 'bg-yellow-100 text-yellow-800',
      'READ_ONLY': 'bg-gray-100 text-gray-500',
    };
    return colors[role];
  };

  if (loading) {
    return (
      <div className="flex h-full w-64 flex-col bg-white border-r">
        <div className="flex h-16 items-center border-b px-6">
          <Building2 className="h-6 w-6 text-primary" />
          <span className="ml-2 text-lg font-bold">SalonOS</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-64 flex-col bg-white border-r">
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-6">
        <Building2 className="h-6 w-6 text-primary" />
        <span className="ml-2 text-lg font-bold">SalonOS</span>
      </div>

      {/* User Info */}
      <div className="border-b p-3">
        <div className="flex items-center gap-3 p-2 rounded-lg bg-gray-50">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <User className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{userName || 'User'}</p>
            <span className={cn('text-xs px-2 py-0.5 rounded-full', getRoleColor(userRole))}>
              {getRoleDisplay(userRole)}
            </span>
          </div>
        </div>
      </div>

      {/* View Mode Toggle - Only show if user has access to internal ops */}
      {canSeeInternalOps && (
        <div className="border-b p-3">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => {
                setViewMode('client');
                localStorage.setItem('salon_view_mode', 'client');
              }}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-all',
                viewMode === 'client'
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Store className="h-4 w-4" />
              Client Ops
            </button>
            <button
              onClick={() => {
                setViewMode('internal');
                localStorage.setItem('salon_view_mode', 'internal');
              }}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-all',
                viewMode === 'internal'
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Briefcase className="h-4 w-4" />
              Internal
            </button>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || 
            (item.href !== '/dashboard' && pathname?.startsWith(item.href));

          return (
            <Link
              key={item.name + item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Role-based info footer */}
      {userRole === 'STAFF' && (
        <div className="border-t p-3">
          <p className="text-xs text-muted-foreground text-center">
            Some features are restricted.<br/>
            Contact your manager for access.
          </p>
        </div>
      )}

      {/* Sign Out */}
      <div className="border-t p-4">
        <Button variant="ghost" className="w-full justify-start" onClick={handleSignOut}>
          <LogOut className="mr-2 h-5 w-5" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
