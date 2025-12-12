# Phase 1 Testing Guide

Since we have implemented the secure backend flow, here is how to verify it.

## 1. Apply Migrations
First, ensure the new database tables and functions are created. Run these files in your Supabase SQL Editor in order:

1. `supabase/migrations/031_subscription_tokens.sql` (Creates token table)
2. `supabase/migrations/032_update_onboarding_for_plans.sql` (Updates onboarding logic)

## 2. Run the Test Script
I have created a comprehensive SQL test script that simulates the entire flow:
- Creates a fake user
- Simulates a payment (creates a token)
- Redeems the token
- Runs onboarding
- Verifies that the **Free Trial was skipped** and the **Paid Plan was applied**.

**To run the test:**
1. Open `TEST_PHASE_1.sql`
2. Copy the content
3. Paste it into the Supabase SQL Editor
4. Click **Run**

## 3. Expected Output
You should see messages like:
```
NOTICE:  1. Creating a test user...
NOTICE:  2. Simulating Payment & Token Generation...
NOTICE:  3. Simulating Token Redemption (API Call)...
NOTICE:  Token redeemed successfully!
NOTICE:  4. Simulating Onboarding (Frontend Call)...
NOTICE:  Onboarding Result: {"tenant_id": "...", "success": true}
NOTICE:  5. Verifying Results...
NOTICE:  ✅ SUCCESS: Tenant created with PROFESSIONAL plan (ignoring TRIAL input)
NOTICE:  ✅ SUCCESS: Subscription is ACTIVE (No Trial)
```

## 4. Manual Verification (Optional)
If you want to verify manually in the dashboard:
1. Check the `subscription_tokens` table. You should see a token with `is_used = true`.
2. Check the `tenants` table. The new tenant should have `plan_code = 'PROFESSIONAL'`.
3. Check the `tenant_subscriptions` table. The status should be `ACTIVE` (not TRIAL).
