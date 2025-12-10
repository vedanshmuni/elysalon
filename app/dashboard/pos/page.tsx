'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Search, Receipt } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/currency';
import Link from 'next/link';
import { AccessGuard } from '@/components/auth/AccessGuard';

interface Client {
  id: string;
  full_name: string;
  phone: string;
}

interface Service {
  id: string;
  name: string;
  base_price: number;
  tax_rate: number;
}

interface Product {
  id: string;
  name: string;
  retail_price: number;
  tax_rate: number;
}

interface InvoiceItem {
  type: 'SERVICE' | 'PRODUCT';
  reference_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  discount_amount: number;
  total: number;
  staff_id?: string;
  staff_name?: string;
}

interface Booking {
  id: string;
  scheduled_start: string;
  booking_items: Array<{
    id: string;
    service: {
      id: string;
      name: string;
      base_price: number;
      tax_rate: number;
    };
    staff: {
      id: string;
      display_name: string;
    };
    price: number;
  }>;
}

export default function POSPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [tenantId, setTenantId] = useState<string>('');
  const [branchId, setBranchId] = useState<string>('');
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [clientBookings, setClientBookings] = useState<Booking[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<string>('');

  const [invoiceData, setInvoiceData] = useState({
    client_id: '',
    booking_id: '',
    discount_amount: 0,
    payment_method: 'CASH' as 'CASH' | 'CARD' | 'UPI' | 'WALLET',
  });

  const [items, setItems] = useState<InvoiceItem[]>([]);

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

    // Get default branch
    const { data: branches } = await supabase
      .from('branches')
      .select('id')
      .eq('tenant_id', tid)
      .limit(1);
    if (branches && branches.length > 0) {
      setBranchId(branches[0].id);
    }

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
      .select('id, name, base_price, tax_rate')
      .eq('tenant_id', tid)
      .eq('is_active', true);
    setServices(servicesData || []);

    // Load products
    const { data: productsData } = await supabase
      .from('products')
      .select('id, name, retail_price, tax_rate')
      .eq('tenant_id', tid)
      .eq('is_active', true);
    setProducts(productsData || []);
  }

  async function loadClientBookings(clientId: string) {
    if (!clientId) {
      setClientBookings([]);
      return;
    }

    const supabase = createClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get today's confirmed bookings for this client (ready for payment)
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        id,
        scheduled_start,
        booking_items (
          id,
          price,
          service:services!booking_items_service_id_fkey (
            id,
            name,
            base_price,
            tax_rate
          ),
          staff:staff!booking_items_staff_id_fkey (
            id,
            display_name
          )
        )
      `)
      .eq('client_id', clientId)
      .eq('status', 'CONFIRMED')
      .gte('scheduled_start', today.toISOString())
      .order('scheduled_start', { ascending: false });

    if (error) {
      console.error('Error loading client bookings:', error);
    }

    console.log('Client bookings loaded:', data);
    setClientBookings(data || []);
  }

  function loadBookingItems(bookingId: string) {
    if (!bookingId) {
      setSelectedBooking('');
      setInvoiceData(prev => ({ ...prev, booking_id: '' }));
      return;
    }

    const booking = clientBookings.find(b => b.id === bookingId);
    console.log('Loading booking items for:', bookingId, booking);
    
    if (!booking) {
      console.error('Booking not found:', bookingId);
      return;
    }

    if (!booking.booking_items || booking.booking_items.length === 0) {
      console.warn('No booking items found for booking:', bookingId);
      alert('This booking has no services. Please add services manually.');
      setSelectedBooking(bookingId);
      setInvoiceData(prev => ({ ...prev, booking_id: bookingId }));
      return;
    }

    const bookingItems: InvoiceItem[] = booking.booking_items.map(item => ({
      type: 'SERVICE' as const,
      reference_id: item.service?.id || '',
      name: item.service?.name || 'Unknown Service',
      quantity: 1,
      unit_price: item.price,
      tax_rate: item.service?.tax_rate || 18,
      discount_amount: 0,
      total: item.price,
      staff_id: item.staff?.id,
      staff_name: item.staff?.display_name
    }));

    console.log('Setting booking items:', bookingItems);
    setItems(bookingItems);
    setSelectedBooking(bookingId);
    setInvoiceData(prev => ({ ...prev, booking_id: bookingId }));
  }

  function addService(service: Service) {
    const newItem: InvoiceItem = {
      type: 'SERVICE',
      reference_id: service.id,
      name: service.name,
      quantity: 1,
      unit_price: service.base_price,
      tax_rate: service.tax_rate,
      discount_amount: 0,
      total: service.base_price,
    };
    setItems([...items, newItem]);
  }

  function addProduct(product: Product) {
    const newItem: InvoiceItem = {
      type: 'PRODUCT',
      reference_id: product.id,
      name: product.name,
      quantity: 1,
      unit_price: product.retail_price,
      tax_rate: product.tax_rate,
      discount_amount: 0,
      total: product.retail_price,
    };
    setItems([...items, newItem]);
  }

  function updateItem(index: number, field: keyof InvoiceItem, value: any) {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    
    // Recalculate total
    const subtotal = updated[index].unit_price * updated[index].quantity;
    updated[index].total = subtotal - updated[index].discount_amount;
    
    setItems(updated);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  const subtotal = items.reduce((sum, item) => sum + (item.unit_price || 0) * (item.quantity || 1), 0);
  const totalDiscount =
    items.reduce((sum, item) => sum + (item.discount_amount || 0), 0) + (invoiceData.discount_amount || 0);
  const taxAmount = items.reduce(
    (sum, item) =>
      sum + ((item.unit_price || 0) * (item.quantity || 1) - (item.discount_amount || 0)) * ((item.tax_rate || 0) / 100),
    0
  );
  const grandTotal = subtotal - totalDiscount + taxAmount;

  async function handleCheckout() {
    if (items.length === 0) {
      alert('Please add items to the invoice');
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      // Generate invoice number
      const invoiceNumber = `INV-${Date.now()}`;

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          tenant_id: tenantId,
          branch_id: branchId,
          booking_id: invoiceData.booking_id || null,
          client_id: invoiceData.client_id || null,
          invoice_number: invoiceNumber,
          status: 'PAID',
          subtotal: subtotal,
          tax_amount: taxAmount,
          discount_amount: totalDiscount,
          total: grandTotal,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create invoice items
      const itemsToInsert = items.map((item) => ({
        tenant_id: tenantId,
        invoice_id: invoice.id,
        type: item.type,
        reference_id: item.reference_id,
        name: item.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
        discount_amount: item.discount_amount,
        total: item.total,
      }));

      const { error: itemsError } = await supabase.from('invoice_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      // Create payment
      const { error: paymentError } = await supabase.from('payments').insert({
        tenant_id: tenantId,
        invoice_id: invoice.id,
        method: invoiceData.payment_method,
        amount: grandTotal,
      });

      if (paymentError) throw paymentError;

      // Send invoice via WhatsApp automatically
      const selectedClient = clients.find(c => c.id === invoiceData.client_id);
      if (selectedClient?.phone) {
        // Send in background, don't wait for it
        fetch('/api/invoices/send-whatsapp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invoiceId: invoice.id }),
        }).catch(err => console.error('Failed to send WhatsApp invoice:', err));
        
        alert(`✅ Payment processed!\n\nInvoice is being sent to ${selectedClient.full_name} via WhatsApp.`);
      } else {
        alert('✅ Payment processed successfully!');
      }
      
      // Reset form
      setItems([]);
      setInvoiceData({ client_id: '', discount_amount: 0, payment_method: 'CASH' });
      
      router.refresh();
    } catch (error: any) {
      console.error('Error processing payment:', error);
      alert(error.message || 'Failed to process payment');
    } finally {
      setLoading(false);
    }
  }

  const filteredServices = services.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AccessGuard allowedRoles={['SUPER_ADMIN', 'OWNER', 'MANAGER', 'CASHIER']}>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Point of Sale</h1>
          <p className="text-muted-foreground">Process payments and manage invoices</p>
        </div>
        <Link href="/dashboard/pos/history">
          <Button variant="outline">
            <Receipt className="mr-2 h-4 w-4" />
            Sales History
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left: Services & Products */}
        <div className="md:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Search Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search services or products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Services</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-2">
                {filteredServices.slice(0, 6).map((service) => (
                  <Button
                    key={service.id}
                    variant="outline"
                    className="justify-between h-auto py-3"
                    onClick={() => addService(service)}
                  >
                    <span>{service.name}</span>
                    <span className="font-bold">{formatCurrency(service.base_price)}</span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {products.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Products</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 md:grid-cols-2">
                  {filteredProducts.slice(0, 6).map((product) => (
                    <Button
                      key={product.id}
                      variant="outline"
                      className="justify-between h-auto py-3"
                      onClick={() => addProduct(product)}
                    >
                      <span>{product.name}</span>
                      <span className="font-bold">{formatCurrency(product.retail_price)}</span>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Invoice */}
        <div>
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle>Invoice</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="client_id">Select Client *</Label>
                <select
                  id="client_id"
                  value={invoiceData.client_id}
                  onChange={(e) => {
                    const clientId = e.target.value;
                    setInvoiceData({ ...invoiceData, client_id: clientId, booking_id: '' });
                    setSelectedBooking('');
                    setItems([]);
                    loadClientBookings(clientId);
                  }}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select a client...</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.full_name}
                    </option>
                  ))}
                </select>
              </div>

              {invoiceData.client_id && (
                <div className="space-y-2">
                  <Label htmlFor="booking_id">Today's Booking (Optional)</Label>
                  <select
                    id="booking_id"
                    value={selectedBooking}
                    onChange={(e) => loadBookingItems(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">No booking - add services manually</option>
                    {clientBookings.map((booking) => (
                      <option key={booking.id} value={booking.id}>
                        {new Date(booking.scheduled_start).toLocaleTimeString('en-IN', {
                          timeZone: 'Asia/Kolkata',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true
                        })} - {booking.booking_items.length} service(s)
                      </option>
                    ))}
                  </select>
                  {clientBookings.length === 0 && invoiceData.client_id && (
                    <p className="text-xs text-muted-foreground">No confirmed bookings today</p>
                  )}
                </div>
              )}

              {/* Items List */}
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {items.map((item, index) => (
                  <div key={index} className="p-2 border rounded space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-sm font-medium">{item.name}</span>
                        {item.staff_name && (
                          <p className="text-xs text-muted-foreground">Staff: {item.staff_name}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity || ''}
                        onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                        className="h-8 text-xs"
                        placeholder="Qty"
                      />
                      <Input
                        type="number"
                        step="0.01"
                        value={item.unit_price || ''}
                        onChange={(e) =>
                          updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)
                        }
                        className="h-8 text-xs"
                        placeholder="Price"
                      />
                    </div>
                    <div className="text-right text-sm font-medium">
                      {formatCurrency(item.total)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="space-y-2 border-t pt-4">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Tax:</span>
                  <span>{formatCurrency(taxAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Discount:</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={invoiceData.discount_amount || ''}
                    onChange={(e) =>
                      setInvoiceData({
                        ...invoiceData,
                        discount_amount: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="h-8 w-24 text-right"
                  />
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total:</span>
                  <span>{formatCurrency(grandTotal)}</span>
                </div>
              </div>

              {/* Payment Method */}
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={invoiceData.payment_method === 'CASH' ? 'default' : 'outline'}
                    onClick={() => setInvoiceData({ ...invoiceData, payment_method: 'CASH' })}
                    className="h-12"
                  >
                    Cash
                  </Button>
                  <Button
                    variant={invoiceData.payment_method === 'CARD' ? 'default' : 'outline'}
                    onClick={() => setInvoiceData({ ...invoiceData, payment_method: 'CARD' })}
                    className="h-12"
                  >
                    Card
                  </Button>
                  <Button
                    variant={invoiceData.payment_method === 'UPI' ? 'default' : 'outline'}
                    onClick={() => setInvoiceData({ ...invoiceData, payment_method: 'UPI' })}
                    className="h-12"
                  >
                    UPI
                  </Button>
                  <Button
                    variant={invoiceData.payment_method === 'WALLET' ? 'default' : 'outline'}
                    onClick={() => setInvoiceData({ ...invoiceData, payment_method: 'WALLET' })}
                    className="h-12"
                  >
                    Wallet
                  </Button>
                </div>
              </div>

              <Button
                className="w-full h-12 text-lg"
                onClick={handleCheckout}
                disabled={loading || items.length === 0}
              >
                {loading ? 'Processing...' : `Charge ${formatCurrency(grandTotal)}`}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </AccessGuard>
  );
}

