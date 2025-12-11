/**
 * Server-only WhatsApp utilities
 * This file uses next/headers and should only be imported in server components/API routes
 */

import { createServiceRoleClient } from '@/lib/supabase/server';
import { WhatsAppCredentials } from './client';

const DEFAULT_WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const DEFAULT_WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

/**
 * Get WhatsApp credentials for a specific tenant (SERVER ONLY)
 * Returns null if tenant doesn't have credentials configured
 * NO FALLBACK to environment variables to maintain proper multi-tenancy
 */
export async function getTenantWhatsAppCredentials(tenantId: string): Promise<WhatsAppCredentials | null> {
  try {
    const supabase = createServiceRoleClient();
    const { data: tenant } = await supabase
      .from('tenants')
      .select('whatsapp_phone_number_id, whatsapp_access_token, whatsapp_phone_number')
      .eq('id', tenantId)
      .single();

    if (tenant?.whatsapp_phone_number_id && tenant?.whatsapp_access_token) {
      console.log(`Using WhatsApp credentials for tenant ${tenantId}: Phone Number ID ${tenant.whatsapp_phone_number_id}`);
      return {
        phoneNumberId: tenant.whatsapp_phone_number_id,
        accessToken: tenant.whatsapp_access_token
      };
    }

    console.warn(`No WhatsApp credentials configured for tenant ${tenantId}`);
    return null;
  } catch (error) {
    console.error('Error fetching tenant WhatsApp credentials:', error);
    return null;
  }
}
