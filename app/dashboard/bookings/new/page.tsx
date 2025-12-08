'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';

interface Client {
  id: string;
  full_name: string;
  phone: string;
}

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  base_price: number;
  category_id: string;
}

interface Staff {
  id: string;
  display_name: string;
  user_id: string;
}

interface Branch {
  id: string;
  name: string;
}

interface BookingItem {
  service_id: string;
  staff_id: string;
  price: number;
}

export default function NewBookingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [tenantId, setTenantId] = useState<string>('');

  const [formData, setFormData] = useState({
    client_id: '',
    branch_id: '',
    scheduled_date: '',
    scheduled_time: '',
    notes: '',
    status: 'PENDING',
  });

  const [bookingItems, setBookingItems] = useState<BookingItem[]>([
    { service_id: '', staff_id: '', price: 0 },
  ]);

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

    // Load clients
    const { data: clientsData } = await supabase
      .from('clients')
      .select('id, full_name, phone')
      .eq('tenant_id', tid)
      .order('full_name');
    setClients(clientsData || []);

    // Load services
    const { data: servicesData } = await supabase
      .from('services')
      .select('id, name, duration_minutes, base_price, category_id')
      .eq('tenant_id', tid)
      .eq('is_active', true)
      .order('name');
    setServices(servicesData || []);

    // Load staff
    const { data: staffData } = await supabase
      .from('staff')
      .select('id, display_name, user_id')
      .eq('tenant_id', tid)
      .eq('is_active', true)
      .order('display_name');
    setStaff(staffData || []);

    // Load branches
    const { data: branchesData } = await supabase
      .from('branches')
      .select('id, name')
      .eq('tenant_id', tid)
      .eq('is_active', true)
      .order('name');
    setBranches(branchesData || []);

    // Set default branch
    if (branchesData && branchesData.length > 0) {
      setFormData((prev) => ({ ...prev, branch_id: branchesData[0].id }));
    }
  }

  function addBookingItem() {
    setBookingItems([...bookingItems, { service_id: '', staff_id: '', price: 0 }]);
  }

  function removeBookingItem(index: number) {
    if (bookingItems.length === 1) return;
    setBookingItems(bookingItems.filter((_, i) => i !== index));
  }

  function updateBookingItem(index: number, field: keyof BookingItem, value: any) {
    const updated = [...bookingItems];
    updated[index] = { ...updated[index], [field]: value };

    // Auto-fill price when service is selected
    if (field === 'service_id') {
      const service = services.find((s) => s.id === value);
      if (service) {
        updated[index].price = service.base_price;
      }
    }

    setBookingItems(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const supabase = createClient();

      // Validate
      if (!formData.branch_id || !formData.scheduled_date || !formData.scheduled_time) {
        alert('Please fill in all required fields');
        setLoading(false);
        return;
      }

      if (bookingItems.some((item) => !item.service_id || !item.staff_id)) {
        alert('Please select service and staff for all items');
        setLoading(false);
        return;
      }

      // Calculate total duration and create timestamps
      const totalDuration = bookingItems.reduce((sum, item) => sum + (item.duration_minutes || 0), 0);
      const scheduledStart = new Date(`${formData.scheduled_date}T${formData.scheduled_time}`);
      const scheduledEnd = new Date(scheduledStart.getTime() + totalDuration * 60000);

      // Create booking
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          tenant_id: tenantId,
          branch_id: formData.branch_id,
          client_id: formData.client_id || null,
          scheduled_start: scheduledStart.toISOString(),
          scheduled_end: scheduledEnd.toISOString(),
          status: formData.status,
          notes: formData.notes,
        })
        .select()
        .single();

      if (bookingError) throw bookingError;

      // Create booking items
      const itemsToInsert = bookingItems.map((item) => ({
        tenant_id: tenantId,
        booking_id: booking.id,
        service_id: item.service_id,
        staff_id: item.staff_id,
        duration_minutes: item.duration_minutes || 60,
        price: item.price || 0,
      }));

      const { error: itemsError } = await supabase.from('booking_items').insert(itemsToInsert);

      if (itemsError) {
        console.error('Items error:', itemsError);
        throw new Error(itemsError.message || 'Failed to create booking items');
      }

      alert('Booking created successfully!');
      router.push('/dashboard/bookings');
      router.refresh();
    } catch (error: any) {
      console.error('Error creating booking:', error);
      alert(error?.message || 'Failed to create booking. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/bookings">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Booking</h1>
          <p className="text-muted-foreground">Create a new appointment</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="client_id">Client (Optional)</Label>
                  <select
                    id="client_id"
                    value={formData.client_id}
                    onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Walk-in Customer</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.full_name} - {client.phone}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="branch_id">Branch *</Label>
                  <select
                    id="branch_id"
                    value={formData.branch_id}
                    onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Select Branch</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scheduled_date">Date *</Label>
                  <Input
                    id="scheduled_date"
                    type="date"
                    value={formData.scheduled_date}
                    onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scheduled_time">Time *</Label>
                  <Input
                    id="scheduled_time"
                    type="time"
                    value={formData.scheduled_time}
                    onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="PENDING">Pending</option>
                    <option value="CONFIRMED">Confirmed</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any special requests or notes..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Services & Staff */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Services & Staff</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addBookingItem}>
                <Plus className="mr-2 h-4 w-4" />
                Add Service
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {bookingItems.map((item, index) => (
                <div key={index} className="grid gap-4 md:grid-cols-4 border-b pb-4 last:border-0">
                  <div className="space-y-2">
                    <Label>Service *</Label>
                    <select
                      value={item.service_id}
                      onChange={(e) => updateBookingItem(index, 'service_id', e.target.value)}
                      required
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Select Service</option>
                      {services.map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.name} ({service.duration_minutes} min)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>Staff *</Label>
                    <select
                      value={item.staff_id}
                      onChange={(e) => updateBookingItem(index, 'staff_id', e.target.value)}
                      required
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Select Staff</option>
                      {staff.map((staffMember) => (
                        <option key={staffMember.id} value={staffMember.id}>
                          {staffMember.display_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>Price</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.price || ''}
                      onChange={(e) => updateBookingItem(index, 'price', parseFloat(e.target.value) || 0)}
                      required
                    />
                  </div>

                  <div className="space-y-2 flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeBookingItem(index)}
                      disabled={bookingItems.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              <div className="pt-4 border-t">
                <div className="flex justify-between items-center text-lg font-semibold">
                  <span>Total Amount:</span>
                  <span>
                    ₹{bookingItems.reduce((sum, item) => sum + (item.price || 0), 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <Link href="/dashboard/bookings">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Booking'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
