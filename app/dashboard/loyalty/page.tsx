'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Users, Award, TrendingUp, Gift, Star, Settings, 
  Trophy, Crown, Zap, ArrowUp 
} from 'lucide-react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils/currency';

interface LoyaltyStats {
  totalMembers: number;
  activeMembers: number;
  totalPointsIssued: number;
  totalPointsRedeemed: number;
  tierDistribution: {
    bronze: number;
    silver: number;
    gold: number;
    platinum: number;
  };
}

interface LoyaltyConfig {
  id: string;
  is_active: boolean;
  program_name: string;
  points_per_rupee: number;
  points_per_visit: number;
  birthday_bonus_points: number;
  referral_bonus_points: number;
  silver_threshold: number;
  gold_threshold: number;
  platinum_threshold: number;
  silver_points_multiplier: number;
  gold_points_multiplier: number;
  platinum_points_multiplier: number;
  min_points_redemption: number;
  points_to_rupee_value: number;
  max_redemption_percent: number;
  enable_points_expiry: boolean;
  points_expiry_months: number;
}

interface TopMember {
  client_name: string;
  email: string;
  phone: string;
  tier: string;
  points_balance: number;
  lifetime_points: number;
  total_visits: number;
  total_spent: number;
}

export default function LoyaltyProgramPage() {
  const [tenantId, setTenantId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<LoyaltyStats | null>(null);
  const [config, setConfig] = useState<LoyaltyConfig | null>(null);
  const [topMembers, setTopMembers] = useState<TopMember[]>([]);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
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

      // Load loyalty config
      const { data: configData } = await supabase
        .from('loyalty_program_config')
        .select('*')
        .eq('tenant_id', tid)
        .single();

      if (configData) {
        setConfig(configData);
      }

      // Load loyalty accounts for stats
      const { data: accounts } = await supabase
        .from('loyalty_accounts')
        .select('tier, points_balance, lifetime_points, total_visits, total_spent')
        .eq('tenant_id', tid);

      if (accounts) {
        const activeMembers = accounts.filter(a => a.points_balance > 0).length;
        
        const tierDist = {
          bronze: accounts.filter(a => a.tier === 'BRONZE').length,
          silver: accounts.filter(a => a.tier === 'SILVER').length,
          gold: accounts.filter(a => a.tier === 'GOLD').length,
          platinum: accounts.filter(a => a.tier === 'PLATINUM').length,
        };

        const totalPoints = accounts.reduce((sum, a) => sum + (a.lifetime_points || 0), 0);
        const totalRedeemed = accounts.reduce((sum, a) => sum + (a.lifetime_points || 0) - (a.points_balance || 0), 0);

        setStats({
          totalMembers: accounts.length,
          activeMembers,
          totalPointsIssued: totalPoints,
          totalPointsRedeemed: totalRedeemed,
          tierDistribution: tierDist,
        });
      }

      // Load top members
      const { data: topData } = await supabase
        .from('loyalty_accounts')
        .select(`
          points_balance,
          lifetime_points,
          total_visits,
          total_spent,
          tier,
          client:clients(full_name, email, phone)
        `)
        .eq('tenant_id', tid)
        .order('lifetime_points', { ascending: false })
        .limit(10);

      if (topData) {
        const formatted = topData.map((item: any) => ({
          client_name: item.client?.full_name || 'Unknown',
          email: item.client?.email || '',
          phone: item.client?.phone || '',
          tier: item.tier,
          points_balance: item.points_balance || 0,
          lifetime_points: item.lifetime_points || 0,
          total_visits: item.total_visits || 0,
          total_spent: item.total_spent || 0,
        }));
        setTopMembers(formatted);
      }
    } catch (error) {
      console.error('Error loading loyalty data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveConfig() {
    if (!config || !tenantId) return;

    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('loyalty_program_config')
        .update({
          is_active: config.is_active,
          program_name: config.program_name,
          points_per_rupee: config.points_per_rupee,
          points_per_visit: config.points_per_visit,
          birthday_bonus_points: config.birthday_bonus_points,
          referral_bonus_points: config.referral_bonus_points,
          silver_threshold: config.silver_threshold,
          gold_threshold: config.gold_threshold,
          platinum_threshold: config.platinum_threshold,
          silver_points_multiplier: config.silver_points_multiplier,
          gold_points_multiplier: config.gold_points_multiplier,
          platinum_points_multiplier: config.platinum_points_multiplier,
          min_points_redemption: config.min_points_redemption,
          points_to_rupee_value: config.points_to_rupee_value,
          max_redemption_percent: config.max_redemption_percent,
          enable_points_expiry: config.enable_points_expiry,
          points_expiry_months: config.points_expiry_months,
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId);

      if (error) throw error;

      alert('Loyalty program settings saved successfully!');
      setShowSettings(false);
      loadData();
    } catch (error) {
      console.error('Error saving config:', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'PLATINUM':
        return <Crown className="h-5 w-5 text-purple-600" />;
      case 'GOLD':
        return <Trophy className="h-5 w-5 text-yellow-600" />;
      case 'SILVER':
        return <Star className="h-5 w-5 text-gray-400" />;
      default:
        return <Award className="h-5 w-5 text-orange-600" />;
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'PLATINUM':
        return 'bg-purple-100 text-purple-800';
      case 'GOLD':
        return 'bg-yellow-100 text-yellow-800';
      case 'SILVER':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-orange-100 text-orange-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading loyalty program...</p>
        </div>
      </div>
    );
  }

  if (showSettings && config) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Loyalty Program Settings</h1>
            <p className="text-muted-foreground">Configure your rewards program</p>
          </div>
          <Button variant="outline" onClick={() => setShowSettings(false)}>
            Back to Overview
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Program Configuration</CardTitle>
            <CardDescription>Customize how customers earn and redeem points</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic Settings */}
            <div className="space-y-4">
              <h3 className="font-semibold">Basic Settings</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="program_name">Program Name</Label>
                  <Input
                    id="program_name"
                    value={config.program_name}
                    onChange={(e) => setConfig({ ...config, program_name: e.target.value })}
                  />
                </div>
                <div className="flex items-center space-x-2 pt-8">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={config.is_active}
                    onChange={(e) => setConfig({ ...config, is_active: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="is_active" className="cursor-pointer">
                    Program Active
                  </Label>
                </div>
              </div>
            </div>

            {/* Earning Rules */}
            <div className="space-y-4">
              <h3 className="font-semibold">Points Earning Rules</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="points_per_rupee">Points per Rupee Spent</Label>
                  <Input
                    id="points_per_rupee"
                    type="number"
                    step="0.01"
                    value={config.points_per_rupee}
                    onChange={(e) => setConfig({ ...config, points_per_rupee: parseFloat(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Customer earns this many points for every ₹1 spent
                  </p>
                </div>
                <div>
                  <Label htmlFor="points_per_visit">Points per Visit</Label>
                  <Input
                    id="points_per_visit"
                    type="number"
                    value={config.points_per_visit}
                    onChange={(e) => setConfig({ ...config, points_per_visit: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="birthday_bonus">Birthday Bonus Points</Label>
                  <Input
                    id="birthday_bonus"
                    type="number"
                    value={config.birthday_bonus_points}
                    onChange={(e) => setConfig({ ...config, birthday_bonus_points: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="referral_bonus">Referral Bonus Points</Label>
                  <Input
                    id="referral_bonus"
                    type="number"
                    value={config.referral_bonus_points}
                    onChange={(e) => setConfig({ ...config, referral_bonus_points: parseInt(e.target.value) })}
                  />
                </div>
              </div>
            </div>

            {/* Tier Thresholds */}
            <div className="space-y-4">
              <h3 className="font-semibold">Membership Tiers (Lifetime Points Required)</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor="silver_threshold">Silver Tier</Label>
                  <Input
                    id="silver_threshold"
                    type="number"
                    value={config.silver_threshold}
                    onChange={(e) => setConfig({ ...config, silver_threshold: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="gold_threshold">Gold Tier</Label>
                  <Input
                    id="gold_threshold"
                    type="number"
                    value={config.gold_threshold}
                    onChange={(e) => setConfig({ ...config, gold_threshold: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="platinum_threshold">Platinum Tier</Label>
                  <Input
                    id="platinum_threshold"
                    type="number"
                    value={config.platinum_threshold}
                    onChange={(e) => setConfig({ ...config, platinum_threshold: parseInt(e.target.value) })}
                  />
                </div>
              </div>
            </div>

            {/* Tier Multipliers */}
            <div className="space-y-4">
              <h3 className="font-semibold">Tier Points Multipliers</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor="silver_mult">Silver (e.g., 1.00 = 100%)</Label>
                  <Input
                    id="silver_mult"
                    type="number"
                    step="0.01"
                    value={config.silver_points_multiplier}
                    onChange={(e) => setConfig({ ...config, silver_points_multiplier: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="gold_mult">Gold (e.g., 1.25 = 125%)</Label>
                  <Input
                    id="gold_mult"
                    type="number"
                    step="0.01"
                    value={config.gold_points_multiplier}
                    onChange={(e) => setConfig({ ...config, gold_points_multiplier: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="platinum_mult">Platinum (e.g., 1.50 = 150%)</Label>
                  <Input
                    id="platinum_mult"
                    type="number"
                    step="0.01"
                    value={config.platinum_points_multiplier}
                    onChange={(e) => setConfig({ ...config, platinum_points_multiplier: parseFloat(e.target.value) })}
                  />
                </div>
              </div>
            </div>

            {/* Redemption Rules */}
            <div className="space-y-4">
              <h3 className="font-semibold">Redemption Rules</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor="min_redemption">Minimum Points to Redeem</Label>
                  <Input
                    id="min_redemption"
                    type="number"
                    value={config.min_points_redemption}
                    onChange={(e) => setConfig({ ...config, min_points_redemption: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="points_value">Points to Rupee Value</Label>
                  <Input
                    id="points_value"
                    type="number"
                    step="0.01"
                    value={config.points_to_rupee_value}
                    onChange={(e) => setConfig({ ...config, points_to_rupee_value: parseFloat(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    100 points = ₹{(100 * config.points_to_rupee_value).toFixed(2)}
                  </p>
                </div>
                <div>
                  <Label htmlFor="max_percent">Max Bill Redemption %</Label>
                  <Input
                    id="max_percent"
                    type="number"
                    value={config.max_redemption_percent}
                    onChange={(e) => setConfig({ ...config, max_redemption_percent: parseInt(e.target.value) })}
                  />
                </div>
              </div>
            </div>

            {/* Expiration */}
            <div className="space-y-4">
              <h3 className="font-semibold">Points Expiration</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="enable_expiry"
                    checked={config.enable_points_expiry}
                    onChange={(e) => setConfig({ ...config, enable_points_expiry: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="enable_expiry" className="cursor-pointer">
                    Enable Points Expiration
                  </Label>
                </div>
                {config.enable_points_expiry && (
                  <div>
                    <Label htmlFor="expiry_months">Points Valid for (Months)</Label>
                    <Input
                      id="expiry_months"
                      type="number"
                      value={config.points_expiry_months}
                      onChange={(e) => setConfig({ ...config, points_expiry_months: parseInt(e.target.value) })}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowSettings(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveConfig} disabled={saving}>
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Loyalty Program</h1>
          <p className="text-muted-foreground">
            {config?.program_name || 'Rewards Program'} • {config?.is_active ? 'Active' : 'Inactive'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/loyalty/rewards">
            <Button variant="outline">
              <Gift className="mr-2 h-4 w-4" />
              Manage Rewards
            </Button>
          </Link>
          <Link href="/dashboard/loyalty/members">
            <Button variant="outline">
              <Users className="mr-2 h-4 w-4" />
              View Members
            </Button>
          </Link>
          <Button onClick={() => setShowSettings(true)}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalMembers || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.activeMembers || 0} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Points Issued</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.totalPointsIssued.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Lifetime total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Points Redeemed</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.totalPointsRedeemed.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats && stats.totalPointsIssued > 0
                ? `${((stats.totalPointsRedeemed / stats.totalPointsIssued) * 100).toFixed(1)}% redemption rate`
                : '0% redemption rate'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reward Value</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(((stats?.totalPointsRedeemed || 0) * (config?.points_to_rupee_value || 0.5)))}
            </div>
            <p className="text-xs text-muted-foreground">
              Total rewards given
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tier Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Membership Tiers</CardTitle>
          <CardDescription>Distribution of members across tiers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-100 rounded-lg">
                <Award className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Bronze</p>
                <p className="text-2xl font-bold">{stats?.tierDistribution.bronze || 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gray-100 rounded-lg">
                <Star className="h-6 w-6 text-gray-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Silver</p>
                <p className="text-2xl font-bold">{stats?.tierDistribution.silver || 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Trophy className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Gold</p>
                <p className="text-2xl font-bold">{stats?.tierDistribution.gold || 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Crown className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Platinum</p>
                <p className="text-2xl font-bold">{stats?.tierDistribution.platinum || 0}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Members */}
      <Card>
        <CardHeader>
          <CardTitle>Top Loyalty Members</CardTitle>
          <CardDescription>Customers with highest lifetime points</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {topMembers.length > 0 ? (
              topMembers.map((member, index) => (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-muted-foreground">#{index + 1}</span>
                      {getTierIcon(member.tier)}
                    </div>
                    <div>
                      <p className="font-semibold">{member.client_name}</p>
                      <p className="text-sm text-muted-foreground">{member.phone}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getTierColor(
                          member.tier
                        )}`}
                      >
                        {member.tier}
                      </span>
                    </div>
                    <p className="font-bold mt-1">{member.points_balance.toLocaleString()} pts</p>
                    <p className="text-sm text-muted-foreground">
                      {member.lifetime_points.toLocaleString()} lifetime • {member.total_visits} visits •{' '}
                      {formatCurrency(member.total_spent)} spent
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">No loyalty members yet</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Program Info */}
      {config && (
        <Card>
          <CardHeader>
            <CardTitle>Program Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 text-sm">
              <div>
                <p className="font-semibold mb-2">Earning</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• {config.points_per_rupee} points per ₹1 spent</li>
                  <li>• {config.points_per_visit} points per visit</li>
                  <li>• {config.birthday_bonus_points} birthday bonus</li>
                  <li>• {config.referral_bonus_points} referral bonus</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold mb-2">Redemption</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Min {config.min_points_redemption} points to redeem</li>
                  <li>• 100 points = {formatCurrency(100 * config.points_to_rupee_value)}</li>
                  <li>• Max {config.max_redemption_percent}% of bill</li>
                  <li>
                    • {config.enable_points_expiry
                      ? `Points expire after ${config.points_expiry_months} months`
                      : 'Points never expire'}
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
