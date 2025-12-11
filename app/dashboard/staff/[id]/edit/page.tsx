'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Link2, UserCheck, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface Branch {
  id: string;
  name: string;
}

interface UnlinkedUser {
  user_id: string;
  email: string;
  full_name: string;
  role: string;
}

export default function EditStaffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [staff, setStaff] = useState<any>(null);
  const [unlinkedUsers, setUnlinkedUsers] = useState<UnlinkedUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  const [formData, setFormData] = useState({
    display_name: '',
    role_label: '',
    branch_id: '',
    skills: '',
    target_service_revenue: 0,
    target_retail_revenue: 0,
    is_active: true,
  });

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('default_tenant_id')
      .eq('id', user.id)
      .single();

    const tenantId = profile?.default_tenant_id;
    if (!tenantId) return;

    // Load staff (without users join that causes 400 error)
    const { data: staffData } = await supabase
      .from('staff')
      .select('*')
      .eq('id', id)
      .single();

    console.log('Staff data loaded:', { id: staffData?.id, display_name: staffData?.display_name, user_id: staffData?.user_id });

    if (staffData) {
      // If staff has user_id, fetch email from profiles
      if (staffData.user_id) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', staffData.user_id)
          .single();
        
        console.log('Profile data for user_id:', staffData.user_id, '→', profileData);
        
        if (profileData) {
          staffData.user_email = profileData.email;
        }
      }

      setStaff(staffData);
      setFormData({
        display_name: staffData.display_name || '',
        role_label: staffData.role_label || '',
        branch_id: staffData.branch_id || '',
        skills: staffData.skills || '',
        target_service_revenue: staffData.target_service_revenue || 0,
        target_retail_revenue: staffData.target_retail_revenue || 0,
        is_active: staffData.is_active,
      });
    }

    // Load branches
    const { data: branchesData } = await supabase
      .from('branches')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('name');

    setBranches(branchesData || []);

    // If staff has no user_id, load unlinked users
    if (!staffData?.user_id) {
      const { data: tenantUsers } = await supabase
        .from('tenant_users')
        .select('user_id, role')
        .eq('tenant_id', tenantId);

      if (tenantUsers && tenantUsers.length > 0) {
        const { data: linkedStaff } = await supabase
          .from('staff')
          .select('user_id')
          .eq('tenant_id', tenantId)
          .not('user_id', 'is', null);

        const linkedUserIds = new Set((linkedStaff || []).map(s => s.user_id));
        
        const unlinkedUserIds = tenantUsers
          .filter(tu => !linkedUserIds.has(tu.user_id))
          .map(tu => ({ user_id: tu.user_id, role: tu.role }));

        if (unlinkedUserIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, email, full_name')
            .in('id', unlinkedUserIds.map(u => u.user_id));

          const unlinked = unlinkedUserIds.map(u => {
            const prof = profiles?.find(p => p.id === u.user_id);
            return {
              user_id: u.user_id,
              email: prof?.email || 'Unknown',
              full_name: prof?.full_name || 'Unknown',
              role: u.role,
            };
          });

          setUnlinkedUsers(unlinked);
        }
      }
    }
  }

  async function handleLinkUser() {
    if (!selectedUserId || !staff) return;
    
    setLinking(true);
    try {
      const supabase = createClient();
      
      const { error } = await supabase
        .from('staff')
        .update({ user_id: selectedUserId })
        .eq('id', staff.id);

      if (error) throw error;

      alert('User account linked successfully!');
      loadData();
    } catch (error: any) {
      console.error('Error linking user:', error);
      alert(error.message || 'Failed to link user account');
    } finally {
      setLinking(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from('staff')
        .update({
          display_name: formData.display_name,
          role_label: formData.role_label,
          branch_id: formData.branch_id || null,
          skills: formData.skills || null,
          target_service_revenue: formData.target_service_revenue,
          target_retail_revenue: formData.target_retail_revenue,
          is_active: formData.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      router.push(`/dashboard/staff/${id}`);
      router.refresh();
    } catch (error: any) {
      console.error('Error updating staff:', error);
      alert(error.message || 'Failed to update staff');
    } finally {
      setLoading(false);
    }
  }

  if (!staff) {
    return <div className="flex items-center justify-center min-h-[400px]">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/staff/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Staff Member</h1>
          <p className="text-muted-foreground">Update staff information</p>
        </div>
      </div>

      {/* Link User Account Card */}
      {!staff.user_id && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-800">
              <AlertCircle className="h-5 w-5" />
              Account Not Linked
            </CardTitle>
            <CardDescription className="text-yellow-700">
              This staff member doesn&apos;t have a login account linked. They won&apos;t be able to clock in/out or access the system.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {unlinkedUsers.length > 0 ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Select a user account to link:</Label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Select a user...</option>
                    {unlinkedUsers.map((user) => (
                      <option key={user.user_id} value={user.user_id}>
                        {user.full_name} ({user.email}) - {user.role}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  type="button"
                  onClick={handleLinkUser}
                  disabled={!selectedUserId || linking}
                  className="bg-yellow-600 hover:bg-yellow-700"
                >
                  <Link2 className="mr-2 h-4 w-4" />
                  {linking ? 'Linking...' : 'Link Account'}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-yellow-700">
                No unlinked user accounts found. Users need to sign up first, or you can create a new staff account from the{' '}
                <Link href="/dashboard/staff/create-account" className="underline font-medium">
                  Create Staff Account
                </Link>{' '}
                page.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Linked Account Info */}
      {staff.user_id && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <UserCheck className="h-5 w-5" />
              Account Linked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-green-700">
              This staff member is linked to: <strong>{staff.user_email || 'Unknown email'}</strong>
            </p>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="display_name">Display Name *</Label>
                  <Input
                    id="display_name"
                    value={formData.display_name}
                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                    placeholder="Name shown to clients"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role_label">Role *</Label>
                  <select
                    id="role_label"
                    value={formData.role_label}
                    onChange={(e) => setFormData({ ...formData, role_label: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    required
                  >
                    <option value="">Select Role</option>
                    <option value="Manager">Manager</option>
                    <option value="Senior Stylist">Senior Stylist</option>
                    <option value="Stylist">Stylist</option>
                    <option value="Junior Stylist">Junior Stylist</option>
                    <option value="Receptionist">Receptionist</option>
                    <option value="Beautician">Beautician</option>
                    <option value="Therapist">Therapist</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="branch_id">Branch</Label>
                  <select
                    id="branch_id"
                    value={formData.branch_id}
                    onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">No Assignment</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Email (Read-only)</Label>
                  <Input value={staff.user_email || 'Not linked'} disabled />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="skills">Skills (comma-separated)</Label>
                <Textarea
                  id="skills"
                  value={formData.skills}
                  onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                  placeholder="e.g., Haircut, Coloring, Styling, Facial, Massage"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Performance Targets</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="target_service_revenue">Target Service Revenue (₹)</Label>
                  <Input
                    id="target_service_revenue"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.target_service_revenue}
                    onChange={(e) => setFormData({ ...formData, target_service_revenue: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="target_retail_revenue">Target Retail Revenue (₹)</Label>
                  <Input
                    id="target_retail_revenue"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.target_retail_revenue}
                    onChange={(e) => setFormData({ ...formData, target_retail_revenue: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="is_active" className="cursor-pointer">
                  Staff member is active and can be assigned to bookings
                </Label>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-4 mt-6">
          <Link href={`/dashboard/staff/${id}`}>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}
