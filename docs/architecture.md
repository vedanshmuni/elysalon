# Architecture Documentation

## System Overview

SalonOS is a multi-tenant SaaS platform designed for salon and spa businesses. It follows a modern web architecture using Next.js with server-side rendering, client-side interactivity, and Supabase for backend services.

## Technology Stack

### Frontend
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript (strict mode)
- **UI Library**: React 19
- **Styling**: Tailwind CSS with shadcn/ui components
- **State Management**: React Query (TanStack Query) for server state
- **Forms**: React Hook Form with Zod validation
- **Icons**: Lucide React

### Backend
- **Database**: Supabase PostgreSQL
- **Auth**: Supabase Auth (JWT-based)
- **API**: Next.js API Routes and Server Actions
- **ORM**: Supabase JS Client with generated TypeScript types
- **Security**: Row Level Security (RLS) policies

### Infrastructure
- **Hosting**: Render (or Vercel/Netlify)
- **Database Hosting**: Supabase Cloud
- **CDN**: Automatic via hosting provider
- **Environment**: Environment variables for configuration

## Architecture Patterns

### Multi-Tenancy

**Single Database with Tenant Scoping**
- Every tenant-specific table includes `tenant_id` column
- RLS policies enforce tenant isolation at database level
- Middleware validates user authentication
- Server components fetch tenant-scoped data automatically

### Data Flow

1. **Client Request** → Next.js middleware validates auth
2. **Server Component** → Fetches data from Supabase with RLS
3. **Client Component** → Displays data, handles user interactions
4. **React Query** → Manages cache and mutations
5. **Server Action / API Route** → Processes mutations
6. **Supabase** → Enforces RLS, updates data

### Authentication & Authorization

**Authentication Flow**:
1. User signs in via Supabase Auth (email/password or magic link)
2. Supabase issues JWT access and refresh tokens
3. Tokens stored in HTTP-only cookies via middleware
4. Every request includes auth cookies automatically

**Authorization (RBAC)**:
- Roles: SUPER_ADMIN, OWNER, MANAGER, STAFF, CASHIER, READ_ONLY
- Role hierarchy enforced in RLS policies
- Helper functions (`hasRole`, `isOwnerOrManager`) in lib/auth.ts
- Server-side checks before sensitive operations

### Component Architecture

**Server Components** (default in App Router):
- Fetch data from database
- No JavaScript sent to client
- Used for pages and layouts

**Client Components** (`'use client'`):
- Interactive UI elements
- Forms and user input
- React Query hooks

**Layout Hierarchy**:
\`\`\`
app/layout.tsx (Root)
  └── app/dashboard/layout.tsx (Auth + Dashboard Shell)
      └── app/dashboard/[module]/page.tsx (Module Page)
\`\`\`

### State Management

**Server State** (React Query):
- API data fetching and caching
- Automatic refetching and invalidation
- Optimistic updates for mutations

**Local State** (useState):
- Form inputs
- UI toggles (modals, dropdowns)
- Temporary display state

**URL State** (Next.js):
- Filters, pagination, search params
- Route-based navigation state

## Database Design

### Schema Principles

1. **Normalization**: 3NF for core entities
2. **Tenant Scoping**: All business tables have `tenant_id`
3. **Soft Deletes**: Important records use `deleted_at` pattern
4. **Audit Trail**: `created_at`, `updated_at`, `created_by` fields
5. **Indexes**: On foreign keys, `tenant_id`, and common queries

### Key Relationships

- Tenant → Branches (1:N)
- Tenant → Users (N:M via tenant_users)
- Client → Bookings (1:N)
- Booking → BookingItems (1:N)
- Service → BookingItems (1:N)
- Staff → BookingItems (1:N)
- Invoice → InvoiceItems (1:N)
- Invoice → Payments (1:N)
- Product → ProductStocks (1:N per branch)

### RLS Policies

**Pattern**:
\`\`\`sql
CREATE POLICY "Users can view their tenant's data"
ON table_name FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);
\`\`\`

**Hierarchy**:
- SELECT: All authenticated tenant members
- INSERT/UPDATE: All authenticated tenant members
- DELETE: Owners and Managers only
- Special cases: Commission rules (Owners only)

## Module Structure

Each module follows consistent structure:

\`\`\`
dashboard/[module]/
├── page.tsx              # List view (Server Component)
├── [id]/
│   └── page.tsx         # Detail view
├── new/
│   └── page.tsx         # Create form (Client Component)
└── components/
    ├── [Module]Form.tsx
    └── [Module]Table.tsx
\`\`\`

## Performance Optimizations

1. **Server-Side Rendering**: Initial page load with data
2. **React Query Caching**: Reduce redundant requests
3. **Database Indexes**: Fast queries on common patterns
4. **Pagination**: Limit 50 results per page
5. **Image Optimization**: Next.js Image component
6. **Code Splitting**: Automatic by Next.js

## Security Considerations

1. **RLS Policies**: Database-level security
2. **Input Validation**: Zod schemas on client and server
3. **CSRF Protection**: Built into Next.js
4. **SQL Injection**: Prevented by Supabase client parameterization
5. **XSS**: React escapes by default
6. **Rate Limiting**: Can add via middleware (future)

## Scalability

**Current Architecture Supports**:
- Thousands of tenants
- Millions of records
- Moderate concurrent users per tenant

**Future Optimizations**:
- Read replicas for analytics
- Caching layer (Redis)
- Background jobs (Supabase Edge Functions)
- CDN for static assets
- Horizontal scaling via Supabase

## Development Workflow

1. **Local Development**: npm run dev
2. **Database Changes**: Write SQL migration
3. **Type Generation**: npm run supabase:generate-types
4. **Testing**: Manual testing + type checking
5. **Deployment**: Git push triggers auto-deploy

## Monitoring & Observability

**Current**:
- Next.js build logs
- Supabase logs
- Browser console

**Recommended Additions**:
- Error tracking (Sentry)
- Analytics (PostHog, Plausible)
- APM (Vercel Analytics, New Relic)
- Uptime monitoring (UptimeRobot)

## API Conventions

**REST-like patterns**:
- GET `/dashboard/[module]` - List view
- GET `/dashboard/[module]/[id]` - Detail view
- POST via Server Actions - Create/Update
- Consistent error handling and status codes

**Server Actions**:
- Colocated with components
- Automatic CSRF protection
- Progressive enhancement

## Folder Naming Conventions

- **lowercase-kebab**: Routes and file names
- **PascalCase**: Components and types
- **camelCase**: Functions and variables
- **UPPER_SNAKE**: Constants and enums
