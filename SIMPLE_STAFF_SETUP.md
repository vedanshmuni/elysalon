# Staff Account Creation - Setup Guide

## What This Does

This allows you to **directly create staff accounts** with login credentials that you can share with them. Simple and straightforward - no invitations, no emails, no complexity.

## How It Works

1. Go to `/dashboard/staff`
2. Click "Create Staff Account"
3. Fill in their details (name, email, password, role)
4. Get their login credentials on screen
5. Share the credentials with them
6. They login at `/signin` and have immediate access!

## Setup Steps

### 1. Add Service Role Key to Environment

You need to add the Supabase service role key to create user accounts.

**Edit your `.env` or `.env.local` file:**

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Where to find it:**
- Go to Supabase Dashboard
- Project Settings > API
- Copy the `service_role` key (⚠️ Keep this secret!)

### 2. Apply Database Migration (Optional)

The helper function is optional, but you can apply it:

```bash
# Copy contents of: supabase/migrations/010_simple_staff_account_creation.sql
# Paste into Supabase SQL Editor and run
```

### 3. Restart Dev Server

```bash
npm run dev
```

### 4. Test It Out!

1. Go to `/dashboard/staff`
2. Click "Create Staff Account"
3. Fill in:
   - Full Name: "John Doe"
   - Email: "john@test.com"
   - Password: "test123"
   - Role: "Staff"
   - Branch: Select a branch
4. Click "Create Staff Account"
5. You'll see the credentials on screen
6. Copy and share with staff member
7. They can login immediately!

## What Happens

When you create a staff account:

✅ **User account created** in Supabase Auth
✅ **Profile created** automatically
✅ **Added to your tenant** with the selected role
✅ **Staff record created** with branch assignment
✅ **Email confirmed** automatically (no verification needed)
✅ **Can login immediately** and see calendar, bookings, clients

## Roles Explained

**Staff Role:**
- Can view calendar
- Can view and manage bookings
- Can view clients
- Can update bookings assigned to them
- Access to their schedule

**Manager Role:**
- Everything Staff can do
- Plus: Can manage other staff
- Can view reports
- Can modify settings
- Full dashboard access

## Security Notes

⚠️ **Important:**
- Never commit the `service_role` key to git
- Store it only in `.env` or `.env.local` (already in .gitignore)
- Share staff credentials securely (Signal, encrypted email, etc.)
- Ask staff to change password after first login

## Why This Approach?

✅ **Simple** - No email sending, tokens, or expiration
✅ **Fast** - Create account instantly
✅ **Secure** - You control the password
✅ **Direct** - No need for email infrastructure
✅ **Immediate** - Staff can login right away
✅ **Reliable** - No race conditions or timing issues

## Files Created

1. **`app/dashboard/staff/create-account/page.tsx`** - UI for creating accounts
2. **`app/api/staff/create-account/route.ts`** - API endpoint using Admin API
3. **`supabase/migrations/010_simple_staff_account_creation.sql`** - Optional helper function

## API Endpoint

**POST** `/api/staff/create-account`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <your-session-token>
```

**Body:**
```json
{
  "tenantId": "uuid",
  "email": "staff@example.com",
  "password": "securepassword",
  "fullName": "John Doe",
  "role": "STAFF",
  "branchId": "uuid",
  "displayName": "Johnny",
  "phone": "+91 98765 43210",
  "roleLabel": "Senior Stylist"
}
```

**Response:**
```json
{
  "success": true,
  "userId": "uuid",
  "staffId": "uuid",
  "message": "Staff account created successfully"
}
```

## Troubleshooting

### Error: "Not authenticated"
- Make sure you're logged in as owner or manager

### Error: "Missing service role key"
- Add `SUPABASE_SERVICE_ROLE_KEY` to your `.env` file

### Error: "Email already exists"
- This email is already registered, use a different email

### Staff can't see tenant data after login
- Check `tenant_users` table - should have entry for this staff
- Check `profiles` table - should have `default_tenant_id` set
- Check `staff` table - should have staff record

## Next Steps

Once staff accounts are created:

1. **Set up shifts** at `/dashboard/staff/shifts`
2. **Configure commissions** at `/dashboard/staff/commissions`
3. **Assign them to services** in service settings
4. **Create bookings** and assign to them

## Support

If you have issues:
1. Check browser console for errors
2. Check Supabase logs
3. Verify service role key is correct
4. Ensure all environment variables are set
