'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function DebugPage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [tenant, setTenant] = useState<any>(null);
  const [tenantUser, setTenantUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const supabase = createClient();

    // Get user
    const { data: { user: userData } } = await supabase.auth.getUser();
    setUser(userData);

    if (userData) {
      // Get profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userData.id)
        .single();
      setProfile(profileData);

      // Get tenant if profile has one
      if (profileData?.default_tenant_id) {
        const { data: tenantData } = await supabase
          .from('tenants')
          .select('*')
          .eq('id', profileData.default_tenant_id)
          .single();
        setTenant(tenantData);

        // Get tenant_user relationship
        const { data: tenantUserData } = await supabase
          .from('tenant_users')
          .select('*')
          .eq('user_id', userData.id)
          .eq('tenant_id', profileData.default_tenant_id)
          .single();
        setTenantUser(tenantUserData);
      }
    }

    setLoading(false);
  }

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Debug Information</h1>
        <div className="flex gap-2">
          <Link href="/signin">
            <Button variant="outline">Sign In</Button>
          </Link>
          <Link href="/onboarding">
            <Button variant="outline">Onboarding</Button>
          </Link>
          <Link href="/dashboard">
            <Button>Dashboard</Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Authentication User</CardTitle>
        </CardHeader>
        <CardContent>
          {user ? (
            <pre className="bg-gray-100 p-4 rounded overflow-auto">
              {JSON.stringify(user, null, 2)}
            </pre>
          ) : (
            <p className="text-red-600">No user authenticated</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          {profile ? (
            <pre className="bg-gray-100 p-4 rounded overflow-auto">
              {JSON.stringify(profile, null, 2)}
            </pre>
          ) : (
            <p className="text-red-600">No profile found</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tenant</CardTitle>
        </CardHeader>
        <CardContent>
          {tenant ? (
            <pre className="bg-gray-100 p-4 rounded overflow-auto">
              {JSON.stringify(tenant, null, 2)}
            </pre>
          ) : (
            <p className="text-orange-600">No tenant found (onboarding needed)</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tenant User Relationship</CardTitle>
        </CardHeader>
        <CardContent>
          {tenantUser ? (
            <pre className="bg-gray-100 p-4 rounded overflow-auto">
              {JSON.stringify(tenantUser, null, 2)}
            </pre>
          ) : (
            <p className="text-orange-600">No tenant_user relationship</p>
          )}
        </CardContent>
      </Card>

      <Card className="bg-blue-50">
        <CardHeader>
          <CardTitle>What to do?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!user && (
            <p>✅ <strong>Step 1:</strong> Go to Sign In or Sign Up to create an account</p>
          )}
          {user && !profile && (
            <p className="text-red-600">❌ <strong>Issue:</strong> Profile not created. Database trigger may have failed.</p>
          )}
          {user && profile && !profile.default_tenant_id && (
            <p>✅ <strong>Step 2:</strong> Go to Onboarding to set up your salon</p>
          )}
          {user && profile && profile.default_tenant_id && !tenant && (
            <p className="text-red-600">❌ <strong>Issue:</strong> Tenant reference exists but tenant not found</p>
          )}
          {user && profile && profile.default_tenant_id && tenant && (
            <p className="text-green-600">✅ <strong>All Good:</strong> You can access the dashboard</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
