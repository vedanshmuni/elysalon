# STAFF DISPLAY FIX - CRITICAL

## Problem Identified
Staff members were being added to the database but not displaying in the staff list page.

## Root Cause
The manual "Add Staff" flow (`/dashboard/staff/new`) was only creating records in the `staff` table but NOT in the `tenant_users` table.

The RLS (Row Level Security) policy uses the helper function `user_belongs_to_tenant()` which checks if a user exists in `tenant_users`:

```sql
CREATE POLICY "Users can view staff"
    ON public.staff FOR SELECT
    USING (user_belongs_to_tenant(tenant_id));
```

**Without a `tenant_users` entry, the RLS policy blocks the staff record from being visible.**

## Solution Implemented

### 1. Created New Migration: `006_add_staff_function.sql`
This migration adds a database function `add_staff_member()` that:
- ✅ Checks if user is already in `tenant_users`, adds them if not
- ✅ Creates the `staff` record
- ✅ Returns proper success/error messages
- ✅ Uses `SECURITY DEFINER` to bypass RLS during insertion

### 2. Updated Add Staff Page
Modified `/app/dashboard/staff/new/page.tsx` to use the new RPC function instead of direct insert.

## Required Action: Apply Migration

**You MUST run this migration in your Supabase dashboard:**

1. Go to your Supabase project
2. Navigate to **SQL Editor**
3. Open `supabase/migrations/006_add_staff_function.sql`
4. Copy the entire contents
5. Paste and **RUN** the migration

## Verification Steps

After applying the migration:

1. **Go to** `/dashboard/staff/new`
2. **Select a user** from the dropdown
3. **Fill in the form** and click "Add Staff Member"
4. **Navigate to** `/dashboard/staff` - the staff member should now appear!

## Why It Now Works

**Before:**
```
Add Staff → Create staff record only → RLS blocks viewing (no tenant_users entry)
```

**After:**
```
Add Staff → Call add_staff_member() → Create tenant_users + staff records → RLS allows viewing ✅
```

## Note on Invitation Flow

The invitation flow (`/dashboard/staff/invite`) already creates `tenant_users` entries correctly via the `accept_invitation()` function, so invited staff should work once this migration is applied.

## Existing Staff Members

If you have existing staff members that aren't showing up, they might be missing `tenant_users` entries. You can fix them by:

1. **Option A:** Delete and re-add them using the fixed flow
2. **Option B:** Manually add `tenant_users` entries in Supabase SQL Editor:

```sql
INSERT INTO public.tenant_users (tenant_id, user_id, role, is_active)
SELECT tenant_id, user_id, 'STAFF', true
FROM public.staff
WHERE NOT EXISTS (
    SELECT 1 FROM public.tenant_users tu
    WHERE tu.tenant_id = staff.tenant_id
    AND tu.user_id = staff.user_id
)
ON CONFLICT (tenant_id, user_id) DO UPDATE
SET is_active = true;
```

This query will create `tenant_users` entries for all existing staff members.
