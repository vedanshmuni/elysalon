import { FeatureGuard } from '@/components/features/FeatureGuard';

export default function LoyaltyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FeatureGuard feature="loyalty_programs">
      {children}
    </FeatureGuard>
  );
}
