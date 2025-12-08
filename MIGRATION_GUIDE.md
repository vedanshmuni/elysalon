# Migration Guide - What to Run and How

## Your Current Status
✅ Already applied: Migrations 001-009  
⏳ Need to apply: Migrations 010, 011, 012

---

## Migrations to Apply (In Order)

### 1. Migration 010 (OPTIONAL - Skip if you want)
**File:** `supabase/migrations/010_simple_staff_account_creation.sql`

**What it does:**
- Creates a helper function `add_staff_to_tenant()` 
- Used internally by the API when creating staff accounts
- NOT required for basic functionality - the API works without it

**Should you run it?**
- ✅ YES if you want the helper function available for other use cases
- ⛔ NO/SKIP if you only use staff creation via the dashboard (API handles it directly)

**How to run:**
```bash
# In Supabase Dashboard:
1. Go to SQL Editor
2. Copy entire contents of 010_simple_staff_account_creation.sql
3. Paste and click "Run"
```

---

### 2. Migration 011 (REQUIRED - Must Run)
**File:** `supabase/migrations/011_fix_owner_role_display.sql`

**What it does:**
- ✅ Updates `complete_onboarding()` function to set role_label='Admin/Owner'
- ✅ Fixes existing salon owners to show "Admin/Owner" instead of "Staff"
- ✅ Makes owner badge show purple color on staff page

**Why it's required:**
- Without this, new salon owners will show as "Staff" on the staff list
- Existing owners won't display with proper "OWNER" badge

**How to run:**
```bash
# In Supabase Dashboard:
1. Go to SQL Editor
2. Copy entire contents of 011_fix_owner_role_display.sql
3. Paste and click "Run"
4. Should see: "UPDATE X" (where X = number of existing owners updated)
```

---

### 3. Migration 012 (INFORMATIONAL - No action needed)
**File:** `supabase/migrations/012_enable_user_deletion.sql`

**What it does:**
- Just documentation/comments about user deletion
- No actual SQL changes - just explains how CASCADE works

**Should you run it?**
- It won't hurt to run it (it's just comments)
- But **user deletion is already enabled** by default via CASCADE

**About User Deletion:**
The "cannot delete users" issue is NOT from SQL - it's likely from:

1. **Supabase Dashboard Settings:**
   - Go to: Authentication > Settings
   - Check if "Enable manual triggering only" is ON for auth hooks
   
2. **API Permissions:**
   - Make sure you're using **Service Role Key** (not anon key) to delete users
   - Delete via: `supabase.auth.admin.deleteUser(userId)`

3. **How to enable deletion in code:**
```typescript
// In your API route or server component:
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // ← Must use this key
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Then delete:
await supabaseAdmin.auth.admin.deleteUser(userId)
```

---

## Summary: What You Need to Do

### Step 1: Run Migration 011 (Required)
```bash
# This is CRITICAL for owner role display
# Copy/paste 011_fix_owner_role_display.sql in Supabase SQL Editor
```

### Step 2: Skip Migration 010 (Optional helper function)
```bash
# Unless you need the helper function, you can skip this
# The API route works fine without it
```

### Step 3: Skip Migration 012 (Just docs)
```bash
# No action needed - it's just documentation
# User deletion already works via CASCADE
```

### Step 4: Add Service Role Key to .env
```bash
# Create/update .env.local:
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # ← Add this
```

**Where to find Service Role Key:**
- Supabase Dashboard > Project Settings > API
- Copy the `service_role` key (marked as "secret")

---

## Testing After Migration 011

### Test 1: Create new salon
```bash
1. Sign up with new account
2. Complete onboarding (create salon)
3. Go to Dashboard > Staff
4. You should see yourself as "OWNER" with purple badge
```

### Test 2: Check existing owners
```bash
1. Log in to existing salon account
2. Go to Dashboard > Staff  
3. Owner should now show purple "OWNER" badge (was "STAFF" before)
```

### Test 3: Create staff account
```bash
1. Go to Dashboard > Staff > Create Staff Account
2. Fill in email, password, role
3. Should create successfully and show credentials
4. New staff can log in with those credentials
```

---

## User Deletion - Detailed Explanation

**The issue is NOT in SQL** - your CASCADE is already configured correctly.

**To delete users from authentication:**

### Option 1: Via Supabase Dashboard
```bash
1. Go to Authentication > Users
2. Click on user
3. Click "Delete user" button
4. Confirm deletion
```

### Option 2: Via API (Programmatic)
```typescript
// Create admin client with service role key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Delete user (this will CASCADE delete all related records)
const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)

if (error) {
  console.error('Failed to delete user:', error)
} else {
  console.log('User deleted successfully')
  // This automatically deleted:
  // - profiles record
  // - tenant_users records
  // - staff records
  // - any other records with user_id FK
}
```

**If you still can't delete:**
1. Check you're using **service_role** key (not anon key)
2. Check Supabase Dashboard > Authentication > Settings for restrictions
3. Verify the user exists in auth.users table

---

## Quick Reference

| Migration | Status | Action Required |
|-----------|--------|-----------------|
| 001-009 | ✅ Done | Already applied |
| 010 | ⚠️ Optional | Skip unless you need helper function |
| 011 | 🔴 Required | **MUST RUN** - Fixes owner role display |
| 012 | ℹ️ Info only | No action needed |

---

## Need Help?

**If owner role still shows as "Staff" after migration 011:**
1. Clear browser cache
2. Log out and log back in
3. Check Supabase SQL Editor - run: `SELECT * FROM staff WHERE user_id = 'your_user_id'`
4. Verify `role_label` column shows 'Admin/Owner'

**If staff account creation fails:**
1. Check .env.local has SUPABASE_SERVICE_ROLE_KEY
2. Restart dev server after adding env variable
3. Check browser console for error details
