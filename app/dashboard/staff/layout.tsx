import { FeatureGuard } from '@/components/features/FeatureGuard';

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FeatureGuard feature="staff">
      {children}
    </FeatureGuard>
  );
}
