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
} from 'lucide-react';
import { cn } from '@/lib/utils/helpers';
import { useState, useEffect } from 'react';

// Client-facing operations (front office)
const clientOperations = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Bookings', href: '/dashboard/bookings', icon: Calendar },
  { name: 'Booking Requests', href: '/dashboard/bookings/requests', icon: MessageSquare },
  { name: 'Calendar', href: '/dashboard/calendar', icon: Calendar },
  { name: 'Clients', href: '/dashboard/clients', icon: Users },
  { name: 'POS', href: '/dashboard/pos', icon: ShoppingCart },
  { name: 'Marketing', href: '/dashboard/marketing', icon: Mail },
  { name: 'WhatsApp Broadcasts', href: '/dashboard/broadcasts', icon: Send },
];

// Internal operations (back office)
const internalOperations = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Staff', href: '/dashboard/staff', icon: Users },
  { name: 'Services', href: '/dashboard/services', icon: Package },
  { name: 'Inventory', href: '/dashboard/inventory', icon: Package },
  { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'client' | 'internal'>('client');

  // Load view mode from localStorage on mount
  useEffect(() => {
    const savedMode = localStorage.getItem('salon_view_mode') as 'client' | 'internal';
    if (savedMode) {
      setViewMode(savedMode);
    }
  }, []);

  const toggleViewMode = () => {
    const newMode = viewMode === 'client' ? 'internal' : 'client';
    setViewMode(newMode);
    localStorage.setItem('salon_view_mode', newMode);
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/signin');
    router.refresh();
  };

  const navigation = viewMode === 'client' ? clientOperations : internalOperations;

  return (
    <div className="flex h-full w-64 flex-col bg-white border-r">
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-6">
        <Building2 className="h-6 w-6 text-primary" />
        <span className="ml-2 text-lg font-bold">SalonOS</span>
      </div>

      {/* View Mode Toggle */}
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

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');

          return (
            <Link
              key={item.name}
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
