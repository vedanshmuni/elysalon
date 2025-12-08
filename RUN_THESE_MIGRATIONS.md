# SQL Migrations - Execute in Order

## RUN THESE IN SUPABASE SQL EDITOR (In this exact order):

### Step 1: Run Migration 010 (Optional Helper Function)
**File:** `010_simple_staff_account_creation.sql`
- Copy entire file contents
- Paste in Supabase SQL Editor
- Click "Run"
- ✅ Should see: "CREATE FUNCTION" success message

---

### Step 2: Run Migration 011 (Update Existing Owner Records)
**File:** `011_fix_owner_role_display.sql`
- Copy entire file contents
- Paste in Supabase SQL Editor
- Click "Run"
- ✅ Should see: "UPDATE X" (where X = number of owners updated)

---

### Step 3: Run Migration 012 (Fix User Deletion - REQUIRED)
**File:** `012_enable_user_deletion.sql`
- Fixes the foreign key constraint on tenants.owner_user_id
- Allows deleting users from authentication
- Copy entire file contents
- Paste in Supabase SQL Editor
- Click "Run"
- ✅ Should see: "ALTER TABLE" success message

---

### Step 4: Run Migration 013 (Revert 003 Changes)
**File:** `013_revert_003_changes.sql`
- This removes the role_label from the onboarding function
- Copy entire file contents
- Paste in Supabase SQL Editor
- Click "Run"
- ✅ Should see: "CREATE FUNCTION" success message

---

## Summary:

```bash
Order to run:
1. ✅ 010_simple_staff_account_creation.sql (optional)
2. ✅ 011_fix_owner_role_display.sql (REQUIRED - fixes existing owners)
3. ✅ 012_enable_user_deletion.sql (REQUIRED - fixes user deletion error)
4. ✅ 013_revert_003_changes.sql (REQUIRED - reverts 003 changes)
```

## After Running All Migrations:

**Result:**
- Existing owners will show "Admin/Owner" role label ✅
- New salons will be created without role_label in staff table ✅
- Owner role will be displayed from tenant_users.role (OWNER) ✅
- Staff page will show color-coded badges (purple for OWNER) ✅

**Test:**
1. Log in to existing salon
2. Go to Dashboard > Staff
3. Owner should show purple "OWNER" badge
4. Create new salon and verify same behavior
