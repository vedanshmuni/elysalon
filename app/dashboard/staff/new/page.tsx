'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface Branch {
  id: string;
  name: string;
}

export default function NewStaffPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [tenantId, setTenantId] = useState<string>('');

  const [formData, setFormData] = useState({
    full_name: '',
    display_name: '',
    role_label: 'Stylist',
    branch_id: '',
    skills: '',
    target_revenue: 0,
    target_retail: 0,
    is_active: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('default_tenant_id')
      .eq('id', user.id)
      .single();

    const tid = profile?.default_tenant_id;
    if (!tid) return;
    setTenantId(tid);

    const { data: branchesData } = await supabase
      .from('branches')
      .select('id, name')
      .eq('tenant_id', tid)
      .eq('is_active', true)
      .order('name');

    setBranches(branchesData || []);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const supabase = createClient();

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Parse skills array
      const skillsArray = formData.skills
        ? formData.skills.split(',').map((s) => s.trim())
        : [];

      // Create staff record without user_id (staff not registered yet)
      const { error: staffError } = await supabase
        .from('staff')
        .insert({
          tenant_id: tenantId,
          user_id: null, // No user account yet
          display_name: formData.display_name || formData.full_name,
          role_label: formData.role_label,
          branch_id: formData.branch_id || null,
          skills: skillsArray,
          target_revenue: formData.target_revenue || null,
          target_retail: formData.target_retail || null,
          is_active: formData.is_active,
        });

      if (staffError) {
        console.error('Error adding staff:', staffError);
        throw new Error(staffError.message);
      }

      alert('Staff member added successfully!');
      router.push('/dashboard/staff');
      router.refresh();
    } catch (error: any) {
      console.error('Error adding staff:', error);
      alert(error.message || 'Failed to add staff member');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/staff">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Add Staff Member</h1>
          <p className="text-muted-foreground">Add a new team member to your salon</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-blue-900 mb-2">💡 Need to give them system access?</h3>
        <p className="text-sm text-blue-800 mb-2">
          This will add the staff member for scheduling and tracking. To give them login access, use <strong>Invite Staff</strong> instead.
        </p>
        <Link href="/dashboard/staff/invite">
          <Button type="button" variant="outline" size="sm">
            Go to Invite Staff
          </Button>
        </Link>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Staff Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name *</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="John Doe"
                  required
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
                <p className="text-xs text-muted-foreground">
                  Name shown to clients
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role_label">Role *</Label>
                <select
                  id="role_label"
                  value={formData.role_label}
                  onChange={(e) => setFormData({ ...formData, role_label: e.target.value })}
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="Stylist">Stylist</option>
                  <option value="Beautician">Beautician</option>
                  <option value="Massage Therapist">Massage Therapist</option>
                  <option value="Nail Technician">Nail Technician</option>
                  <option value="Manager">Manager</option>
                  <option value="Receptionist">Receptionist</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="branch_id">Assigned Branch</Label>
                <select
                  id="branch_id"
                  value={formData.branch_id}
                  onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">All Branches</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="skills">Skills (comma-separated)</Label>
              <Input
                id="skills"
                value={formData.skills}
                onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                placeholder="Haircut, Coloring, Styling"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="target_revenue">Monthly Revenue Target (₹)</Label>
                <Input
                  id="target_revenue"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.target_revenue || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, target_revenue: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="target_retail">Monthly Retail Target (₹)</Label>
                <Input
                  id="target_retail"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.target_retail || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, target_retail: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="is_active" className="cursor-pointer">
                Staff member is active
              </Label>
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={loading}>
                {loading ? 'Adding...' : 'Add Staff Member'}
              </Button>
              <Link href="/dashboard/staff">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
