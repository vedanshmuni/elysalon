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
 */
export async function getTenantWhatsAppCredentials(tenantId: string): Promise<WhatsAppCredentials | null> {
  try {
    const supabase = createServiceRoleClient();
    const { data: tenant } = await supabase
      .from('tenants')
      .select('whatsapp_phone_number_id, whatsapp_access_token')
      .eq('id', tenantId)
      .single();

    if (tenant?.whatsapp_phone_number_id && tenant?.whatsapp_access_token) {
      return {
        phoneNumberId: tenant.whatsapp_phone_number_id,
        accessToken: tenant.whatsapp_access_token
      };
    }

    // Fallback to environment variables
    if (DEFAULT_WHATSAPP_PHONE_NUMBER_ID && DEFAULT_WHATSAPP_ACCESS_TOKEN) {
      return {
        phoneNumberId: DEFAULT_WHATSAPP_PHONE_NUMBER_ID,
        accessToken: DEFAULT_WHATSAPP_ACCESS_TOKEN
      };
    }

    return null;
  } catch (error) {
    console.error('Error fetching tenant WhatsApp credentials:', error);
    
    // Fallback to environment variables
    if (DEFAULT_WHATSAPP_PHONE_NUMBER_ID && DEFAULT_WHATSAPP_ACCESS_TOKEN) {
      return {
        phoneNumberId: DEFAULT_WHATSAPP_PHONE_NUMBER_ID,
        accessToken: DEFAULT_WHATSAPP_ACCESS_TOKEN
      };
    }
    
    return null;
  }
}
