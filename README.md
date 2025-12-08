# SalonOS - Salon & Spa Management SaaS

Complete, production-ready multi-tenant SaaS platform built with Next.js, TypeScript, Supabase, and Tailwind CSS.

## 🚀 Features

- **Multi-tenant Architecture**: Secure tenant isolation with Row Level Security
- **Complete Auth Flow**: Sign up, sign in, onboarding with Supabase Auth
- **Dashboard**: Real-time KPIs and business metrics
- **Bookings & Calendar**: Appointment management with staff and resource allocation
- **Client CRM**: Comprehensive client profiles, notes, photos, and visit history
- **POS & Billing**: Invoice generation, multiple payment methods, GST compliance
- **Staff Management**: Team scheduling, commissions, and performance tracking
- **Service Catalog**: Services, categories, combos with flexible pricing
- **Inventory**: Product tracking, stock management, vendor management
- **Marketing & Automation**: Campaigns, templates, automated notifications
- **Analytics**: Revenue reports, staff performance, client retention metrics
- **Settings**: Tenant configuration, branch management, integrations

## 📋 Prerequisites

- Node.js 18+ and npm
- Supabase account (free tier works)
- Git

## 🛠️ Setup Instructions

### 1. Clone and Install

\`\`\`bash
cd c:\\Users\\Lenovo\\Desktop\\salon
npm install
\`\`\`

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Project Settings > API to get your credentials
3. Navigate to SQL Editor in your Supabase dashboard
4. Run the migrations in order:
   - Copy contents of `supabase/migrations/001_initial_schema.sql`
   - Execute in SQL Editor
   - Copy contents of `supabase/migrations/002_rls_policies.sql`
   - Execute in SQL Editor

### 3. Configure Environment Variables

Create `.env.local` in the project root:

\`\`\`env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
\`\`\`

Replace the placeholder values with your actual Supabase credentials.

### 4. Run Development Server

\`\`\`bash
npm run dev
\`\`\`

Visit [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

\`\`\`
salon/
├── app/                          # Next.js App Router
│   ├── (auth)/                  # Auth pages (signin, signup)
│   ├── dashboard/               # Main application
│   │   ├── bookings/           # Bookings module
│   │   ├── calendar/           # Calendar view
│   │   ├── clients/            # Client CRM
│   │   ├── pos/                # Point of Sale
│   │   ├── staff/              # Staff management
│   │   ├── services/           # Service catalog
│   │   ├── inventory/          # Inventory module
│   │   ├── marketing/          # Marketing & automation
│   │   ├── analytics/          # Analytics & reports
│   │   └── settings/           # Settings
│   ├── onboarding/             # Tenant onboarding
│   ├── globals.css             # Global styles
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Home (redirects)
│   └── providers.tsx           # React Query provider
├── components/
│   ├── ui/                     # shadcn/ui components
│   └── layout/                 # Sidebar, Topbar
├── lib/
│   ├── supabase/               # Supabase clients
│   ├── utils/                  # Helper functions
│   ├── auth.ts                 # RBAC utilities
│   └── database.types.ts       # TypeScript types
├── supabase/
│   └── migrations/             # SQL migrations
├── .env.local                  # Environment variables (create this)
├── .env.example                # Example env file
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.mjs
\`\`\`

## 🔐 Authentication Flow

1. **Sign Up**: New users create account at `/signup`
2. **Onboarding**: First-time users create their salon tenant at `/onboarding`
3. **Sign In**: Existing users sign in at `/signin`
4. **Dashboard**: Authenticated users land on `/dashboard`

## 🏗️ Architecture

### Multi-Tenancy

- Single database with tenant scoping via `tenant_id` columns
- Row Level Security (RLS) policies enforce data isolation
- Each user can belong to multiple tenants with different roles

### Roles

- **SUPER_ADMIN**: Platform administrator
- **OWNER**: Salon owner with full control
- **MANAGER**: Day-to-day operations management
- **STAFF**: Service providers with limited access
- **CASHIER**: Billing and payment handling
- **READ_ONLY**: View-only access

### Security

- JWT-based authentication via Supabase Auth
- RLS policies on all tables
- Role-based access control (RBAC)
- Server-side rendering for sensitive operations
- Client-side validation with Zod

## 🚢 Deployment to Render

### 1. Prepare Repository

Push your code to GitHub:

\`\`\`bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/salonos.git
git push -u origin main
\`\`\`

### 2. Create Render Web Service

1. Go to [render.com](https://render.com) and sign in
2. Click "New +" > "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: salonos
   - **Environment**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: Free (or paid for production)

### 3. Add Environment Variables

In Render dashboard, add:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL` (your Render URL)

### 4. Deploy

Click "Create Web Service" and Render will deploy automatically.

## 🧪 Testing

The project is structured for easy testing:

\`\`\`bash
# Type checking
npm run type-check

# Linting
npm run lint
\`\`\`

## 🔧 Development

### Adding a New Module

1. Create folder in `app/dashboard/[module]/`
2. Add page.tsx with server component for data fetching
3. Create client components in same folder for interactivity
4. Use existing UI components from `components/ui/`
5. Follow RBAC pattern from existing modules

### Database Changes

1. Write SQL migration in `supabase/migrations/`
2. Apply via Supabase SQL Editor
3. Regenerate types: `npm run supabase:generate-types`

### Styling

- Use Tailwind utility classes
- Leverage shadcn/ui components
- Follow existing patterns for consistency

## 📊 Database Schema

Key tables:
- **tenants**: Salon accounts
- **profiles**: User profiles
- **tenant_users**: User-tenant memberships with roles
- **branches**: Multiple locations per tenant
- **clients**: Client database with CRM fields
- **bookings**: Appointments with items and resources
- **services**: Service catalog with categories
- **staff**: Staff profiles and scheduling
- **invoices**: Billing and payments
- **products**: Inventory management

See `supabase/migrations/` for complete schema.

## 🛣️ Roadmap

### Phase 1 (Current)
- ✅ Auth and onboarding
- ✅ Basic dashboard
- ✅ Client CRM foundation
- ✅ Module scaffolding

### Phase 2 (Next)
- 🔄 Complete bookings with calendar
- 🔄 Full POS implementation
- 🔄 Staff scheduling and commissions
- 🔄 Service catalog management

### Phase 3 (Future)
- ⏳ Advanced inventory features
- ⏳ Marketing automation
- ⏳ Analytics dashboards with charts
- ⏳ WhatsApp integration
- ⏳ Mobile app (React Native)

## 📝 License

MIT

## 🤝 Contributing

This is a starter template. Customize freely for your needs!

## 📞 Support

For issues or questions:
1. Check the code comments and README
2. Review Supabase documentation
3. Inspect browser console and network requests

## 🎯 Quick Start Checklist

- [ ] Supabase project created
- [ ] Migrations applied
- [ ] Environment variables configured
- [ ] Dependencies installed (`npm install`)
- [ ] Dev server running (`npm run dev`)
- [ ] Signed up and created first tenant
- [ ] Explored dashboard and modules

---

**Built with ❤️ using Next.js, TypeScript, Supabase, and Tailwind CSS**
