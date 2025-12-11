import { FeatureGuard } from '@/components/features/FeatureGuard';

export default function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FeatureGuard feature="analytics">
      {children}
    </FeatureGuard>
  );
}
