# Razorpay Integration Setup Guide

## ✅ What's Been Created

### 1. **Database Migration** (`supabase/migrations/020_seed_plans.sql`)
   - Seeds 3 plans: Starter (₹999), Professional (₹2,999), Enterprise (₹7,999)
   - Run this in Supabase SQL Editor

### 2. **Pricing Page** (`/pricing`)
   - Beautiful pricing cards with features
   - Monthly/Yearly toggle
   - Free trial messaging
   - Plan comparison

### 3. **Billing Dashboard** (`/dashboard/settings/billing`)
   - View current subscription
   - Plan details
   - Usage limits
   - Change plan button

### 4. **Settings Integration**
   - Added "Billing & Subscription" card in Settings
   - Quick access to billing management

---

## 🚀 Next Steps (In Order)

### Step 1: Seed the Plans (5 minutes)

1. Go to your **Supabase Dashboard**
2. Click **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy entire content from `supabase/migrations/020_seed_plans.sql`
5. Paste and click **Run**
6. You should see: "Success. No rows returned"

**Verify:**
```sql
SELECT * FROM plans;
```
You should see 3 plans.

---

### Step 2: Get Razorpay Credentials (10 minutes)

1. Go to **Razorpay Dashboard**: https://dashboard.razorpay.com
2. Click **Settings** → **API Keys** (left sidebar)
3. Click **Generate Test Key** (if not already generated)
4. You'll see:
   - **Key ID**: `rzp_test_xxxxxxxxxxxx`
   - **Key Secret**: Click "Show" and copy

**Save these somewhere safe!**

---

### Step 3: Update Environment Variables (2 minutes)

1. Open your `.env.local` file (create if doesn't exist)
2. Add these lines:

```env
# Razorpay Configuration
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_your_key_id_here
RAZORPAY_KEY_SECRET=your_secret_key_here
RAZORPAY_WEBHOOK_SECRET=some_random_string_here
```

3. Replace the values with your actual keys
4. For webhook secret, use any random string for now (we'll configure this later)

---

### Step 4: Test the Pricing Page (2 minutes)

1. Start your dev server:
```bash
npm run dev
```

2. Navigate to: http://localhost:3000/pricing

3. You should see 3 beautiful pricing cards!

4. Try clicking "Start Free Trial" (won't work yet, but UI should be there)

---

### Step 5: Test Billing Dashboard (2 minutes)

1. Go to: http://localhost:3000/dashboard/settings

2. You should see "Billing & Subscription" card at the top

3. Click "Manage Subscription"

4. You'll see your current subscription status (if any)

---

## 🎯 What's Next? (Ready for Tomorrow)

After you verify Steps 1-5 work, we'll implement:

### Phase 2: Razorpay Checkout Integration (4 hours)
- [ ] Install Razorpay package
- [ ] Create checkout API route
- [ ] Integrate Razorpay button
- [ ] Handle successful payment
- [ ] Create webhook handler

### Phase 3: Subscription Management (2 hours)
- [ ] Auto-activate subscription on payment
- [ ] Trial period logic
- [ ] Usage limits enforcement
- [ ] Upgrade/downgrade functionality

### Phase 4: Production (2 hours)
- [ ] Switch to live keys
- [ ] Set up webhook URL
- [ ] Test with real payment
- [ ] Document for users

---

## 📸 Screenshots Expected

### Pricing Page Should Look Like:
- Toggle for Monthly/Yearly
- 3 cards with "Most Popular" badge on middle one
- Feature lists with checkmarks
- "Start Free Trial" buttons

### Billing Dashboard Should Show:
- Current plan name with status badge
- Pricing information
- Current period dates
- Usage limits (branches/staff)
- "Change Plan" button

---

## ❓ Troubleshooting

### Plans don't show on pricing page?
**Solution**: Run the migration in Step 1 again

### Pricing page shows "Loading..."?
**Solution**: Check browser console for errors. Verify Supabase connection.

### Billing page shows "No Active Subscription"?
**Solution**: This is normal! You haven't subscribed yet. The UI is working correctly.

---

## 🎉 You're Ready!

Once you verify Steps 1-5 work, message me and I'll build the actual Razorpay payment integration!

**Estimated time to complete Steps 1-5**: 20 minutes
**Total time until live billing**: 8-10 hours of development

Let me know when you're ready for Phase 2! 🚀
