-- Row Level Security (RLS) Policies for SalonOS
-- Ensures tenant isolation and role-based access control

-- Enable RLS on all tables
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_combo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_tag_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to check if user belongs to tenant
CREATE OR REPLACE FUNCTION user_belongs_to_tenant(tenant_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.tenant_users
        WHERE tenant_users.tenant_id = tenant_id_param
        AND tenant_users.user_id = auth.uid()
        AND tenant_users.is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user role in tenant
CREATE OR REPLACE FUNCTION get_user_role_in_tenant(tenant_id_param UUID)
RETURNS user_role AS $$
DECLARE
    user_role_result user_role;
BEGIN
    SELECT role INTO user_role_result
    FROM public.tenant_users
    WHERE tenant_users.tenant_id = tenant_id_param
    AND tenant_users.user_id = auth.uid()
    AND tenant_users.is_active = true
    LIMIT 1;
    
    RETURN user_role_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is owner or manager
CREATE OR REPLACE FUNCTION user_is_owner_or_manager(tenant_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_role_result user_role;
BEGIN
    user_role_result := get_user_role_in_tenant(tenant_id_param);
    RETURN user_role_result IN ('OWNER', 'MANAGER', 'SUPER_ADMIN');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TENANTS POLICIES
-- ============================================

CREATE POLICY "Users can view their own tenants"
    ON public.tenants FOR SELECT
    USING (
        id IN (
            SELECT tenant_id FROM public.tenant_users
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Owners can update their tenants"
    ON public.tenants FOR UPDATE
    USING (user_is_owner_or_manager(id));

CREATE POLICY "Any authenticated user can create tenant (onboarding)"
    ON public.tenants FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================
-- PROFILES POLICIES
-- ============================================

CREATE POLICY "Users can view all profiles"
    ON public.profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- ============================================
-- TENANT_USERS POLICIES
-- ============================================

CREATE POLICY "Users can view tenant memberships for their tenants"
    ON public.tenant_users FOR SELECT
    USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Owners can manage tenant users"
    ON public.tenant_users FOR ALL
    USING (user_is_owner_or_manager(tenant_id));

-- ============================================
-- BRANCHES POLICIES
-- ============================================

CREATE POLICY "Users can view branches of their tenants"
    ON public.branches FOR SELECT
    USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Owners can manage branches"
    ON public.branches FOR ALL
    USING (user_is_owner_or_manager(tenant_id));

-- ============================================
-- SERVICE CATALOG POLICIES
-- ============================================

CREATE POLICY "Users can view service categories"
    ON public.service_categories FOR SELECT
    USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Managers can manage service categories"
    ON public.service_categories FOR ALL
    USING (user_is_owner_or_manager(tenant_id));

CREATE POLICY "Users can view services"
    ON public.services FOR SELECT
    USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Managers can manage services"
    ON public.services FOR ALL
    USING (user_is_owner_or_manager(tenant_id));

CREATE POLICY "Users can view service combos"
    ON public.service_combos FOR SELECT
    USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Managers can manage service combos"
    ON public.service_combos FOR ALL
    USING (user_is_owner_or_manager(tenant_id));

CREATE POLICY "Users can view combo items"
    ON public.service_combo_items FOR SELECT
    USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Managers can manage combo items"
    ON public.service_combo_items FOR ALL
    USING (user_is_owner_or_manager(tenant_id));

-- ============================================
-- CLIENTS POLICIES
-- ============================================

CREATE POLICY "Users can view clients of their tenant"
    ON public.clients FOR SELECT
    USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can create clients"
    ON public.clients FOR INSERT
    WITH CHECK (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can update clients"
    ON public.clients FOR UPDATE
    USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Managers can delete clients"
    ON public.clients FOR DELETE
    USING (user_is_owner_or_manager(tenant_id));

CREATE POLICY "Users can view client notes"
    ON public.client_notes FOR SELECT
    USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can create client notes"
    ON public.client_notes FOR INSERT
    WITH CHECK (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can view client photos"
    ON public.client_photos FOR SELECT
    USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can manage client photos"
    ON public.client_photos FOR ALL
    USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can view client tags"
    ON public.client_tags FOR SELECT
    USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can manage client tags"
    ON public.client_tags FOR ALL
    USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can view client tag links"
    ON public.client_tag_links FOR SELECT
    USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can manage client tag links"
    ON public.client_tag_links FOR ALL
    USING (user_belongs_to_tenant(tenant_id));

-- ============================================
-- BOOKINGS POLICIES
-- ============================================

CREATE POLICY "Users can view bookings"
    ON public.bookings FOR SELECT
    USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can create bookings"
    ON public.bookings FOR INSERT
    WITH CHECK (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can update bookings"
    ON public.bookings FOR UPDATE
    USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Managers can delete bookings"
    ON public.bookings FOR DELETE
    USING (user_is_owner_or_manager(tenant_id));

CREATE POLICY "Users can view booking items"
    ON public.booking_items FOR SELECT
    USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can manage booking items"
    ON public.booking_items FOR ALL
    USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can view resources"
    ON public.resources FOR SELECT
    USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Managers can manage resources"
    ON public.resources FOR ALL
    USING (user_is_owner_or_manager(tenant_id));

CREATE POLICY "Users can view booking resources"
    ON public.booking_resources FOR SELECT
    USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can manage booking resources"
    ON public.booking_resources FOR ALL
    USING (user_belongs_to_tenant(tenant_id));

-- ============================================
-- STAFF POLICIES
-- ============================================

CREATE POLICY "Users can view staff"
    ON public.staff FOR SELECT
    USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Managers can manage staff"
    ON public.staff FOR ALL
    USING (user_is_owner_or_manager(tenant_id));

CREATE POLICY "Users can view staff shifts"
    ON public.staff_shifts FOR SELECT
    USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Managers can manage staff shifts"
    ON public.staff_shifts FOR ALL
    USING (user_is_owner_or_manager(tenant_id));

CREATE POLICY "Managers can view commission rules"
    ON public.commission_rules FOR SELECT
    USING (user_is_owner_or_manager(tenant_id));

CREATE POLICY "Owners can manage commission rules"
    ON public.commission_rules FOR ALL
    USING (user_is_owner_or_manager(tenant_id));

CREATE POLICY "Users can view staff earnings"
    ON public.staff_earnings FOR SELECT
    USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Managers can manage staff earnings"
    ON public.staff_earnings FOR ALL
    USING (user_is_owner_or_manager(tenant_id));

-- ============================================
-- INVOICES & PAYMENTS POLICIES
-- ============================================

CREATE POLICY "Users can view invoices"
    ON public.invoices FOR SELECT
    USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can create invoices"
    ON public.invoices FOR INSERT
    WITH CHECK (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can update invoices"
    ON public.invoices FOR UPDATE
    USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Managers can delete invoices"
    ON public.invoices FOR DELETE
    USING (user_is_owner_or_manager(tenant_id));

CREATE POLICY "Users can view invoice items"
    ON public.invoice_items FOR SELECT
    USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can manage invoice items"
    ON public.invoice_items FOR ALL
    USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can view payments"
    ON public.payments FOR SELECT
    USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can create payments"
    ON public.payments FOR INSERT
    WITH CHECK (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can view coupons"
    ON public.coupons FOR SELECT
    USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Managers can manage coupons"
    ON public.coupons FOR ALL
    USING (user_is_owner_or_manager(tenant_id));

CREATE POLICY "Users can view loyalty accounts"
    ON public.loyalty_accounts FOR SELECT
    USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can manage loyalty accounts"
    ON public.loyalty_accounts FOR ALL
    USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can view loyalty transactions"
    ON public.loyalty_transactions FOR SELECT
    USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can create loyalty transactions"
    ON public.loyalty_transactions FOR INSERT
    WITH CHECK (user_belongs_to_tenant(tenant_id));

-- ============================================
-- INVENTORY POLICIES
-- ============================================

CREATE POLICY "Users can view products"
    ON public.products FOR SELECT
    USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Managers can manage products"
    ON public.products FOR ALL
    USING (user_is_owner_or_manager(tenant_id));

CREATE POLICY "Users can view product stocks"
    ON public.product_stocks FOR SELECT
    USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can manage product stocks"
    ON public.product_stocks FOR ALL
    USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can view vendors"
    ON public.vendors FOR SELECT
    USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Managers can manage vendors"
    ON public.vendors FOR ALL
    USING (user_is_owner_or_manager(tenant_id));

CREATE POLICY "Users can view purchase orders"
    ON public.purchase_orders FOR SELECT
    USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Managers can manage purchase orders"
    ON public.purchase_orders FOR ALL
    USING (user_is_owner_or_manager(tenant_id));

CREATE POLICY "Users can view purchase order items"
    ON public.purchase_order_items FOR SELECT
    USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Managers can manage purchase order items"
    ON public.purchase_order_items FOR ALL
    USING (user_is_owner_or_manager(tenant_id));

CREATE POLICY "Users can view service recipes"
    ON public.service_recipes FOR SELECT
    USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Managers can manage service recipes"
    ON public.service_recipes FOR ALL
    USING (user_is_owner_or_manager(tenant_id));

-- ============================================
-- MARKETING POLICIES
-- ============================================

CREATE POLICY "Users can view campaign templates"
    ON public.campaign_templates FOR SELECT
    USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Managers can manage campaign templates"
    ON public.campaign_templates FOR ALL
    USING (user_is_owner_or_manager(tenant_id));

CREATE POLICY "Users can view campaigns"
    ON public.campaigns FOR SELECT
    USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Managers can manage campaigns"
    ON public.campaigns FOR ALL
    USING (user_is_owner_or_manager(tenant_id));

CREATE POLICY "Users can view automation rules"
    ON public.automation_rules FOR SELECT
    USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Managers can manage automation rules"
    ON public.automation_rules FOR ALL
    USING (user_is_owner_or_manager(tenant_id));

CREATE POLICY "Users can view notification logs"
    ON public.notification_logs FOR SELECT
    USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can create notification logs"
    ON public.notification_logs FOR INSERT
    WITH CHECK (user_belongs_to_tenant(tenant_id));

-- ============================================
-- ANALYTICS POLICIES
-- ============================================

CREATE POLICY "Users can view analytics snapshots"
    ON public.analytics_snapshots FOR SELECT
    USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "System can insert analytics snapshots"
    ON public.analytics_snapshots FOR INSERT
    WITH CHECK (user_belongs_to_tenant(tenant_id));

-- ============================================
-- PLANS & SUBSCRIPTIONS POLICIES
-- ============================================

CREATE POLICY "Anyone can view plans"
    ON public.plans FOR SELECT
    USING (true);

CREATE POLICY "Users can view their tenant subscriptions"
    ON public.tenant_subscriptions FOR SELECT
    USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Owners can manage subscriptions"
    ON public.tenant_subscriptions FOR ALL
    USING (user_is_owner_or_manager(tenant_id));
