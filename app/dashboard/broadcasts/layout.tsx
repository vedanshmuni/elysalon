import { FeatureGuard } from '@/components/features/FeatureGuard';

export default function BroadcastsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FeatureGuard feature="broadcasts">
      {children}
    </FeatureGuard>
  );
}
