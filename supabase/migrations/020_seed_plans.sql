-- Seed subscription plans for SalonOS

-- Insert plans
INSERT INTO public.plans (name, code, monthly_price_in_inr, yearly_price_in_inr, max_branches, max_staff, features_json, is_active)
VALUES 
(
    'Basic',
    'BASIC',
    1500.00,
    15300.00,
    1,
    999,
    '{
        "bookings": true,
        "calendar": true,
        "clients": true,
        "services": true,
        "pos": true,
        "basic_reports": true,
        "staff": false,
        "whatsapp": false,
        "inventory": false,
        "marketing": false,
        "analytics": false,
        "broadcasts": false,
        "attendance_management": false,
        "loyalty_programs": false
    }'::jsonb,
    true
),
(
    'Professional',
    'PROFESSIONAL',
    2500.00,
    25500.00,
    1,
    999,
    '{
        "bookings": true,
        "calendar": true,
        "clients": true,
        "services": true,
        "staff": true,
        "pos": true,
        "basic_reports": true,
        "whatsapp": true,
        "inventory": true,
        "marketing": true,
        "analytics": true,
        "attendance_management": true,
        "loyalty_programs": true,
        "broadcasts": false,
        "priority_support": true
    }'::jsonb,
    true
),
(
    'Enterprise',
    'ENTERPRISE',
    4000.00,
    40800.00,
    1,
    999,
    '{
        "bookings": true,
        "calendar": true,
        "clients": true,
        "services": true,
        "staff": true,
        "pos": true,
        "basic_reports": true,
        "whatsapp": true,
        "inventory": true,
        "marketing": true,
        "analytics": true,
        "attendance_management": true,
        "broadcasts": true,
        "priority_support": true,
        "white_label": true,
        "custom_integrations": true,
        "dedicated_support": true,
        "advanced_pos": true,
        "loyalty_programs": true,
        "gift_cards": true,
        "commission_tracking": true,
        "multi_user_access": true,
        "custom_reports": true
    }'::jsonb,
    true
)
ON CONFLICT (code) DO NOTHING;
