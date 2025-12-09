import { NextRequest, NextResponse } from 'next/server';

/**
 * Simple test endpoint to verify webhook route is accessible
 * Visit: https://your-app.onrender.com/api/whatsapp/test
 */
export async function GET() {
  console.log('🧪 Test endpoint hit at', new Date().toISOString());
  
  return NextResponse.json({ 
    status: 'ok',
    message: 'WhatsApp webhook route is accessible',
    timestamp: new Date().toISOString(),
    webhookUrl: process.env.NEXT_PUBLIC_APP_URL + '/api/whatsapp/webhook',
    env: {
      hasAccessToken: !!process.env.WHATSAPP_ACCESS_TOKEN,
      hasPhoneNumberId: !!process.env.WHATSAPP_PHONE_NUMBER_ID,
      hasVerifyToken: !!process.env.WHATSAPP_VERIFY_TOKEN,
      hasTenantId: !!process.env.DEFAULT_TENANT_ID,
      tenantIdPreview: process.env.DEFAULT_TENANT_ID?.substring(0, 8) + '...',
    }
  });
}

export async function POST(request: NextRequest) {
  console.log('🧪 Test POST endpoint hit at', new Date().toISOString());
  
  const body = await request.text();
  console.log('Body received:', body);
  
  return NextResponse.json({
    status: 'ok',
    message: 'POST request received',
    bodyLength: body.length,
    timestamp: new Date().toISOString(),
  });
}
