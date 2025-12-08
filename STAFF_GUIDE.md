# Staff Management - Quick Guide

## Creating Staff Accounts

The simple way to add staff with login access:

### Setup (One Time)

1. **Add service role key to `.env`:**
   ```env
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```
   Find it at: Supabase Dashboard > Project Settings > API

2. **Restart dev server:**
   ```bash
   npm run dev
   ```

### Usage

1. Go to `/dashboard/staff`
2. Click **"Create Staff Account"**
3. Fill in details:
   - Full Name
   - Email (they'll use this to login)
   - Password (you'll share this with them)
   - Role (Staff or Manager)
   - Branch
4. Click "Create Staff Account"
5. **Copy the credentials** shown on screen
6. Share them with the staff member securely
7. They login at `/signin` immediately!

**That's it!** No emails, no invitations, no waiting.

---

## Alternative: Add Staff Without Login

If staff doesn't need system access (scheduling/assignments only):

1. Go to `/dashboard/staff/new`
2. Fill in basic details (name, role, branch)
3. They're added for scheduling but can't login

Use this for contractors or staff who don't need to access the system.

---

## What Staff Can Do After Login

**Staff Role:**
- View calendar
- Manage their bookings
- View client info
- Update their schedule

**Manager Role:**
- Everything staff can do
- Plus: Add/edit staff
- View reports
- Access all settings

---

## Files

- **`app/dashboard/staff/create-account/page.tsx`** - Create account UI
- **`app/api/staff/create-account/route.ts`** - Account creation API
- **`supabase/migrations/010_simple_staff_account_creation.sql`** - Helper function

---

## Troubleshooting

**"Missing service role key"**
→ Add `SUPABASE_SERVICE_ROLE_KEY` to `.env`

**"Email already exists"**
→ Use a different email

**Staff can't see data after login**
→ Check they're in `tenant_users` table with correct tenant_id
