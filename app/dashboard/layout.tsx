import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/signin');
  }

  // Get user profile and tenant
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, default_tenant_id')
    .eq('id', user.id)
    .single();

  // If no tenant, redirect to onboarding
  if (!profile?.default_tenant_id) {
    redirect('/onboarding');
  }

  let tenantName = 'My Salon';
  if (profile.default_tenant_id) {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name')
      .eq('id', profile.default_tenant_id)
      .single();
    if (tenant) tenantName = tenant.name;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar tenantName={tenantName} userName={profile?.full_name} />
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">{children}</main>
      </div>
    </div>
  );
}
