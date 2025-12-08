# Developer Guide - SalonOS

Complete guide for developers working on SalonOS.

## 🎯 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Git
- Code editor (VS Code recommended)
- Supabase account
- Basic knowledge of TypeScript, React, and Next.js

### Initial Setup (15 minutes)

1. **Clone and install**:
   \`\`\`bash
   git clone <repo-url>
   cd salon
   npm install
   \`\`\`

2. **Set up Supabase**:
   - Create project at https://supabase.com
   - Run migrations from \`supabase/migrations/\`
   - Copy credentials to \`.env.local\`

3. **Start development**:
   \`\`\`bash
   npm run dev
   \`\`\`

See [QUICKSTART.md](../QUICKSTART.md) for detailed setup.

## 📂 Project Structure

\`\`\`
app/                    # Next.js App Router
├── (auth)/            # Auth pages (signin, signup)
├── dashboard/         # Protected app pages
│   ├── clients/      # Example: Complete CRUD module
│   └── [other]/      # Other modules (placeholders)
├── api/              # API routes
├── layout.tsx        # Root layout
└── page.tsx          # Landing page

components/            # React components
├── ui/               # UI primitives (shadcn/ui)
└── layout/           # Layout components (sidebar, topbar)

lib/                   # Utilities and helpers
├── supabase/         # Database clients
├── utils/            # Helper functions
├── auth.ts           # RBAC utilities
└── constants.ts      # App constants

supabase/             # Database
└── migrations/       # SQL migration files

docs/                  # Documentation
\`\`\`

## 🏗️ Development Patterns

### Server Components (Default)

Use for data fetching, no client-side JavaScript needed:

\`\`\`typescript
// app/dashboard/clients/page.tsx
import { createClient } from '@/lib/supabase/server';

export default async function ClientsPage() {
  const supabase = await createClient();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  // Get user's tenant
  const { data: tenantUser } = await supabase
    .from('tenant_users')
    .select('tenant_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();
    
  if (!tenantUser) return null;
  
  // Fetch data (RLS auto-enforces tenant scoping)
  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .eq('tenant_id', tenantUser.tenant_id)
    .order('created_at', { ascending: false });
    
  return (
    <div>
      <h1>Clients</h1>
      <ClientTable clients={clients || []} />
    </div>
  );
}
\`\`\`

### Client Components

Use for interactivity, forms, event handlers:

\`\`\`typescript
// app/dashboard/clients/new/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function NewClientPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    email: '',
  });
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const supabase = createClient();
      
      // Get tenant_id (same pattern as server component)
      const { data: { user } } = await supabase.auth.getUser();
      const { data: tenantUser } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', user!.id)
        .single();
        
      // Create client
      const { error } = await supabase
        .from('clients')
        .insert({
          ...formData,
          tenant_id: tenantUser!.tenant_id,
        });
        
      if (error) throw error;
      
      router.push('/dashboard/clients');
    } catch (error) {
      console.error('Error creating client:', error);
      alert('Failed to create client');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  );
}
\`\`\`

### React Query (Recommended for Client Components)

For better data fetching and caching:

\`\`\`typescript
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

// Custom hook for fetching clients
function useClients(tenantId: string) {
  return useQuery({
    queryKey: ['clients', tenantId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('tenant_id', tenantId);
      if (error) throw error;
      return data;
    },
  });
}

// Custom hook for creating client
function useCreateClient() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (newClient: any) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('clients')
        .insert(newClient)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

// Usage in component
export default function ClientsPage() {
  const { data: clients, isLoading } = useClients(tenantId);
  const createMutation = useCreateClient();
  
  const handleCreate = () => {
    createMutation.mutate({ full_name: 'John Doe', ... });
  };
  
  // ...
}
\`\`\`

## 🗄️ Database Patterns

### Querying with RLS

Always query normally - RLS policies automatically filter by tenant:

\`\`\`typescript
// ✅ Good - RLS handles tenant filtering
const { data } = await supabase
  .from('clients')
  .select('*');

// ❌ Don't do this - redundant
const { data } = await supabase
  .from('clients')
  .select('*')
  .eq('tenant_id', tenantId); // RLS already does this
\`\`\`

### Joins

Use Supabase's automatic joins:

\`\`\`typescript
const { data } = await supabase
  .from('bookings')
  .select(\`
    *,
    clients(full_name, phone),
    branches(name),
    booking_items(
      *,
      services(name, duration_minutes),
      staff(display_name)
    )
  \`);
\`\`\`

### Pagination

\`\`\`typescript
const page = 0;
const pageSize = 50;

const { data, count } = await supabase
  .from('clients')
  .select('*', { count: 'exact' })
  .range(page * pageSize, (page + 1) * pageSize - 1);
\`\`\`

### Filtering

\`\`\`typescript
// Single filter
.eq('status', 'PENDING')

// Multiple filters (AND)
.eq('status', 'PENDING')
.eq('branch_id', branchId)

// OR condition
.or('status.eq.PENDING,status.eq.CONFIRMED')

// Date range
.gte('created_at', startDate)
.lte('created_at', endDate)

// Search
.ilike('full_name', \`%\${searchTerm}%\`)

// IN list
.in('status', ['PENDING', 'CONFIRMED'])
\`\`\`

## 🎨 UI Component Patterns

### Using shadcn/ui Components

\`\`\`typescript
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export function MyComponent() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Title</CardTitle>
      </CardHeader>
      <CardContent>
        <Input placeholder="Enter text" />
        <Button>Submit</Button>
      </CardContent>
    </Card>
  );
}
\`\`\`

### Form Validation with Zod

\`\`\`typescript
import { z } from 'zod';

const clientSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().regex(/^[\d\s\+\-\(\)]+$/, 'Invalid phone number'),
  email: z.string().email('Invalid email').optional(),
  date_of_birth: z.string().optional(),
});

type ClientFormData = z.infer<typeof clientSchema>;

// In component
const [errors, setErrors] = useState<Record<string, string>>({});

const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  
  const result = clientSchema.safeParse(formData);
  
  if (!result.success) {
    const formattedErrors = result.error.flatten().fieldErrors;
    setErrors(formattedErrors as any);
    return;
  }
  
  // Proceed with submission
};
\`\`\`

## 🔐 Authentication & Authorization

### Getting Current User

\`\`\`typescript
// Server component
import { createClient } from '@/lib/supabase/server';

const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();

// Client component
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();
const { data: { user } } = await supabase.auth.getUser();
\`\`\`

### Role-Based Access Control

\`\`\`typescript
import { hasRole, isOwnerOrManager, hasPermission } from '@/lib/auth';

// Check role
const isManager = await hasRole('MANAGER', tenantId);

// Check owner or manager
const canManage = await isOwnerOrManager(tenantId);

// Check permission level
const canDelete = await hasPermission(tenantId, 'MANAGER');
\`\`\`

### Protecting Routes

Routes under \`/dashboard\` are automatically protected by middleware.

For additional checks:

\`\`\`typescript
// In page component
import { redirect } from 'next/navigation';
import { hasRole } from '@/lib/auth';

export default async function AdminPage() {
  const canAccess = await hasRole('OWNER', tenantId);
  
  if (!canAccess) {
    redirect('/dashboard');
  }
  
  // Render admin page
}
\`\`\`

## 🧪 Testing Patterns

### Manual Testing Checklist

For each new feature:
- [ ] Create/update works correctly
- [ ] Data shows in list views
- [ ] Validation works (try invalid inputs)
- [ ] Error handling works
- [ ] RLS enforced (try accessing other tenant's data)
- [ ] UI responsive on mobile
- [ ] No console errors

### Future: Unit Tests

\`\`\`typescript
// Example (not yet implemented)
import { render, screen } from '@testing-library/react';
import ClientForm from './ClientForm';

test('renders client form', () => {
  render(<ClientForm />);
  expect(screen.getByLabelText('Full Name')).toBeInTheDocument();
});
\`\`\`

## 🐛 Debugging

### Server Component Errors

Check terminal where \`npm run dev\` is running.

### Client Component Errors

Check browser console (F12).

### Database Errors

Check Supabase Dashboard → Logs:
- Database logs for SQL errors
- Auth logs for authentication issues

### RLS Issues

Test in Supabase SQL Editor:
\`\`\`sql
-- Set user context
SET request.jwt.claims = '{"sub":"user-uuid"}';

-- Try query
SELECT * FROM clients WHERE tenant_id = 'tenant-uuid';
\`\`\`

## 📦 Adding New Modules

Follow the Clients module pattern:

### 1. Create List Page (Server Component)

\`\`\`typescript
// app/dashboard/[module]/page.tsx
import { createClient } from '@/lib/supabase/server';

export default async function ModulePage() {
  const supabase = await createClient();
  
  // Get tenant
  const { data: { user } } = await supabase.auth.getUser();
  const { data: tenantUser } = await supabase
    .from('tenant_users')
    .select('tenant_id')
    .eq('user_id', user!.id)
    .single();
    
  // Fetch data
  const { data } = await supabase
    .from('table_name')
    .select('*')
    .order('created_at', { ascending: false });
    
  return (
    <div>
      <h1>Module Name</h1>
      <table>{/* Render data */}</table>
    </div>
  );
}
\`\`\`

### 2. Create Form Page (Client Component)

\`\`\`typescript
// app/dashboard/[module]/new/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function NewModulePage() {
  const router = useRouter();
  const [formData, setFormData] = useState({});
  
  const handleSubmit = async (e: React.FormEvent) => {
    // Handle form submission
  };
  
  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  );
}
\`\`\`

### 3. Add Navigation

Update \`components/layout/sidebar.tsx\`:
\`\`\`typescript
const navItems = [
  // ...existing items
  {
    label: 'Module Name',
    href: '/dashboard/module',
    icon: IconName,
  },
];
\`\`\`

## 🎨 Styling Guidelines

### Tailwind Utilities

\`\`\`typescript
// Layout
<div className="flex flex-col gap-4 p-6">

// Grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

// Card
<div className="bg-white rounded-lg shadow p-6">

// Button colors
<Button className="bg-blue-600 hover:bg-blue-700">

// Text
<h1 className="text-2xl font-bold text-gray-900">
<p className="text-sm text-gray-600">
\`\`\`

### Responsive Design

\`\`\`typescript
// Mobile-first approach
<div className="
  w-full           // Mobile: full width
  md:w-1/2         // Tablet: half width
  lg:w-1/3         // Desktop: third width
">
\`\`\`

## ⚡ Performance Tips

1. **Use Server Components** by default for data fetching
2. **Minimize Client Components** - only use for interactivity
3. **Database Indexes** - already created in migrations
4. **Pagination** - always paginate large lists
5. **React Query** - use for caching on client
6. **Image Optimization** - use Next.js Image component

## 🚀 Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete guide.

Quick steps:
1. Push to GitHub
2. Connect to Render/Vercel
3. Add environment variables
4. Deploy

## 📚 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [React Query Documentation](https://tanstack.com/query/latest)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com)

## 🤝 Getting Help

- Check documentation in \`/docs\`
- Review existing code in \`app/dashboard/clients\`
- Open GitHub issue for bugs
- Start GitHub discussion for questions

## 📝 Code Checklist

Before submitting PR:
- [ ] TypeScript compiles (\`npm run type-check\`)
- [ ] ESLint passes (\`npm run lint\`)
- [ ] Code formatted (\`npm run format\`)
- [ ] Tested locally
- [ ] RLS policies updated if needed
- [ ] Documentation updated
- [ ] Commit messages follow conventions

Happy coding! 🎉
