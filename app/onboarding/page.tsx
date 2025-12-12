'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2 } from 'lucide-react';

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planCode = searchParams.get('plan') || 'TRIAL';
  const isVerified = searchParams.get('verified') === 'true';

  const [salonName, setSalonName] = useState('');
  const [branchName, setBranchName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push('/signin');
      return;
    }

    // Check if already onboarded
    const { data: profile } = await supabase
      .from('profiles')
      .select('default_tenant_id')
      .eq('id', user.id)
      .single();

    if (profile?.default_tenant_id) {
      router.push('/dashboard');
      return;
    }

    setChecking(false);
  }

  const handleOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError('You must be logged in');
      setLoading(false);
      return;
    }

    try {
      // Check if already onboarded
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('default_tenant_id')
        .eq('id', user.id)
        .single();

      if (existingProfile?.default_tenant_id) {
        router.push('/dashboard');
        return;
      }

      // Get user's full name
      const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Owner';

      // Call the database function to complete onboarding
      // This bypasses RLS and creates all records atomically
      const { data, error } = await supabase.rpc('complete_onboarding', {
        p_salon_name: salonName,
        p_branch_name: branchName || 'Main Branch',
        p_phone: phone,
        p_address: address,
        p_user_full_name: fullName,
        p_plan_code: planCode,
      });

      if (error) {
        console.error('Onboarding RPC error:', error);
        throw new Error(error.message || 'Failed to complete onboarding');
      }

      if (!data?.success) {
        throw new Error('Onboarding failed');
      }

      // Refresh the session to pick up new tenant membership
      await supabase.auth.refreshSession();

      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      console.error('Onboarding error:', err);
      setError(err.message || 'Failed to create salon. Please try again.');
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold">Welcome to SalonOS</CardTitle>
            {isVerified && (
              <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                {planCode} Plan
              </Badge>
            )}
          </div>
          <CardDescription>Let's set up your salon business</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleOnboarding} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="salonName">Salon Name *</Label>
              <Input
                id="salonName"
                type="text"
                placeholder="My Beautiful Salon"
                value={salonName}
                onChange={(e) => setSalonName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branchName">Branch Name</Label>
              <Input
                id="branchName"
                type="text"
                placeholder="Main Branch"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Defaults to "Main Branch" if empty</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                placeholder="123 Main Street, City, State"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
              />
            </div>
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating...' : 'Create Salon'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// Loading fallback for Suspense
function OnboardingLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    </div>
  );
}

// Main page component with Suspense boundary
export default function OnboardingPage() {
  return (
    <Suspense fallback={<OnboardingLoading />}>
      <OnboardingContent />
    </Suspense>
  );
}
