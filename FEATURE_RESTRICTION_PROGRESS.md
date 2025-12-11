# Feature Restriction System - Implementation Log

## ✅ Step 1: COMPLETE - Navigation Layer (UI Filtering)

### What We Built:

#### 1. **Feature Access Utility** (`lib/features/access.ts`)
- `getTenantFeatures()` - Gets all features for current tenant's plan
- `hasFeatureAccess(feature)` - Check if tenant has specific feature
- `getTenantPlanCode()` - Get tenant's current plan code
- **Purpose**: Core logic to check plan features from database

#### 2. **React Hooks** (`lib/features/hooks.ts`)
- `useFeatureAccess(feature)` - Hook for checking single feature
- `useTenantFeatures()` - Hook for getting all features + plan code
- `useHasFeature(feature)` - Simple boolean hook
- **Purpose**: Easy access to feature checks in React components

#### 3. **Feature Guard Component** (`components/features/FeatureGuard.tsx`)
- `<FeatureGuard feature="staff">` - Wraps restricted content
- Shows "Upgrade" prompt if no access
- Loading state while checking access
- **Purpose**: Protect entire pages/sections from access

#### 4. **Sidebar Filtering** (`components/layout/sidebar.tsx`)
- Added `requiredFeature` to all NavItem definitions
- Menu items now filtered by BOTH role AND plan features
- **Example**:
  - Basic plan: Won't see "Staff Management" link
  - Professional plan: Will see "Staff Management" link
  - Enterprise plan: Will see "WhatsApp Broadcasts" link

### How It Works:

```tsx
// Sidebar loads tenant's features from database
const { features, planCode } = useTenantFeatures();

// Each menu item has a required feature
{ 
  name: 'Staff Management', 
  href: '/dashboard/staff', 
  requiredFeature: 'staff'  // <- This feature
}

// Filter logic checks both role AND feature
const filterByRoleAndFeatures = (items) => {
  return items.filter(item => {
    if (!item.allowedRoles.includes(userRole)) return false;
    if (item.requiredFeature && features) {
      return features[item.requiredFeature] === true; // <- Check here
    }
    return true;
  });
};
```

### Test Results Expected:

#### Basic Plan User (₹1,500/mo):
**Will SEE in sidebar:**
- ✅ Dashboard
- ✅ Bookings
- ✅ Calendar
- ✅ Clients
- ✅ Services
- ✅ POS

**Will NOT SEE:**
- ❌ Staff Management
- ❌ Attendance
- ❌ Marketing
- ❌ WhatsApp Broadcasts
- ❌ Inventory
- ❌ Analytics

#### Professional Plan User (₹2,500/mo):
**Will SEE:**
- ✅ Everything in Basic
- ✅ Staff Management
- ✅ Attendance Management
- ✅ Marketing
- ✅ Inventory
- ✅ Analytics

**Will NOT SEE:**
- ❌ WhatsApp Broadcasts (Enterprise only)

---

## 🔜 Step 2: NEXT - Page Guards (URL Protection)

### What Needs to Be Done:

Even if we hide menu items, users can still type URLs directly:
- `elysalon.elyspr.com/dashboard/staff` <- Basic plan user shouldn't access this

### Solution:
Wrap each protected page with `<FeatureGuard>`:

```tsx
// app/dashboard/staff/page.tsx
export default function StaffPage() {
  return (
    <FeatureGuard feature="staff">
      {/* Actual staff page content */}
    </FeatureGuard>
  );
}
```

### Pages That Need Guards:

**Staff Management** (feature: 'staff'):
- `/dashboard/staff`
- `/dashboard/staff/new`
- `/dashboard/staff/[id]`
- `/dashboard/staff/attendance`
- `/dashboard/staff/attendance/clock`
- `/dashboard/staff/attendance/leave-requests`

**Marketing** (feature: 'marketing'):
- `/dashboard/marketing`

**Inventory** (feature: 'inventory'):
- `/dashboard/inventory`
- `/dashboard/inventory/new`
- `/dashboard/inventory/[id]`

**Analytics** (feature: 'analytics'):
- `/dashboard/analytics`

**Broadcasts** (feature: 'broadcasts'):
- `/dashboard/broadcasts`

---

## 🔜 Step 3: AFTER Step 2 - API Guards (Backend Protection)

### What Needs to Be Done:

Even if UI is blocked, users could use browser console or API calls:
```javascript
fetch('/api/staff', { method: 'POST', ... })
```

### Solution:
Check features in API routes before processing:

```typescript
// app/api/staff/route.ts
export async function POST(request: Request) {
  const supabase = await createServerClient();
  
  // Check if tenant has staff feature
  const hasAccess = await checkTenantFeature('staff');
  
  if (!hasAccess) {
    return Response.json(
      { error: 'Feature not available in your plan' }, 
      { status: 403 }
    );
  }
  
  // Continue with staff creation...
}
```

### API Routes That Need Guards:
- `/api/staff/*` - Staff feature
- `/api/broadcasts/*` - Broadcasts feature
- `/api/inventory/*` - Inventory feature
- `/api/marketing/*` - Marketing feature
- `/api/attendance/*` - Attendance feature

---

## 📋 Testing Checklist:

### Step 1 (Current):
- [ ] Create test tenant with Basic plan
- [ ] Login and check sidebar - should NOT see Staff/Marketing/etc
- [ ] Switch to Professional plan in database
- [ ] Refresh - should now see Staff/Marketing
- [ ] Switch to Enterprise - should see Broadcasts

### Step 2 (Next):
- [ ] Try accessing `/dashboard/staff` with Basic plan
- [ ] Should see "Feature Not Available" prompt
- [ ] Try accessing with Professional plan
- [ ] Should see staff page normally

### Step 3 (Final):
- [ ] Try API call to create staff with Basic plan
- [ ] Should get 403 error
- [ ] Try with Professional plan
- [ ] Should work normally

---

## 🎯 Current Status:

**✅ DONE:**
- Feature access utilities
- React hooks for feature checking
- FeatureGuard component
- Sidebar filtering by features
- Plan database with features defined

**🔄 IN PROGRESS:**
- None (waiting for your confirmation)

**⏳ TODO:**
- Add FeatureGuard to all protected pages
- Add feature checks to all API routes
- Test with different plans
- Deploy to production

---

## 💡 Next Steps:

1. **Test Step 1** (15 minutes)
   - Run migration to seed plans
   - Test sidebar filtering with different plans
   - Verify menu items show/hide correctly

2. **Implement Step 2** (1-2 hours)
   - Add FeatureGuard to all protected pages
   - Test URL access with different plans

3. **Implement Step 3** (2-3 hours)
   - Add API route protection
   - Test API calls with different plans

**Total remaining time: 3-5 hours to complete all 3 layers**

---

Ready to test Step 1? We need to:
1. Run the plan migration in Supabase
2. Manually set a test tenant to Basic plan
3. Login and verify sidebar filtering works

Want me to proceed with Step 2 (Page Guards) now, or test Step 1 first?
