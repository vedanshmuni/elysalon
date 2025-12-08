'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface Branch {
  id: string;
  name: string;
}

export default function CreateStaffAccountPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [tenantId, setTenantId] = useState<string>('');

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    display_name: '',
    role: 'STAFF' as 'STAFF' | 'MANAGER',
    branch_id: '',
    phone: '',
    role_label: 'Stylist',
  });

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{email: string, password: string} | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const supabase = createClient();
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/signin');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('default_tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile?.default_tenant_id) {
        router.push('/onboarding');
        return;
      }

      setTenantId(profile.default_tenant_id);

      // Load branches
      const { data: branchesData } = await supabase
        .from('branches')
        .select('*')
        .eq('tenant_id', profile.default_tenant_id)
        .order('name');

      setBranches(branchesData || []);
      if (branchesData && branchesData.length > 0) {
        setFormData(prev => ({ ...prev, branch_id: branchesData[0].id }));
      }
    } catch (err: any) {
      setError('Failed to load data');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const supabase = createClient();

      if (!tenantId) throw new Error('No tenant found');
      if (!formData.email || !formData.password) throw new Error('Email and password are required');
      if (formData.password.length < 6) throw new Error('Password must be at least 6 characters');

      // Get current session token for API auth
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Call the API to create staff account
      const response = await fetch('/api/staff/create-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          tenantId,
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          fullName: formData.full_name,
          role: formData.role,
          branchId: formData.branch_id || null,
          displayName: formData.display_name || formData.full_name,
          phone: formData.phone || null,
          roleLabel: formData.role_label,
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to create staff account');
      }

      // Store credentials to show to user
      setCreatedCredentials({
        email: formData.email,
        password: formData.password,
      });

      setSuccess(true);
      
      // Reset form
      setFormData({
        full_name: '',
        email: '',
        password: '',
        display_name: '',
        role: 'STAFF',
        branch_id: branches[0]?.id || '',
        phone: '',
        role_label: 'Stylist',
      });

    } catch (err: any) {
      console.error('Error creating staff account:', err);
      setError(err.message || 'Failed to create staff account');
    } finally {
      setLoading(false);
    }
  }

  if (success && createdCredentials) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/staff">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Staff Account Created!</h1>
          </div>
        </div>

        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-900">✅ Account Created Successfully</CardTitle>
            <CardDescription>Share these credentials with the staff member</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-white rounded border space-y-3">
              <div>
                <Label className="text-sm font-semibold">Email / Username</Label>
                <p className="text-lg font-mono mt-1">{createdCredentials.email}</p>
              </div>
              <div>
                <Label className="text-sm font-semibold">Password</Label>
                <p className="text-lg font-mono mt-1">{createdCredentials.password}</p>
              </div>
            </div>

            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
              <p className="font-semibold text-yellow-900">⚠️ Important:</p>
              <ul className="mt-2 space-y-1 text-yellow-800 list-disc list-inside">
                <li>Save these credentials - they won't be shown again</li>
                <li>Share securely with the staff member</li>
                <li>Ask them to change password after first login</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <Button 
                onClick={() => {
                  navigator.clipboard.writeText(
                    `Login Credentials:\nEmail: ${createdCredentials.email}\nPassword: ${createdCredentials.password}\nLogin at: ${window.location.origin}/signin`
                  );
                  alert('Credentials copied to clipboard!');
                }}
              >
                Copy Credentials
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setSuccess(false);
                  setCreatedCredentials(null);
                }}
              >
                Create Another Staff
              </Button>
              <Link href="/dashboard/staff">
                <Button variant="outline">
                  Back to Staff List
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/staff">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Staff Account</h1>
          <p className="text-muted-foreground">Create a login account for a new staff member</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>
            This will create a login account that you can share with the staff member
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name *</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                  placeholder="John Doe"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="display_name">Display Name</Label>
                <Input
                  id="display_name"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  placeholder="Leave empty to use full name"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email (Login Username) *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  placeholder="staff@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="text"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={6}
                  placeholder="Min 6 characters"
                />
                <p className="text-xs text-muted-foreground">
                  You'll share this with the staff member
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role_label">Role/Position</Label>
                <Input
                  id="role_label"
                  value={formData.role_label}
                  onChange={(e) => setFormData({ ...formData, role_label: e.target.value })}
                  placeholder="Stylist, Beautician, etc."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role">System Role *</Label>
                <Select 
                  value={formData.role} 
                  onValueChange={(val: any) => setFormData({ ...formData, role: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STAFF">Staff (Can view and manage bookings)</SelectItem>
                    <SelectItem value="MANAGER">Manager (Full access)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="branch_id">Branch *</Label>
                <Select 
                  value={formData.branch_id} 
                  onValueChange={(val) => setFormData({ ...formData, branch_id: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                <p className="font-semibold">Error:</p>
                <p>{error}</p>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={loading}>
                {loading ? 'Creating Account...' : 'Create Staff Account'}
              </Button>
              <Link href="/dashboard/staff">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <h3 className="font-semibold text-blue-900 mb-2">💡 How it works:</h3>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>Creates a login account for the staff member</li>
            <li>You get the email and password to share with them</li>
            <li>They can login at <code className="bg-blue-100 px-1 rounded">/signin</code></li>
            <li>They'll have access based on their role (Staff or Manager)</li>
            <li>They can view calendar, bookings, and clients</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
