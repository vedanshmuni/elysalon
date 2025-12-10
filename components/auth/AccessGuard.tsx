'use client';

import { useUserRole, UserRole } from '@/lib/hooks/useUserRole';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldX, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface AccessGuardProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
  fallback?: React.ReactNode;
}

export function AccessGuard({ children, allowedRoles, fallback }: AccessGuardProps) {
  const { role, loading } = useUserRole();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!allowedRoles.includes(role)) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <ShieldX className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle>Access Restricted</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              You don&apos;t have permission to access this page. 
              This feature is only available to{' '}
              {allowedRoles.map(r => r.toLowerCase().replace('_', ' ')).join(', ')}.
            </p>
            <p className="text-sm text-muted-foreground">
              Your current role: <span className="font-medium">{role.replace('_', ' ')}</span>
            </p>
            <Link href="/dashboard">
              <Button variant="outline" className="mt-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

// HOC version for wrapping entire pages
export function withAccessGuard(allowedRoles: UserRole[]) {
  return function <P extends object>(WrappedComponent: React.ComponentType<P>) {
    return function AccessGuardedComponent(props: P) {
      return (
        <AccessGuard allowedRoles={allowedRoles}>
          <WrappedComponent {...props} />
        </AccessGuard>
      );
    };
  };
}
