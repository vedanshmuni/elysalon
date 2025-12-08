'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils/currency';

export default function NewComboPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [tenantId, setTenantId] = useState<string>('');
  const [services, setServices] = useState<any[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    combo_name: '',
    description: '',
    discount_amount: 0,
    is_active: true,
  });

  useEffect(() => {
    loadServices();
  }, []);

  async function loadServices() {
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

    const { data: servicesData } = await supabase
      .from('services')
      .select('*')
      .eq('tenant_id', tid)
      .eq('is_active', true)
      .order('name');

    setServices(servicesData || []);
  }

  function toggleService(serviceId: string) {
    if (selectedServices.includes(serviceId)) {
      setSelectedServices(selectedServices.filter((id) => id !== serviceId));
    } else {
      setSelectedServices([...selectedServices, serviceId]);
    }
  }

  function calculateTotals() {
    const selectedServiceObjects = services.filter((s) => selectedServices.includes(s.id));
    const totalPrice = selectedServiceObjects.reduce((sum, s) => sum + s.base_price, 0);
    const totalDuration = selectedServiceObjects.reduce((sum, s) => sum + s.duration_minutes, 0);
    const finalPrice = totalPrice - formData.discount_amount;

    return {
      totalPrice,
      totalDuration,
      finalPrice,
      savingsPercent: totalPrice > 0 ? ((formData.discount_amount / totalPrice) * 100).toFixed(1) : 0,
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (selectedServices.length < 2) {
      alert('Please select at least 2 services for the combo');
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const totals = calculateTotals();

      // Create combo
      const { data: combo, error: comboError } = await supabase
        .from('service_combos')
        .insert({
          tenant_id: tenantId,
          combo_name: formData.combo_name,
          description: formData.description,
          total_duration_minutes: totals.totalDuration,
          original_price: totals.totalPrice,
          combo_price: totals.finalPrice,
          discount_amount: formData.discount_amount,
          is_active: formData.is_active,
        })
        .select()
        .single();

      if (comboError) throw comboError;

      // Create combo services relationships
      const comboServices = selectedServices.map((serviceId) => ({
        combo_id: combo.id,
        service_id: serviceId,
      }));

      const { error: servicesError } = await supabase
        .from('combo_services')
        .insert(comboServices);

      if (servicesError) throw servicesError;

      router.push('/dashboard/services');
      router.refresh();
    } catch (error: any) {
      console.error('Error creating combo:', error);
      alert(error.message || 'Failed to create combo');
    } finally {
      setLoading(false);
    }
  }

  const totals = calculateTotals();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/services">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Service Combo</h1>
          <p className="text-muted-foreground">Create a combo package with multiple services</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Combo Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="combo_name">Combo Name *</Label>
                <Input
                  id="combo_name"
                  value={formData.combo_name}
                  onChange={(e) => setFormData({ ...formData, combo_name: e.target.value })}
                  placeholder="e.g., Hair & Spa Package"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the combo package..."
                  rows={3}
                />
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
                  Combo is active and available for booking
                </Label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Select Services ({selectedServices.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {services.map((service) => {
                  const isSelected = selectedServices.includes(service.id);
                  return (
                    <div
                      key={service.id}
                      className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-50 border-blue-300'
                          : 'hover:bg-gray-50 border-gray-200'
                      }`}
                      onClick={() => toggleService(service.id)}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleService(service.id)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <div>
                          <p className="font-medium">{service.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {service.duration_minutes} min
                          </p>
                        </div>
                      </div>
                      <p className="font-semibold">{formatCurrency(service.base_price)}</p>
                    </div>
                  );
                })}
              </div>

              {services.length === 0 && (
                <p className="text-center py-8 text-muted-foreground">
                  No services available. Please add services first.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pricing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="discount_amount">Discount Amount (₹) *</Label>
                <Input
                  id="discount_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.discount_amount || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, discount_amount: parseFloat(e.target.value) || 0 })
                  }
                  required
                />
              </div>

              {selectedServices.length > 0 && (
                <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Duration:</span>
                    <span className="font-medium">{totals.totalDuration} minutes</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Original Price:</span>
                    <span className="font-medium">{formatCurrency(totals.totalPrice)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Discount:</span>
                    <span className="font-medium text-red-600">
                      -{formatCurrency(formData.discount_amount)}
                    </span>
                  </div>
                  <div className="flex justify-between text-lg font-bold pt-2 border-t">
                    <span>Final Price:</span>
                    <span className="text-green-600">{formatCurrency(totals.finalPrice)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Savings:</span>
                    <span className="font-medium text-green-600">{totals.savingsPercent}%</span>
                  </div>
                </div>
              )}

              {selectedServices.length === 0 && (
                <div className="p-4 bg-yellow-50 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    Select services above to see pricing details
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-4 mt-6">
          <Link href="/dashboard/services">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={loading || selectedServices.length < 2}>
            {loading ? 'Creating...' : 'Create Combo'}
          </Button>
        </div>
      </form>
    </div>
  );
}
