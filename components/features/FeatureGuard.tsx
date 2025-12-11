'use client';

import { ReactNode } from 'react';
import { useFeatureAccess, type FeatureKey } from '@/lib/features/hooks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface FeatureGuardProps {
  feature: FeatureKey;
  children: ReactNode;
  fallback?: ReactNode;
  showUpgrade?: boolean;
}

/**
 * FeatureGuard Component
 * 
 * Wraps components/pages that require specific plan features.
 * Shows upgrade prompt if user doesn't have access.
 * 
 * Usage:
 * <FeatureGuard feature="staff">
 *   <StaffManagementPage />
 * </FeatureGuard>
 */
export function FeatureGuard({ 
  feature, 
  children, 
  fallback,
  showUpgrade = true 
}: FeatureGuardProps) {
  const { hasAccess, loading } = useFeatureAccess(feature);
  const router = useRouter();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  // Custom fallback provided
  if (fallback) {
    return <>{fallback}</>;
  }

  // Default upgrade prompt
  if (showUpgrade) {
    return (
      <div className="flex items-center justify-center min-h-[400px] p-6">
        <Card className="max-w-md">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-primary/10 rounded-full">
                <Lock className="w-6 h-6 text-primary" />
              </div>
            </div>
            <CardTitle>Feature Not Available</CardTitle>
            <CardDescription>
              This feature is not included in your current plan.
              Upgrade to access this feature and more.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              onClick={() => router.push('/pricing')}
              className="w-full"
            >
              View Plans & Upgrade
            </Button>
            <Button 
              variant="outline"
              onClick={() => router.push('/dashboard')}
              className="w-full"
            >
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}

/**
 * Feature Badge Component
 * 
 * Shows a badge if feature is locked, useful for UI elements
 */
export function FeatureBadge({ feature }: { feature: FeatureKey }) {
  const { hasAccess, loading } = useFeatureAccess(feature);

  if (loading || hasAccess) return null;

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded-full">
      <Lock className="w-3 h-3" />
      Upgrade
    </span>
  );
}
