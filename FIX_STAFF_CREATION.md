# 🚨 URGENT FIX - Staff Account Creation Not Working

## Problem
The API route is returning HTML instead of JSON, causing errors:
- `Failed to load resource: 403/400`
- `SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON`

## Root Cause
Missing `SUPABASE_SERVICE_ROLE_KEY` environment variable causes the API route to crash.

---

## ✅ SOLUTION - Follow These Steps

### Step 1: Get Your Service Role Key

1. Go to your Supabase Dashboard
2. Navigate to: **Project Settings** → **API**
3. Find the **"service_role"** key (marked as "secret" - second key in the list)
4. Copy the entire key

**WARNING:** This is a SECRET key with full database access. NEVER commit it to git or expose it in browser code.

---

### Step 2: Add to Environment File

Create or edit `.env.local` file in your project root:

```bash
# Copy your existing keys
NEXT_PUBLIC_SUPABASE_URL=https://kejvgafxirrahqlrqrkb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_existing_anon_key

# Add this line with your service role key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...your_service_role_key_here
```

**File location:** `/Users/priyanshpatel/Desktop/elysalon/.env.local`

---

### Step 3: Restart Your Development Server

```bash
# Stop the current server (Ctrl+C in terminal)
# Then restart:
npm run dev
```

**IMPORTANT:** Environment variables are loaded at server startup. You MUST restart for changes to take effect.

---

### Step 4: Test Staff Account Creation

1. Go to: `http://localhost:3000/dashboard/staff`
2. Click **"Create Staff Account"**
3. Fill in the form
4. Click **"Create Account"**
5. Should now work successfully! ✅

---

## Verification Checklist

- [ ] Service role key added to `.env.local`
- [ ] Dev server restarted (`npm run dev`)
- [ ] No 403/400 errors in browser console
- [ ] Staff account creation form works
- [ ] Credentials are displayed after creation

---

## If Still Not Working

### Check 1: Environment Variable Loaded
In your terminal where dev server is running, add this temporarily to the API route to debug:

```typescript
console.log('Service role key exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log('Service role key length:', process.env.SUPABASE_SERVICE_ROLE_KEY?.length);
```

### Check 2: Correct File Name
Make sure file is named exactly: `.env.local` (with the dot at the start)

### Check 3: No Spaces
Ensure no spaces around the `=` sign in `.env.local`:
```bash
# ✅ Correct:
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ❌ Wrong:
SUPABASE_SERVICE_ROLE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Check 4: File in Correct Location
The `.env.local` file should be in the project root (same directory as `package.json`)

---

## Why This Happened

The API route tried to create a Supabase client with `undefined` as the service role key:

```typescript
// This crashed because SUPABASE_SERVICE_ROLE_KEY was undefined
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // ← undefined!
  ...
)
```

When the route crashed, Next.js returned a 500 error page (HTML), which your frontend tried to parse as JSON → error.

**Now fixed:** The route checks if the key exists and returns a proper JSON error message instead of crashing.

---

## Security Note

The service role key bypasses Row Level Security (RLS) and has full database access. That's why:
- It must ONLY be used in server-side code (API routes)
- Never expose it in client components
- Never commit `.env.local` to git (it's in `.gitignore`)
- Only use it for admin operations like creating user accounts

---

## After Fix Works

Once this works, you can:
1. Create staff accounts with login credentials
2. Staff can sign in with those credentials
3. Manage staff from the dashboard
4. Delete users from Supabase Authentication (after running migration 012)
