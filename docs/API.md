# SalonOS API Documentation

## Authentication

All API requests require authentication via Supabase Auth. The auth token is automatically included in cookies via middleware.

### Endpoints

#### Auth Endpoints (Supabase Auth)

**Sign Up**
- Handled via Supabase client in `/signup` page
- Creates user account and profile

**Sign In**
- Handled via Supabase client in `/signin` page
- Returns JWT tokens in cookies

**Sign Out**
- Calls `supabase.auth.signOut()`
- Clears session cookies

## Data Access Patterns

### Server Components (Recommended)

Server components fetch data directly from Supabase with automatic RLS enforcement:

\`\`\`typescript
import { createClient } from '@/lib/supabase/server';

export default async function ClientsPage() {
  const supabase = await createClient();
  
  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });
    
  return <ClientList clients={clients} />;
}
\`\`\`

### Client Components with React Query

For client-side data fetching and mutations:

\`\`\`typescript
'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

function useClients(tenantId: string) {
  const supabase = createClient();
  
  return useQuery({
    queryKey: ['clients', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('tenant_id', tenantId);
      if (error) throw error;
      return data;
    },
  });
}
\`\`\`

## Core Entities

### Clients

**List Clients**
\`\`\`typescript
const { data } = await supabase
  .from('clients')
  .select('*')
  .eq('tenant_id', tenantId)
  .order('created_at', { ascending: false })
  .range(0, 49); // Pagination
\`\`\`

**Get Client**
\`\`\`typescript
const { data } = await supabase
  .from('clients')
  .select('*, client_notes(*), client_photos(*)')
  .eq('id', clientId)
  .single();
\`\`\`

**Create Client**
\`\`\`typescript
const { data, error } = await supabase
  .from('clients')
  .insert({
    tenant_id: tenantId,
    full_name: 'John Doe',
    phone: '+91 98765 43210',
    email: 'john@example.com',
  })
  .select()
  .single();
\`\`\`

**Update Client**
\`\`\`typescript
const { error } = await supabase
  .from('clients')
  .update({ notes: 'Updated notes' })
  .eq('id', clientId);
\`\`\`

### Bookings

**List Bookings**
\`\`\`typescript
const { data } = await supabase
  .from('bookings')
  .select(\`
    *,
    clients(full_name, phone),
    branches(name),
    booking_items(*, services(name), staff(display_name))
  \`)
  .eq('tenant_id', tenantId)
  .gte('scheduled_start', startDate)
  .lte('scheduled_start', endDate);
\`\`\`

**Create Booking**
\`\`\`typescript
// 1. Create booking
const { data: booking } = await supabase
  .from('bookings')
  .insert({
    tenant_id: tenantId,
    branch_id: branchId,
    client_id: clientId,
    status: 'PENDING',
    scheduled_start: startTime,
    scheduled_end: endTime,
  })
  .select()
  .single();

// 2. Add booking items
const { data: items } = await supabase
  .from('booking_items')
  .insert([
    {
      tenant_id: tenantId,
      booking_id: booking.id,
      service_id: serviceId,
      staff_id: staffId,
      duration_minutes: 60,
      price: 1500,
    },
  ]);
\`\`\`

### Invoices

**Create Invoice from Booking**
\`\`\`typescript
const { data: invoice } = await supabase
  .from('invoices')
  .insert({
    tenant_id: tenantId,
    branch_id: branchId,
    booking_id: bookingId,
    client_id: clientId,
    status: 'DRAFT',
    subtotal: 1500,
    tax_amount: 270,
    total: 1770,
  })
  .select()
  .single();

// Add invoice items
await supabase.from('invoice_items').insert([
  {
    tenant_id: tenantId,
    invoice_id: invoice.id,
    type: 'service',
    reference_id: serviceId,
    name: 'Haircut',
    quantity: 1,
    unit_price: 1500,
    tax_rate: 18,
    total: 1770,
  },
]);
\`\`\`

**Record Payment**
\`\`\`typescript
await supabase.from('payments').insert({
  tenant_id: tenantId,
  invoice_id: invoiceId,
  method: 'UPI',
  amount: 1770,
  reference: 'TXN123456',
});

// Update invoice status
await supabase
  .from('invoices')
  .update({ status: 'PAID', paid_at: new Date().toISOString() })
  .eq('id', invoiceId);
\`\`\`

### Services

**List Services with Categories**
\`\`\`typescript
const { data } = await supabase
  .from('services')
  .select(\`
    *,
    service_categories(name)
  \`)
  .eq('tenant_id', tenantId)
  .eq('is_active', true);
\`\`\`

### Staff

**List Staff with Shifts**
\`\`\`typescript
const { data } = await supabase
  .from('staff')
  .select(\`
    *,
    users(email, profiles(full_name)),
    branches(name),
    staff_shifts(*)
  \`)
  .eq('tenant_id', tenantId)
  .eq('is_active', true);
\`\`\`

## Error Handling

All Supabase operations return `{ data, error }`. Always check for errors:

\`\`\`typescript
const { data, error } = await supabase
  .from('clients')
  .select('*');

if (error) {
  console.error('Error fetching clients:', error);
  throw new Error(error.message);
}

return data;
\`\`\`

## Pagination

\`\`\`typescript
const page = 0;
const pageSize = 50;

const { data, error, count } = await supabase
  .from('clients')
  .select('*', { count: 'exact' })
  .eq('tenant_id', tenantId)
  .range(page * pageSize, (page + 1) * pageSize - 1);
\`\`\`

## Filtering

\`\`\`typescript
// Simple filter
.eq('status', 'PENDING')

// Multiple conditions
.eq('tenant_id', tenantId)
.eq('is_active', true)

// Date range
.gte('created_at', startDate)
.lte('created_at', endDate)

// Text search (requires index)
.ilike('full_name', \`%\${searchTerm}%\`)

// In list
.in('status', ['PENDING', 'CONFIRMED'])
\`\`\`

## Sorting

\`\`\`typescript
.order('created_at', { ascending: false })
.order('full_name', { ascending: true })
\`\`\`

## Joins

Supabase automatically joins based on foreign keys:

\`\`\`typescript
.select(\`
  *,
  clients(full_name, phone),
  branches(name),
  booking_items(
    *,
    services(name, duration_minutes),
    staff(display_name)
  )
\`)
\`\`\`

## Real-time Subscriptions (Optional)

\`\`\`typescript
const channel = supabase
  .channel('bookings_changes')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'bookings',
      filter: \`tenant_id=eq.\${tenantId}\`,
    },
    (payload) => {
      console.log('Change received!', payload);
    }
  )
  .subscribe();
\`\`\`

## Rate Limiting

Currently no rate limiting. Consider adding via middleware for production.

## Best Practices

1. **Always scope by tenant_id** in queries
2. **Use RLS policies** - they automatically enforce tenant scoping
3. **Validate input** with Zod schemas
4. **Handle errors** gracefully with user-friendly messages
5. **Use transactions** for multi-step operations
6. **Cache with React Query** to reduce database load
7. **Paginate** large result sets
8. **Index** frequently queried columns
