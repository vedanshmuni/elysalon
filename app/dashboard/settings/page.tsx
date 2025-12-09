'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Building, MapPin, DollarSign, Clock, Save } from 'lucide-react';

export default function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const [tenantId, setTenantId] = useState<string>('');
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    gst_number: '',
    timezone: 'Asia/Kolkata',
    currency: 'INR',
    whatsapp_number: '',
  });

  const [branches, setBranches] = useState<any[]>([]);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
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

    // Load tenant data
    const { data: tenant } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tid)
      .single();

    if (tenant) {
      setFormData({
        name: tenant.name || '',
        phone: tenant.phone || '',
        address: tenant.address || '',
        gst_number: tenant.gst_number || '',
        timezone: tenant.timezone || 'Asia/Kolkata',
        currency: tenant.currency || 'INR',
        whatsapp_number: tenant.whatsapp_number || '',
      });
    }

    // Load branches
    const { data: branchesData } = await supabase
      .from('branches')
      .select('*')
      .eq('tenant_id', tid)
      .order('name');

    setBranches(branchesData || []);
  }

  async function handleSave() {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('tenants')
        .update({
          name: formData.name,
          phone: formData.phone,
          address: formData.address,
          gst_number: formData.gst_number,
          timezone: formData.timezone,
          currency: formData.currency,
          whatsapp_number: formData.whatsapp_number,
        })
        .eq('id', tenantId);
        .eq('id', tenantId);

      if (error) throw error;
      alert('Settings saved successfully!');
    } catch (error: any) {
      console.error('Error saving settings:', error);
      alert(error.message || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your salon configuration</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Salon Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Salon Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Salon Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Your Salon Name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+91 1234567890"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Salon address"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gst_number">GST Number</Label>
              <Input
                id="gst_number"
                value={formData.gst_number}
                onChange={(e) => setFormData({ ...formData, gst_number: e.target.value })}
                placeholder="22AAAAA0000A1Z5"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp_number">WhatsApp Business Number</Label>
              <Input
                id="whatsapp_number"
                value={formData.whatsapp_number}
                onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
                placeholder="+91 1234567890"
              />
              <p className="text-xs text-muted-foreground">
                This number will receive booking requests and send automated messages to customers. Must be registered with WhatsApp Business API.
              </p>
            </div>
          </CardContent>
        </Card>dContent>
        </Card>

        {/* Regional Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Regional Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <select
                id="timezone"
                value={formData.timezone}
                onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                <option value="America/New_York">America/New_York (EST)</option>
                <option value="Europe/London">Europe/London (GMT)</option>
                <option value="Asia/Dubai">Asia/Dubai (GST)</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <select
                id="currency"
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="AED">AED (د.إ)</option>
              </select>
            </div>

            <Button onClick={handleSave} disabled={loading} className="w-full">
              <Save className="mr-2 h-4 w-4" />
              {loading ? 'Saving...' : 'Save Settings'}
            </Button>
          </CardContent>
        </Card>

        {/* Branches */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Branches ({branches.length})
              </CardTitle>
              <Button size="sm">Add Branch</Button>
            </div>
          </CardHeader>
          <CardContent>
            {branches.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {branches.map((branch: any) => (
                  <Card key={branch.id}>
                    <CardHeader>
                      <CardTitle className="text-base">{branch.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Code:</span> {branch.code}
                      </div>
                      {branch.phone && (
                        <div>
                          <span className="text-muted-foreground">Phone:</span> {branch.phone}
                        </div>
                      )}
                      {branch.address && (
                        <div>
                          <span className="text-muted-foreground">Address:</span> {branch.address}
                        </div>
                      )}
                      <div>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                            branch.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {branch.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No branches configured. Add your first branch to get started.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
