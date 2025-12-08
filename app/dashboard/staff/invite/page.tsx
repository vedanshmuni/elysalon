'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function InviteStaffPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'MANAGER' | 'STAFF'>('STAFF');
  const [branchId, setBranchId] = useState('');
  const [branches, setBranches] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const supabase = createClient();
    
    try {
      // Get user's tenant
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
        setBranchId(branchesData[0].id);
      }

      // Load existing invitations
      const { data: invitationsData } = await supabase
        .from('tenant_invitations')
        .select(`
          *,
          invited_by_profile:profiles!tenant_invitations_invited_by_fkey(full_name)
        `)
        .eq('tenant_id', profile.default_tenant_id)
        .order('created_at', { ascending: false });

      setInvitations(invitationsData || []);
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError('Failed to load data');
    } finally {
      setLoadingData(false);
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    setInviteUrl(null);

    const supabase = createClient();

    try {
      if (!tenantId) throw new Error('No tenant selected');
      if (!email.trim()) throw new Error('Email is required');
      if (!branchId) throw new Error('Please select a branch');

      // Call the database function to create invitation
      const { data, error: rpcError } = await supabase.rpc('create_staff_invitation', {
        p_tenant_id: tenantId,
        p_email: email.trim().toLowerCase(),
        p_role: role,
        p_branch_id: branchId,
        p_expires_in_days: 7,
      });

      if (rpcError) {
        console.error('RPC Error:', rpcError);
        throw new Error(rpcError.message || rpcError.hint || 'Failed to create invitation');
      }

      if (!data) {
        throw new Error('No data returned from invitation creation');
      }

      if (!data.success) {
        throw new Error('Invitation creation failed');
      }

      // Generate the invite URL with your actual domain
      const baseUrl = window.location.origin;
      const fullInviteUrl = `${baseUrl}/signup?invite=${data.token}`;

      setSuccess(`Invitation sent to ${email}!`);
      setInviteUrl(fullInviteUrl);
      setEmail('');
      
      // Reload invitations
      await loadData();
    } catch (err: any) {
      console.error('Invitation error:', err);
      const errorMessage = err?.message || err?.hint || err?.details || 'Failed to send invitation. Please make sure the database migrations are applied.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const copyInviteUrl = () => {
    if (inviteUrl) {
      navigator.clipboard.writeText(inviteUrl);
      setSuccess('Invite link copied to clipboard!');
    }
  };

  const resendInvitation = async (invitationId: string, inviteEmail: string) => {
    const supabase = createClient();
    
    try {
      // Delete old invitation
      await supabase
        .from('tenant_invitations')
        .delete()
        .eq('id', invitationId);

      // Create new one
      setEmail(inviteEmail);
      // Form will handle the rest
    } catch (err: any) {
      setError('Failed to resend invitation');
    }
  };

  const cancelInvitation = async (invitationId: string) => {
    const supabase = createClient();
    
    try {
      const { error } = await supabase
        .from('tenant_invitations')
        .update({ status: 'cancelled' })
        .eq('id', invitationId);

      if (error) throw error;

      setSuccess('Invitation cancelled');
      await loadData();
    } catch (err: any) {
      setError('Failed to cancel invitation');
    }
  };

  if (loadingData) {
    return (
      <div className="p-8">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Invite Staff Members</h1>
        <p className="text-muted-foreground">
          Send invitations to new staff members. They'll receive an email with a link to join your salon.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Invitation Form */}
        <Card>
          <CardHeader>
            <CardTitle>Send New Invitation</CardTitle>
            <CardDescription>
              Invite a new staff member to join your team
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="staff@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select value={role} onValueChange={(val: any) => setRole(val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STAFF">Staff</SelectItem>
                    <SelectItem value="MANAGER">Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="branch">Assign to Branch *</Label>
                <Select value={branchId} onValueChange={setBranchId}>
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

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded text-sm">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-3 bg-green-50 border border-green-200 text-green-800 rounded text-sm">
                  {success}
                </div>
              )}

              {inviteUrl && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                  <p className="text-sm font-medium mb-2">Invitation Link:</p>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={inviteUrl}
                      className="text-xs"
                    />
                    <Button
                      type="button"
                      onClick={copyInviteUrl}
                      variant="outline"
                      size="sm"
                    >
                      Copy
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Share this link with the staff member. It expires in 7 days.
                  </p>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Sending...' : 'Send Invitation'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Pending Invitations */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Invitations</CardTitle>
            <CardDescription>
              Track invitations you've sent
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {invitations.filter(inv => inv.status === 'pending').length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No pending invitations
                </p>
              ) : (
                invitations
                  .filter(inv => inv.status === 'pending')
                  .map((invitation) => (
                    <div
                      key={invitation.id}
                      className="p-3 border rounded-lg space-y-2"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-sm">{invitation.email}</p>
                          <p className="text-xs text-muted-foreground">
                            Role: {invitation.role}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Expires: {new Date(invitation.expires_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => cancelInvitation(invitation.id)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Invitations History */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Invitation History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {invitations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No invitations sent yet
              </p>
            ) : (
              invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex justify-between items-center p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium text-sm">{invitation.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {invitation.role} • {invitation.status} • 
                      {' '}{new Date(invitation.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    invitation.status === 'accepted' ? 'bg-green-100 text-green-800' :
                    invitation.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {invitation.status}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
