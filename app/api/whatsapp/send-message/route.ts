import { NextRequest, NextResponse } from 'next/server';
import { sendTextMessage } from '@/lib/whatsapp/client';
import { getTenantWhatsAppCredentials } from '@/lib/whatsapp/server';

export async function POST(request: NextRequest) {
  try {
    const { to, message, tenantId } = await request.json();

    if (!to || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: to, message' },
        { status: 400 }
      );
    }

    const credentials = tenantId ? await getTenantWhatsAppCredentials(tenantId) : null;
    await sendTextMessage(to, message, credentials || undefined);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
