'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Plus, Trash2, DollarSign } from 'lucide-react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils/currency';

export default function CommissionRulesPage() {
  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string>('');
  const [rules, setRules] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [newRule, setNewRule] = useState({
    rule_name: '',
    applies_to: 'SERVICE_CATEGORY',
    target_category_id: '',
    rate_type: 'PERCENT',
    rate_value: 0,
    min_transaction_amount: 0,
    max_transaction_amount: null,
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

    // Load commission rules
    const { data: rulesData } = await supabase
      .from('commission_rules')
      .select(
        `
        *,
        category:service_categories(name)
      `
      )
      .eq('tenant_id', tid)
      .order('created_at', { ascending: false });

    setRules(rulesData || []);

    // Load service categories
    const { data: categoriesData } = await supabase
      .from('service_categories')
      .select('id, name')
      .eq('tenant_id', tid)
      .eq('is_active', true)
      .order('name');

    setCategories(categoriesData || []);
    setLoading(false);
  }

  async function handleCreateRule(e: React.FormEvent) {
    e.preventDefault();

    try {
      const supabase = createClient();

      const { error } = await supabase.from('commission_rules').insert({
        tenant_id: tenantId,
        rule_name: newRule.rule_name,
        applies_to: newRule.applies_to,
        target_category_id: newRule.target_category_id || null,
        rate_type: newRule.rate_type,
        rate_value: newRule.rate_value,
        min_transaction_amount: newRule.min_transaction_amount || 0,
        max_transaction_amount: newRule.max_transaction_amount || null,
        is_active: true,
      });

      if (error) throw error;

      setShowCreateModal(false);
      setNewRule({
        rule_name: '',
        applies_to: 'SERVICE_CATEGORY',
        target_category_id: '',
        rate_type: 'PERCENT',
        rate_value: 0,
        min_transaction_amount: 0,
        max_transaction_amount: null,
      });
      loadData();
    } catch (error: any) {
      console.error('Error creating rule:', error);
      alert(error.message || 'Failed to create rule');
    }
  }

  async function handleDeleteRule(ruleId: string) {
    if (!confirm('Are you sure you want to delete this commission rule?')) return;

    try {
      const supabase = createClient();
      const { error } = await supabase.from('commission_rules').delete().eq('id', ruleId);

      if (error) throw error;

      loadData();
    } catch (error: any) {
      console.error('Error deleting rule:', error);
      alert(error.message || 'Failed to delete rule');
    }
  }

  async function toggleRuleStatus(ruleId: string, currentStatus: boolean) {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('commission_rules')
        .update({ is_active: !currentStatus })
        .eq('id', ruleId);

      if (error) throw error;

      loadData();
    } catch (error: any) {
      console.error('Error updating rule:', error);
      alert(error.message || 'Failed to update rule');
    }
  }

  function formatRateDisplay(rule: any) {
    if (rule.rate_type === 'PERCENT') {
      return `${rule.rate_value}%`;
    } else {
      return formatCurrency(rule.rate_value);
    }
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/staff">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Commission Rules</h1>
            <p className="text-muted-foreground">Configure commission structure for staff</p>
          </div>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Rule
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Rules</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rules.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {rules.filter((r) => r.is_active).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Percentage Based</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {rules.filter((r) => r.rate_type === 'PERCENT').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rules Table */}
      <Card>
        <CardHeader>
          <CardTitle>Commission Rules</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule Name</TableHead>
                <TableHead>Applies To</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Min Amount</TableHead>
                <TableHead>Max Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.length > 0 ? (
                rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">{rule.rule_name}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800">
                        {rule.applies_to.replace('_', ' ')}
                      </span>
                    </TableCell>
                    <TableCell>{rule.category?.name || 'All'}</TableCell>
                    <TableCell className="font-semibold">{formatRateDisplay(rule)}</TableCell>
                    <TableCell>
                      {rule.min_transaction_amount
                        ? formatCurrency(rule.min_transaction_amount)
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {rule.max_transaction_amount
                        ? formatCurrency(rule.max_transaction_amount)
                        : 'No Limit'}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => toggleRuleStatus(rule.id, rule.is_active)}
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium cursor-pointer ${
                          rule.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {rule.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteRule(rule.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No commission rules found. Create your first rule to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-50">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-2">How Commission Rules Work</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
            <li>
              <span className="font-medium">Percentage:</span> Staff earns a percentage of the
              transaction amount (e.g., 10% of ₹1000 = ₹100)
            </li>
            <li>
              <span className="font-medium">Fixed Amount:</span> Staff earns a fixed amount per
              transaction (e.g., ₹50 per service)
            </li>
            <li>
              <span className="font-medium">Service Category:</span> Rules apply to all services
              in the selected category
            </li>
            <li>
              <span className="font-medium">Product Category:</span> Rules apply to all products
              in the selected category
            </li>
            <li>
              Min/Max amounts can be used to create tiered commission structures
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Create Rule Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl m-4">
            <CardHeader>
              <CardTitle>Create Commission Rule</CardTitle>
            </CardHeader>
            <form onSubmit={handleCreateRule}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="rule_name">Rule Name *</Label>
                  <Input
                    id="rule_name"
                    value={newRule.rule_name}
                    onChange={(e) => setNewRule({ ...newRule, rule_name: e.target.value })}
                    placeholder="e.g., Hair Services Commission"
                    required
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="applies_to">Applies To</Label>
                    <select
                      id="applies_to"
                      value={newRule.applies_to}
                      onChange={(e) => setNewRule({ ...newRule, applies_to: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="SERVICE_CATEGORY">Service Category</option>
                      <option value="PRODUCT_CATEGORY">Product Category</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="target_category_id">Category</Label>
                    <select
                      id="target_category_id"
                      value={newRule.target_category_id}
                      onChange={(e) =>
                        setNewRule({ ...newRule, target_category_id: e.target.value })
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">All Categories</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rate_type">Rate Type *</Label>
                    <select
                      id="rate_type"
                      value={newRule.rate_type}
                      onChange={(e) => setNewRule({ ...newRule, rate_type: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      required
                    >
                      <option value="PERCENT">Percentage (%)</option>
                      <option value="FIXED">Fixed Amount (₹)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rate_value">
                      Rate Value * {newRule.rate_type === 'PERCENT' ? '(%)' : '(₹)'}
                    </Label>
                    <Input
                      id="rate_value"
                      type="number"
                      min="0"
                      step="0.01"
                      value={newRule.rate_value}
                      onChange={(e) =>
                        setNewRule({ ...newRule, rate_value: parseFloat(e.target.value) })
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="min_transaction_amount">Min Transaction Amount (₹)</Label>
                    <Input
                      id="min_transaction_amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={newRule.min_transaction_amount}
                      onChange={(e) =>
                        setNewRule({
                          ...newRule,
                          min_transaction_amount: parseFloat(e.target.value),
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="max_transaction_amount">Max Transaction Amount (₹)</Label>
                    <Input
                      id="max_transaction_amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={newRule.min_transaction_amount || ''}
                      onChange={(e) =>
                        setNewRule({
                          ...newRule,
                          min_transaction_amount: e.target.value
                            ? parseFloat(e.target.value)
                            : (null as any),
                        })
                      }
                      placeholder="Leave empty for no limit"
                    />
                  </div>
                </div>

                {newRule.rate_type === 'PERCENT' && newRule.rate_value > 0 && (
                  <div className="p-3 bg-green-50 rounded-md">
                    <p className="text-sm text-green-800">
                      <span className="font-semibold">Example:</span> On a ₹1,000 transaction,
                      staff will earn ₹{((newRule.rate_value / 100) * 1000).toFixed(2)}
                    </p>
                  </div>
                )}

                {newRule.rate_type === 'FIXED' && newRule.rate_value > 0 && (
                  <div className="p-3 bg-green-50 rounded-md">
                    <p className="text-sm text-green-800">
                      <span className="font-semibold">Example:</span> Staff will earn{' '}
                      {formatCurrency(newRule.rate_value)} per transaction
                    </p>
                  </div>
                )}
              </CardContent>
              <div className="flex justify-end gap-4 p-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Create Rule</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
