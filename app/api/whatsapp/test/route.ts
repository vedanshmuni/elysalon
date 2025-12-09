import { NextResponse } from 'next/server';

/**
 * Simple test endpoint to verify webhook route is accessible
 * Visit: http://localhost:3000/api/whatsapp/test
 */
export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    message: 'WhatsApp webhook route is accessible',
    timestamp: new Date().toISOString(),
    webhookUrl: process.env.NEXT_PUBLIC_APP_URL + '/api/whatsapp/webhook'
  });
}
