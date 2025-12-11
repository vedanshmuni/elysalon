'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Search, Award, Star, Trophy, Crown } from 'lucide-react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils/currency';

interface LoyaltyMember {
  id: string;
  client_id: string;
  client_name: string;
  email: string;
  phone: string;
  tier: string;
  points_balance: number;
  lifetime_points: number;
  total_visits: number;
  total_spent: number;
  last_updated_at: string;
}

export default function LoyaltyMembersPage() {
  const [tenantId, setTenantId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<LoyaltyMember[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<LoyaltyMember[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('ALL');

  useEffect(() => {
    loadMembers();
  }, []);

  useEffect(() => {
    filterMembers();
  }, [searchTerm, tierFilter, members]);

  async function loadMembers() {
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

      const { data: loyaltyData } = await supabase
        .from('loyalty_accounts')
        .select(`
          id,
          client_id,
          tier,
          points_balance,
          lifetime_points,
          total_visits,
          total_spent,
          last_updated_at,
          client:clients(full_name, email, phone)
        `)
        .eq('tenant_id', tid)
        .order('lifetime_points', { ascending: false });

      if (loyaltyData) {
        const formatted: LoyaltyMember[] = loyaltyData.map((item: any) => ({
          id: item.id,
          client_id: item.client_id,
          client_name: item.client?.full_name || 'Unknown',
          email: item.client?.email || '',
          phone: item.client?.phone || '',
          tier: item.tier,
          points_balance: item.points_balance || 0,
          lifetime_points: item.lifetime_points || 0,
          total_visits: item.total_visits || 0,
          total_spent: item.total_spent || 0,
          last_updated_at: item.last_updated_at,
        }));
        setMembers(formatted);
      }
    } catch (error) {
      console.error('Error loading members:', error);
    } finally {
      setLoading(false);
    }
  }

  function filterMembers() {
    let filtered = [...members];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (m) =>
          m.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          m.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          m.phone.includes(searchTerm)
      );
    }

    // Tier filter
    if (tierFilter !== 'ALL') {
      filtered = filtered.filter((m) => m.tier === tierFilter);
    }

    setFilteredMembers(filtered);
  }

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'PLATINUM':
        return <Crown className="h-4 w-4 text-purple-600" />;
      case 'GOLD':
        return <Trophy className="h-4 w-4 text-yellow-600" />;
      case 'SILVER':
        return <Star className="h-4 w-4 text-gray-400" />;
      default:
        return <Award className="h-4 w-4 text-orange-600" />;
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
          <p className="mt-4 text-muted-foreground">Loading members...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/loyalty">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Loyalty Members</h1>
            <p className="text-muted-foreground">{members.length} total members</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="px-4 py-2 border rounded-md"
            >
              <option value="ALL">All Tiers</option>
              <option value="BRONZE">Bronze</option>
              <option value="SILVER">Silver</option>
              <option value="GOLD">Gold</option>
              <option value="PLATINUM">Platinum</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Members Table */}
      <Card>
        <CardHeader>
          <CardTitle>Members ({filteredMembers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead className="text-right">Points Balance</TableHead>
                <TableHead className="text-right">Lifetime Points</TableHead>
                <TableHead className="text-right">Visits</TableHead>
                <TableHead className="text-right">Total Spent</TableHead>
                <TableHead>Last Activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.length > 0 ? (
                filteredMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{member.client_name}</p>
                        <p className="text-sm text-muted-foreground">{member.phone}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${getTierColor(
                          member.tier
                        )}`}
                      >
                        {getTierIcon(member.tier)}
                        {member.tier}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {member.points_balance.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {member.lifetime_points.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">{member.total_visits}</TableCell>
                    <TableCell className="text-right">{formatCurrency(member.total_spent)}</TableCell>
                    <TableCell>
                      {new Date(member.last_updated_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No members found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
