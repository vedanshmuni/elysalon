import { FeatureGuard } from '@/components/features/FeatureGuard';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FeatureGuard feature="marketing">
      {children}
    </FeatureGuard>
  );
}
