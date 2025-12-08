# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-01-XX

### Added
- Complete multi-tenant architecture with Supabase RLS
- Authentication and authorization system with RBAC
- Onboarding flow for new tenants
- Dashboard with real-time KPIs
- **Clients Module**:
  - Client list view with server-side rendering
  - Create client form with validation
  - Client profile fields (name, phone, email, DOB, gender)
- **Database Schema**:
  - 40+ tables covering all business entities
  - Indexes on tenant_id and foreign keys
  - Triggers for updated_at timestamps
  - Comprehensive RLS policies
- **UI Components**:
  - Button, Input, Textarea, Card, Table, Label, Select
  - Sidebar navigation with module links
  - Topbar with search and notifications
- **Utilities**:
  - Date formatting functions
  - Currency formatting with INR support
  - RBAC helper functions
  - General purpose helpers (slugify, truncate, etc.)
- **Documentation**:
  - README with setup instructions
  - Architecture documentation
  - API documentation
  - Deployment guide for Render
  - Contributing guidelines
- **CI/CD**:
  - GitHub Actions workflow for linting and type checking
- **Placeholder Pages**:
  - Bookings, Calendar, POS, Staff, Services
  - Inventory, Marketing, Analytics, Settings

### Infrastructure
- Next.js 15 with App Router
- TypeScript strict mode
- Tailwind CSS with shadcn/ui
- React Query for state management
- Supabase for backend (Postgres + Auth)

## [Unreleased]

### To Be Added
- Complete Bookings module implementation
- Calendar view with drag-and-drop
- POS system for invoicing
- Services management with categories
- Staff management with shift scheduling
- Inventory tracking with stock alerts
- Marketing campaigns and automation
- Analytics dashboards with charts
- Settings pages for tenant configuration
- Edit and detail pages for all modules
- React Query hooks for data fetching
- Search functionality across modules
- Filters and sorting on list views
- Export functionality (PDF, Excel)
- Unit and integration tests
- Mobile app (React Native)
- Payment gateway integration
- SMS/Email notifications
- WhatsApp integration
- Multi-language support (i18n)
- Dark mode theme
