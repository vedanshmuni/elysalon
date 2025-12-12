-- ============================================
-- MULTI-PRODUCT SAAS ARCHITECTURE
-- ============================================
-- This migration adds support for multiple products (salon, restaurant, clinic, etc.)
-- under a unified billing system at elyspr.com

-- Ensure all required columns exist if products table already exists
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS code TEXT UNIQUE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS icon TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS subdomain TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS app_url TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS features_json JSONB DEFAULT '{}';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS settings_json JSONB DEFAULT '{}';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Ensure tenant_id exists and allow NULLs so seed inserts succeed even if older schema required NOT NULL
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tenant_id UUID;

DO $$
BEGIN
    -- If tenant_id exists and is NOT NULL, drop the NOT NULL constraint so seeding works
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'tenant_id'
    ) THEN
        BEGIN
            EXECUTE 'ALTER TABLE public.products ALTER COLUMN tenant_id DROP NOT NULL';
        EXCEPTION WHEN undefined_column THEN
            -- ignore if column doesn't exist during race
            NULL;
        END;
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,  -- 'salon', 'restaurant', 'clinic', etc.
    slug TEXT UNIQUE NOT NULL,  -- URL-friendly
    description TEXT,
    icon TEXT,  -- Icon name or URL
    subdomain TEXT,  -- 'salon', 'restaurant', etc. for elysalon.elyspr.com
    app_url TEXT,  -- Full URL: https://elysalon.elyspr.com
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    features_json JSONB DEFAULT '{}',  -- Product-specific features
    settings_json JSONB DEFAULT '{}',  -- Product-specific settings
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add product_id to existing tables
ALTER TABLE public.tenants 
    ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id);

ALTER TABLE public.plans
    ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id);

-- ============================================
-- SEED PRODUCTS
-- ============================================
INSERT INTO public.products (name, code, slug, description, subdomain, app_url, sort_order, is_active) VALUES
    (
        'SalonOS',
        'salon',
        'salon',
        'Complete salon and spa management software',
        'salon',
        'https://elysalon.elyspr.com',
        1,
        true
    ),
    (
        'RestaurantOS',
        'restaurant',
        'restaurant',
        'Restaurant and food service management',
        'restaurant',
        'https://restaurant.elyspr.com',
        2,
        true
    ),
    (
        'ClinicOS',
        'clinic',
        'clinic',
        'Healthcare clinic and patient management',
        'clinic',
        'https://clinic.elyspr.com',
        3,
        true
    ),
    (
        'GymOS',
        'gym',
        'gym',
        'Gym and fitness center management',
        'gym',
        'https://gym.elyspr.com',
        4,
        true
    ),
    (
        'SpaOS',
        'spa',
        'spa',
        'Spa and wellness center management',
        'spa',
        'https://spa.elyspr.com',
        5,
        true
    ),
    (
        'HotelOS',
        'hotel',
        'hotel',
        'Hotel and hospitality management',
        'hotel',
        'https://hotel.elyspr.com',
        6,
        true
    ),
    (
        'RetailOS',
        'retail',
        'retail',
        'Retail store and inventory management',
        'retail',
        'https://retail.elyspr.com',
        7,
        true
    ),
    (
        'AutoOS',
        'automotive',
        'automotive',
        'Auto service and repair shop management',
        'automotive',
        'https://automotive.elyspr.com',
        8,
        true
    )
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- UPDATE EXISTING PLANS TO LINK WITH SALON PRODUCT
-- ============================================
-- Get salon product_id and update plans
DO $$
DECLARE
    salon_product_id UUID;
BEGIN
    -- Get salon product ID
    SELECT id INTO salon_product_id FROM public.products WHERE code = 'salon';
    
    -- Update existing plans to link with salon product
    UPDATE public.plans 
    SET product_id = salon_product_id
    WHERE product_id IS NULL;
    
    -- Update existing tenants to link with salon product
    UPDATE public.tenants
    SET product_id = salon_product_id
    WHERE product_id IS NULL;
END $$;

-- ============================================
-- SUBSCRIPTION TRACKING
-- ============================================
-- Add source tracking to subscriptions (where payment came from)
ALTER TABLE public.tenant_subscriptions
    ADD COLUMN IF NOT EXISTS payment_source TEXT DEFAULT 'direct',  -- 'elyspr_hub', 'direct', 'admin'
    ADD COLUMN IF NOT EXISTS payment_metadata JSONB DEFAULT '{}';  -- Store payment details

-- ============================================
-- RLS POLICIES FOR PRODUCTS
-- ============================================
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Anyone can view active products
CREATE POLICY "Anyone can view active products"
    ON public.products FOR SELECT
    USING (is_active = true);

-- Only super admins can modify products
CREATE POLICY "Only super admins can modify products"
    ON public.products FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users
            WHERE tenant_users.user_id = auth.uid()
            AND tenant_users.role = 'SUPER_ADMIN'
        )
    );

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_products_code ON public.products(code);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);
CREATE INDEX IF NOT EXISTS idx_tenants_product_id ON public.tenants(product_id);
CREATE INDEX IF NOT EXISTS idx_plans_product_id ON public.plans(product_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to get product by code
CREATE OR REPLACE FUNCTION get_product_by_code(product_code TEXT)
RETURNS TABLE (
    id UUID,
    name TEXT,
    code TEXT,
    slug TEXT,
    description TEXT,
    subdomain TEXT,
    app_url TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.name, p.code, p.slug, p.description, p.subdomain, p.app_url
    FROM public.products p
    WHERE p.code = product_code AND p.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get plans by product
CREATE OR REPLACE FUNCTION get_plans_by_product(product_code TEXT)
RETURNS TABLE (
    id UUID,
    name TEXT,
    code TEXT,
    monthly_price_in_inr NUMERIC,
    yearly_price_in_inr NUMERIC,
    features_json JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.name, p.code, p.monthly_price_in_inr, p.yearly_price_in_inr, p.features_json
    FROM public.plans p
    JOIN public.products prod ON p.product_id = prod.id
    WHERE prod.code = product_code AND p.is_active = true
    ORDER BY p.monthly_price_in_inr ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE public.products IS 'All products available in the ELYSPR suite';
COMMENT ON COLUMN public.tenants.product_id IS 'Which product this tenant is using';
COMMENT ON COLUMN public.plans.product_id IS 'Which product this plan belongs to';
