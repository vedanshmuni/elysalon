import { NextRequest, NextResponse } from 'next/server';
import { sendTextMessage } from '@/lib/whatsapp/client';
import { getTenantWhatsAppCredentials } from '@/lib/whatsapp/server';
import { checkFeatureAccess } from '@/lib/features/api-guard';

export async function POST(request: NextRequest) {
  try {
    // Check feature access
    const featureCheck = await checkFeatureAccess('whatsapp');
    if (featureCheck) return featureCheck;

    const { to, message, tenantId } = await request.json();

    if (!to || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: to, message' },
        { status: 400 }
      );
    }

    const credentials = tenantId ? await getTenantWhatsAppCredentials(tenantId) : null;
    
    if (!credentials) {
      return NextResponse.json(
        { 
          error: 'WhatsApp not configured',
          message: 'Please configure WhatsApp credentials to send messages'
        },
        { status: 400 }
      );
    }
    
    await sendTextMessage(to, message, credentials);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
