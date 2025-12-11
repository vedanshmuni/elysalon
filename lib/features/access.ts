/**
 * Feature Access Control System
 * 
 * This utility checks if a tenant has access to specific features
 * based on their subscription plan.
 */

import { createClient } from '@/lib/supabase/client';

export type FeatureKey = 
  | 'bookings'
  | 'calendar'
  | 'clients'
  | 'services'
  | 'pos'
  | 'basic_reports'
  | 'staff'
  | 'whatsapp'
  | 'inventory'
  | 'marketing'
  | 'analytics'
  | 'broadcasts'
  | 'attendance_management'
  | 'loyalty_programs'
  | 'priority_support'
  | 'white_label'
  | 'custom_integrations'
  | 'dedicated_support'
  | 'advanced_pos'
  | 'gift_cards'
  | 'commission_tracking'
  | 'multi_user_access'
  | 'custom_reports';

/**
 * Get the tenant's current plan features
 */
export async function getTenantFeatures(): Promise<Record<string, boolean> | null> {
  const supabase = createClient();
  
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Get tenant ID
    const { data: tenantUser } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single();

    if (!tenantUser) return null;

    // Get subscription
    const { data: subscription } = await supabase
      .from('tenant_subscriptions')
      .select('plan_code')
      .eq('tenant_id', tenantUser.tenant_id)
      .single();

    if (!subscription) {
      // No subscription = no features (or default to Basic?)
      return null;
    }

    // Get plan features
    const { data: plan } = await supabase
      .from('plans')
      .select('features_json')
      .eq('code', subscription.plan_code)
      .single();

    if (!plan) return null;

    return plan.features_json as Record<string, boolean>;
  } catch (error) {
    console.error('Error getting tenant features:', error);
    return null;
  }
}

/**
 * Check if tenant has access to a specific feature
 */
export async function hasFeatureAccess(feature: FeatureKey): Promise<boolean> {
  const features = await getTenantFeatures();
  
  if (!features) {
    // No subscription = no access (or allow basic features?)
    return false;
  }

  return features[feature] === true;
}

/**
 * Check multiple features at once
 */
export async function hasAllFeatures(features: FeatureKey[]): Promise<boolean> {
  const tenantFeatures = await getTenantFeatures();
  
  if (!tenantFeatures) return false;

  return features.every(feature => tenantFeatures[feature] === true);
}

/**
 * Check if tenant has at least one of the features
 */
export async function hasAnyFeature(features: FeatureKey[]): Promise<boolean> {
  const tenantFeatures = await getTenantFeatures();
  
  if (!tenantFeatures) return false;

  return features.some(feature => tenantFeatures[feature] === true);
}

/**
 * Get tenant's plan code
 */
export async function getTenantPlanCode(): Promise<string | null> {
  const supabase = createClient();
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: tenantUser } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single();

    if (!tenantUser) return null;

    const { data: subscription } = await supabase
      .from('tenant_subscriptions')
      .select('plan_code')
      .eq('tenant_id', tenantUser.tenant_id)
      .single();

    return subscription?.plan_code || null;
  } catch (error) {
    console.error('Error getting tenant plan:', error);
    return null;
  }
}
