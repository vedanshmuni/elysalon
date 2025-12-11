import { FeatureGuard } from '@/components/features/FeatureGuard';

export default function InventoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FeatureGuard feature="inventory">
      {children}
    </FeatureGuard>
  );
}
