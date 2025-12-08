'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function CalendarSettingsPage() {
  const [loading, setLoading] = useState(false);
  const [tenantId, setTenantId] = useState<string>('');
  const [settings, setSettings] = useState({
    time_slot_interval: 15,
    time_format: '12h',
    allow_double_booking: false,
    auto_freeze_confirmed: true,
    default_reminder_hours: 24,
    working_hours_start: '09:00',
    working_hours_end: '18:00',
  });

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('default_tenant_id')
      .eq('id', user.id)
      .single();

    const tid = profile?.default_tenant_id;
    if (!tid) return;
    setTenantId(tid);

    // Load existing settings
    const { data: existingSettings } = await supabase
      .from('calendar_settings')
      .select('*')
      .eq('tenant_id', tid)
      .single();

    if (existingSettings) {
      setSettings({
        time_slot_interval: existingSettings.time_slot_interval,
        time_format: existingSettings.time_format,
        allow_double_booking: existingSettings.allow_double_booking,
        auto_freeze_confirmed: existingSettings.auto_freeze_confirmed,
        default_reminder_hours: existingSettings.default_reminder_hours,
        working_hours_start: existingSettings.working_hours_start,
        working_hours_end: existingSettings.working_hours_end,
      });
    }
  }

  async function handleSave() {
    setLoading(true);
    try {
      const supabase = createClient();

      const { error } = await supabase
        .from('calendar_settings')
        .upsert({
          tenant_id: tenantId,
          ...settings,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'tenant_id'
        });

      if (error) throw error;
      alert('Calendar settings saved successfully!');
    } catch (error: any) {
      console.error('Error saving settings:', error);
      alert(error.message || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Calendar Settings</h1>
        <p className="text-muted-foreground">Customize your booking calendar</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Time Settings</CardTitle>
          <CardDescription>Configure time intervals and format</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Time Slot Interval</Label>
              <Select
                value={settings.time_slot_interval.toString()}
                onValueChange={(value) => setSettings({ ...settings, time_slot_interval: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 minutes</SelectItem>
                  <SelectItem value="10">10 minutes</SelectItem>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">60 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Time Format</Label>
              <Select
                value={settings.time_format}
                onValueChange={(value) => setSettings({ ...settings, time_format: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12h">12 Hour (AM/PM)</SelectItem>
                  <SelectItem value="24h">24 Hour</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="working_start">Working Hours Start</Label>
              <Input
                id="working_start"
                type="time"
                value={settings.working_hours_start}
                onChange={(e) => setSettings({ ...settings, working_hours_start: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="working_end">Working Hours End</Label>
              <Input
                id="working_end"
                type="time"
                value={settings.working_hours_end}
                onChange={(e) => setSettings({ ...settings, working_hours_end: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Booking Behavior</CardTitle>
          <CardDescription>Control how bookings work</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Allow Double Booking</Label>
              <p className="text-sm text-muted-foreground">
                Allow overlapping appointments to not miss bookings
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.allow_double_booking}
              onChange={(e) => setSettings({ ...settings, allow_double_booking: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-Freeze Confirmed Bookings</Label>
              <p className="text-sm text-muted-foreground">
                Automatically prevent edits to confirmed appointments
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.auto_freeze_confirmed}
              onChange={(e) => setSettings({ ...settings, auto_freeze_confirmed: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reminders</CardTitle>
          <CardDescription>Automated notification settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reminder_hours">Send Reminder Before (hours)</Label>
            <Input
              id="reminder_hours"
              type="number"
              min="1"
              max="168"
              value={settings.default_reminder_hours}
              onChange={(e) => setSettings({ ...settings, default_reminder_hours: parseInt(e.target.value) || 24 })}
            />
            <p className="text-xs text-muted-foreground">
              Default reminder timing for clients and staff
            </p>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={loading}>
        {loading ? 'Saving...' : 'Save Settings'}
      </Button>
    </div>
  );
}
