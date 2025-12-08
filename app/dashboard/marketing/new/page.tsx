'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Mail, MessageSquare, Phone as PhoneIcon } from 'lucide-react';
import Link from 'next/link';

export default function NewCampaignPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [tenantId, setTenantId] = useState<string>('');
  const [clientCount, setClientCount] = useState(0);

  const [formData, setFormData] = useState({
    campaign_name: '',
    campaign_type: 'promotional',
    channel: 'Email',
    status: 'Draft',
    scheduled_at: '',
    message_template: '',
    target_segment: 'all',
    segment_filter: '',
  });

  useEffect(() => {
    loadTenant();
  }, []);

  useEffect(() => {
    calculateTargetClients();
  }, [formData.target_segment, formData.segment_filter]);

  async function loadTenant() {
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

    if (profile?.default_tenant_id) {
      setTenantId(profile.default_tenant_id);
    }
  }

  async function calculateTargetClients() {
    if (!tenantId) return;

    const supabase = createClient();
    let query = supabase.from('clients').select('id', { count: 'exact' }).eq('tenant_id', tenantId);

    // Apply segmentation filters
    if (formData.target_segment === 'active') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      query = query.gte('last_visit_at', thirtyDaysAgo.toISOString());
    } else if (formData.target_segment === 'inactive') {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      query = query.lt('last_visit_at', ninetyDaysAgo.toISOString());
    } else if (formData.target_segment === 'birthday') {
      const today = new Date();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      // This is a simplified version - proper implementation would need more complex date logic
      query = query.ilike('date_of_birth', `%-${month}-%`);
    } else if (formData.target_segment === 'consent_email') {
      query = query.eq('consent_marketing', true);
    } else if (formData.target_segment === 'consent_whatsapp') {
      query = query.eq('consent_whatsapp', true);
    }

    const { count } = await query;
    setClientCount(count || 0);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.from('marketing_campaigns').insert({
        tenant_id: tenantId,
        campaign_name: formData.campaign_name,
        campaign_type: formData.campaign_type,
        channel: formData.channel,
        status: formData.status,
        scheduled_at: formData.scheduled_at || null,
        message_template: formData.message_template,
        target_segment: formData.target_segment,
        segment_filter: formData.segment_filter || null,
      });

      if (error) throw error;

      router.push('/dashboard/marketing');
      router.refresh();
    } catch (error: any) {
      console.error('Error creating campaign:', error);
      alert(error.message || 'Failed to create campaign');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/marketing">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Campaign</h1>
          <p className="text-muted-foreground">Create a new marketing campaign</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="campaign_name">Campaign Name *</Label>
                  <Input
                    id="campaign_name"
                    value={formData.campaign_name}
                    onChange={(e) => setFormData({ ...formData, campaign_name: e.target.value })}
                    placeholder="e.g., Summer Discount Campaign"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="campaign_type">Campaign Type</Label>
                  <select
                    id="campaign_type"
                    value={formData.campaign_type}
                    onChange={(e) => setFormData({ ...formData, campaign_type: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="promotional">Promotional</option>
                    <option value="seasonal">Seasonal</option>
                    <option value="birthday">Birthday</option>
                    <option value="referral">Referral</option>
                    <option value="loyalty">Loyalty</option>
                    <option value="retention">Retention</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="channel">Channel *</Label>
                  <select
                    id="channel"
                    value={formData.channel}
                    onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    required
                  >
                    <option value="Email">Email</option>
                    <option value="SMS">SMS</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Push">Push Notification</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Scheduled">Scheduled</option>
                    <option value="Active">Active (Send Now)</option>
                  </select>
                </div>
              </div>

              {formData.status === 'Scheduled' && (
                <div className="space-y-2">
                  <Label htmlFor="scheduled_at">Schedule Date & Time</Label>
                  <Input
                    id="scheduled_at"
                    type="datetime-local"
                    value={formData.scheduled_at}
                    onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Message Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="message_template">Message Template *</Label>
                <Textarea
                  id="message_template"
                  value={formData.message_template}
                  onChange={(e) =>
                    setFormData({ ...formData, message_template: e.target.value })
                  }
                  placeholder={
                    formData.channel === 'Email'
                      ? 'Enter your email content...'
                      : formData.channel === 'SMS'
                      ? 'Keep it under 160 characters...'
                      : 'Enter your message...'
                  }
                  rows={6}
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Use variables: {'{name}'}, {'{salon_name}'}, {'{discount}'}
                </p>
              </div>

              {formData.channel === 'SMS' && (
                <div className="p-3 bg-blue-50 rounded-md">
                  <p className="text-sm text-blue-800">
                    <span className="font-semibold">Character Count:</span>{' '}
                    {formData.message_template.length} / 160
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Target Audience</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="target_segment">Client Segment</Label>
                <select
                  id="target_segment"
                  value={formData.target_segment}
                  onChange={(e) => setFormData({ ...formData, target_segment: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="all">All Clients</option>
                  <option value="active">Active Clients (last 30 days)</option>
                  <option value="inactive">Inactive Clients (90+ days)</option>
                  <option value="birthday">Birthday This Month</option>
                  <option value="consent_email">Email Consent Only</option>
                  <option value="consent_whatsapp">WhatsApp Consent Only</option>
                </select>
              </div>

              <div className="p-4 bg-green-50 rounded-md">
                <p className="text-sm text-green-800">
                  <span className="font-semibold">Estimated Reach:</span> {clientCount} clients
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="segment_filter">Additional Filters (Optional)</Label>
                <Textarea
                  id="segment_filter"
                  value={formData.segment_filter}
                  onChange={(e) => setFormData({ ...formData, segment_filter: e.target.value })}
                  placeholder="e.g., tags:vip, total_spend>5000"
                  rows={2}
                />
                <p className="text-sm text-muted-foreground">
                  Advanced filtering using client attributes
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-4 mt-6">
          <Link href="/dashboard/marketing">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={loading}>
            {loading
              ? 'Creating...'
              : formData.status === 'Active'
              ? 'Create & Send'
              : 'Create Campaign'}
          </Button>
        </div>
      </form>
    </div>
  );
}
