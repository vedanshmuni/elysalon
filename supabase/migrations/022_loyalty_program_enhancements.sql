-- Enhanced Loyalty Program System for SalonOS
-- Adds tiered membership, redemption rules, and program configuration

-- Add tier and lifetime stats to loyalty_accounts
ALTER TABLE public.loyalty_accounts
ADD COLUMN tier VARCHAR(20) DEFAULT 'BRONZE' CHECK (tier IN ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM')),
ADD COLUMN lifetime_points INTEGER DEFAULT 0,
ADD COLUMN total_visits INTEGER DEFAULT 0,
ADD COLUMN total_spent DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN tier_upgraded_at TIMESTAMPTZ,
ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();

-- Add reference type to loyalty_transactions
ALTER TABLE public.loyalty_transactions
ADD COLUMN transaction_type VARCHAR(50) CHECK (transaction_type IN ('EARN_PURCHASE', 'EARN_VISIT', 'EARN_BIRTHDAY', 'EARN_REFERRAL', 'EARN_BONUS', 'REDEEM_SERVICE', 'REDEEM_PRODUCT', 'REDEEM_DISCOUNT', 'ADJUSTMENT', 'EXPIRE')),
ADD COLUMN reference_id UUID,
ADD COLUMN reference_type VARCHAR(50),
ADD COLUMN notes TEXT;

-- Loyalty Program Configuration Table
CREATE TABLE public.loyalty_program_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
    
    -- Program Status
    is_active BOOLEAN DEFAULT true,
    program_name VARCHAR(100) DEFAULT 'Loyalty Rewards',
    
    -- Points Earning Rules
    points_per_rupee DECIMAL(5,2) DEFAULT 1.00, -- 1 point per ₹1 spent
    points_per_visit INTEGER DEFAULT 10,
    birthday_bonus_points INTEGER DEFAULT 100,
    referral_bonus_points INTEGER DEFAULT 200,
    
    -- Tier Thresholds (based on lifetime points)
    silver_threshold INTEGER DEFAULT 500,
    gold_threshold INTEGER DEFAULT 2000,
    platinum_threshold INTEGER DEFAULT 5000,
    
    -- Tier Benefits (percentage multipliers)
    silver_points_multiplier DECIMAL(3,2) DEFAULT 1.00,
    gold_points_multiplier DECIMAL(3,2) DEFAULT 1.25,
    platinum_points_multiplier DECIMAL(3,2) DEFAULT 1.50,
    
    -- Redemption Rules
    min_points_redemption INTEGER DEFAULT 100,
    points_to_rupee_value DECIMAL(5,2) DEFAULT 0.50, -- 100 points = ₹50
    max_redemption_percent INTEGER DEFAULT 50, -- Max 50% of bill can be paid with points
    
    -- Expiration
    enable_points_expiry BOOLEAN DEFAULT false,
    points_expiry_months INTEGER DEFAULT 12,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Loyalty Rewards Catalog (predefined rewards clients can redeem)
CREATE TABLE public.loyalty_rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    reward_name VARCHAR(200) NOT NULL,
    description TEXT,
    reward_type VARCHAR(50) CHECK (reward_type IN ('SERVICE', 'PRODUCT', 'DISCOUNT_PERCENT', 'DISCOUNT_FIXED', 'FREE_UPGRADE')),
    
    -- Redemption Cost
    points_required INTEGER NOT NULL,
    
    -- Reward Details
    service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    discount_value DECIMAL(10,2), -- For discount rewards
    
    -- Availability
    is_active BOOLEAN DEFAULT true,
    min_tier VARCHAR(20) CHECK (min_tier IN ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM')),
    max_redemptions_per_client INTEGER, -- NULL = unlimited
    valid_from TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Loyalty Redemptions (track when clients redeem rewards)
CREATE TABLE public.loyalty_redemptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    loyalty_account_id UUID NOT NULL REFERENCES public.loyalty_accounts(id) ON DELETE CASCADE,
    loyalty_reward_id UUID REFERENCES public.loyalty_rewards(id) ON DELETE SET NULL,
    
    points_redeemed INTEGER NOT NULL,
    reward_value DECIMAL(10,2), -- Actual rupee value of reward
    
    -- Applied to
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPLIED', 'CANCELLED')),
    redeemed_at TIMESTAMPTZ DEFAULT NOW(),
    applied_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_loyalty_accounts_tenant_client ON public.loyalty_accounts(tenant_id, client_id);
CREATE INDEX idx_loyalty_accounts_tier ON public.loyalty_accounts(tenant_id, tier);
CREATE INDEX idx_loyalty_transactions_account ON public.loyalty_transactions(loyalty_account_id);
CREATE INDEX idx_loyalty_transactions_tenant ON public.loyalty_transactions(tenant_id, created_at DESC);
CREATE INDEX idx_loyalty_rewards_tenant_active ON public.loyalty_rewards(tenant_id, is_active);
CREATE INDEX idx_loyalty_redemptions_account ON public.loyalty_redemptions(loyalty_account_id);
CREATE INDEX idx_loyalty_redemptions_invoice ON public.loyalty_redemptions(invoice_id);

-- Insert default loyalty config for existing tenants
INSERT INTO public.loyalty_program_config (tenant_id)
SELECT id FROM public.tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- Function to calculate and update tier based on lifetime points
CREATE OR REPLACE FUNCTION update_loyalty_tier()
RETURNS TRIGGER AS $$
DECLARE
    config RECORD;
    new_tier VARCHAR(20);
BEGIN
    -- Get loyalty config for tenant
    SELECT * INTO config
    FROM loyalty_program_config
    WHERE tenant_id = NEW.tenant_id;
    
    -- Determine tier based on lifetime points
    IF NEW.lifetime_points >= config.platinum_threshold THEN
        new_tier := 'PLATINUM';
    ELSIF NEW.lifetime_points >= config.gold_threshold THEN
        new_tier := 'GOLD';
    ELSIF NEW.lifetime_points >= config.silver_threshold THEN
        new_tier := 'SILVER';
    ELSE
        new_tier := 'BRONZE';
    END IF;
    
    -- Update tier if changed
    IF NEW.tier != new_tier THEN
        NEW.tier := new_tier;
        NEW.tier_upgraded_at := NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update tier
CREATE TRIGGER trigger_update_loyalty_tier
BEFORE UPDATE OF lifetime_points ON public.loyalty_accounts
FOR EACH ROW
EXECUTE FUNCTION update_loyalty_tier();

-- Function to add loyalty points transaction
CREATE OR REPLACE FUNCTION add_loyalty_points(
    p_tenant_id UUID,
    p_client_id UUID,
    p_points INTEGER,
    p_transaction_type VARCHAR,
    p_reason TEXT DEFAULT NULL,
    p_reference_id UUID DEFAULT NULL,
    p_reference_type VARCHAR DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_account_id UUID;
    v_transaction_id UUID;
    v_multiplier DECIMAL(3,2);
    v_actual_points INTEGER;
BEGIN
    -- Get or create loyalty account
    INSERT INTO loyalty_accounts (tenant_id, client_id)
    VALUES (p_tenant_id, p_client_id)
    ON CONFLICT (tenant_id, client_id) DO NOTHING
    RETURNING id INTO v_account_id;
    
    IF v_account_id IS NULL THEN
        SELECT id INTO v_account_id
        FROM loyalty_accounts
        WHERE tenant_id = p_tenant_id AND client_id = p_client_id;
    END IF;
    
    -- Get tier multiplier
    SELECT CASE tier
        WHEN 'PLATINUM' THEN (SELECT platinum_points_multiplier FROM loyalty_program_config WHERE tenant_id = p_tenant_id)
        WHEN 'GOLD' THEN (SELECT gold_points_multiplier FROM loyalty_program_config WHERE tenant_id = p_tenant_id)
        WHEN 'SILVER' THEN (SELECT silver_points_multiplier FROM loyalty_program_config WHERE tenant_id = p_tenant_id)
        ELSE 1.00
    END INTO v_multiplier
    FROM loyalty_accounts
    WHERE id = v_account_id;
    
    -- Apply multiplier for earning transactions only
    IF p_transaction_type LIKE 'EARN_%' THEN
        v_actual_points := FLOOR(p_points * v_multiplier);
    ELSE
        v_actual_points := p_points;
    END IF;
    
    -- Create transaction
    INSERT INTO loyalty_transactions (
        tenant_id, loyalty_account_id, delta_points, transaction_type,
        reason, reference_id, reference_type, notes
    ) VALUES (
        p_tenant_id, v_account_id, v_actual_points, p_transaction_type,
        p_reason, p_reference_id, p_reference_type, NULL
    ) RETURNING id INTO v_transaction_id;
    
    -- Update account balances
    UPDATE loyalty_accounts
    SET 
        points_balance = points_balance + v_actual_points,
        lifetime_points = CASE 
            WHEN v_actual_points > 0 THEN lifetime_points + v_actual_points
            ELSE lifetime_points
        END,
        last_updated_at = NOW()
    WHERE id = v_account_id;
    
    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE public.loyalty_program_config IS 'Configuration settings for tenant loyalty programs';
COMMENT ON TABLE public.loyalty_rewards IS 'Catalog of rewards clients can redeem with points';
COMMENT ON TABLE public.loyalty_redemptions IS 'Tracks when clients redeem loyalty rewards';
COMMENT ON FUNCTION add_loyalty_points IS 'Helper function to add loyalty points with tier multipliers';
