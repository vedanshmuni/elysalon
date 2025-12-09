'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Send, Users, MessageSquare, Check, X, Loader2, Image as ImageIcon } from 'lucide-react';

export default function BroadcastsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [tenantId, setTenantId] = useState<string>('');
  const [clientCount, setClientCount] = useState(0);
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [loadingBroadcasts, setLoadingBroadcasts] = useState(true);

  const [formData, setFormData] = useState({
    title: '',
    message: '',
    broadcast_type: 'offer', // offer, announcement, event
    target_type: 'all', // all, active, inactive, consent_whatsapp
    image_url: '',
  });

  useEffect(() => {
    loadTenant();
    loadBroadcasts();
  }, []);

  useEffect(() => {
    calculateTargetClients();
  }, [formData.target_type, tenantId]);

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

  async function loadBroadcasts() {
    try {
      const response = await fetch('/api/broadcasts');
      if (response.ok) {
        const data = await response.json();
        setBroadcasts(data.broadcasts || []);
      }
    } catch (error) {
      console.error('Error loading broadcasts:', error);
    } finally {
      setLoadingBroadcasts(false);
    }
  }

  async function calculateTargetClients() {
    if (!tenantId) return;

    const supabase = createClient();
    let query = supabase
      .from('clients')
      .select('id', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .not('phone', 'is', null);

    // Apply filters
    if (formData.target_type === 'active') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      query = query.gte('last_visit_at', thirtyDaysAgo.toISOString());
    } else if (formData.target_type === 'inactive') {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      query = query.lt('last_visit_at', ninetyDaysAgo.toISOString());
    } else if (formData.target_type === 'consent_whatsapp') {
      query = query.eq('consent_whatsapp', true);
    }

    const { count } = await query;
    setClientCount(count || 0);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.title || !formData.message) {
        alert('Please fill in title and message');
        return;
      }

      const response = await fetch('/api/broadcasts/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send broadcast');
      }

      const result = await response.json();
      alert(`Broadcast sent successfully to ${result.targetCount} clients!`);
      
      // Reset form
      setFormData({
        title: '',
        message: '',
        broadcast_type: 'offer',
        target_type: 'all',
        image_url: '',
      });

      // Reload broadcasts
      loadBroadcasts();
    } catch (error: any) {
      console.error('Error sending broadcast:', error);
      alert(error.message || 'Failed to send broadcast');
    } finally {
      setLoading(false);
    }
  }

  const statusColors: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    SENDING: 'bg-blue-100 text-blue-800',
    COMPLETED: 'bg-green-100 text-green-800',
    FAILED: 'bg-red-100 text-red-800',
    CANCELLED: 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">WhatsApp Broadcasts</h1>
          <p className="text-muted-foreground">Send offers and announcements to your clients</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Broadcasts</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{broadcasts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <Check className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {broadcasts.filter((b) => b.status === 'COMPLETED').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sending</CardTitle>
            <Loader2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {broadcasts.filter((b) => b.status === 'SENDING').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Target Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clientCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Create Broadcast Form */}
      <Card>
        <CardHeader>
          <CardTitle>Create New Broadcast</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Special Weekend Offer"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="broadcast_type">Broadcast Type</Label>
                <select
                  id="broadcast_type"
                  value={formData.broadcast_type}
                  onChange={(e) => setFormData({ ...formData, broadcast_type: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                >
                  <option value="offer">Special Offer</option>
                  <option value="announcement">Announcement</option>
                  <option value="event">Event</option>
                  <option value="marketing">Marketing</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message *</Label>
              <Textarea
                id="message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Enter your message here..."
                rows={6}
                required
              />
              <p className="text-sm text-muted-foreground">
                Keep it short and engaging. Include offer details or event information.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="target_type">Target Audience</Label>
                <select
                  id="target_type"
                  value={formData.target_type}
                  onChange={(e) => setFormData({ ...formData, target_type: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                >
                  <option value="all">All Clients with Phone</option>
                  <option value="active">Active Clients (last 30 days)</option>
                  <option value="inactive">Inactive Clients (90+ days)</option>
                  <option value="consent_whatsapp">WhatsApp Consent Only</option>
                </select>
                <p className="text-sm text-green-600 font-medium">
                  Target: {clientCount} clients
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="image_url">Image URL (Optional)</Label>
                <Input
                  id="image_url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  placeholder="https://example.com/image.jpg"
                />
                <p className="text-sm text-muted-foreground">
                  Publicly accessible image URL
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setFormData({
                    title: '',
                    message: '',
                    broadcast_type: 'offer',
                    target_type: 'all',
                    image_url: '',
                  });
                }}
              >
                Clear
              </Button>
              <Button type="submit" disabled={loading || clientCount === 0}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Broadcast
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Broadcast History */}
      <Card>
        <CardHeader>
          <CardTitle>Broadcast History</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingBroadcasts ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : broadcasts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No broadcasts sent yet. Create your first broadcast above!
            </div>
          ) : (
            <div className="space-y-4">
              {broadcasts.map((broadcast) => (
                <div
                  key={broadcast.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <h3 className="font-medium">{broadcast.title}</h3>
                      {broadcast.image_url && (
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {broadcast.message.substring(0, 100)}
                      {broadcast.message.length > 100 ? '...' : ''}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span>
                        {new Date(broadcast.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span>Target: {broadcast.target_count}</span>
                      <span className="text-green-600">Sent: {broadcast.sent_count}</span>
                      {broadcast.failed_count > 0 && (
                        <span className="text-red-600">Failed: {broadcast.failed_count}</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                        statusColors[broadcast.status] || 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {broadcast.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
