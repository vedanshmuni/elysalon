import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendNewBookingRequestNotification } from '@/lib/whatsapp/client';

/**
 * WhatsApp Webhook Verification (GET)
 * Required by Meta to verify your webhook endpoint
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'elysalon_verify_token';

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verified successfully!');
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

/**
 * WhatsApp Webhook Handler (POST)
 * Receives incoming messages from WhatsApp
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // WhatsApp sends status updates and messages
    if (body.entry?.[0]?.changes?.[0]?.value?.messages) {
      const message = body.entry[0].changes[0].value.messages[0];
      const from = message.from; // Phone number
      const messageBody = message.text?.body || '';

      console.log('Received WhatsApp message:', { from, messageBody });

      // Check if it's a booking request
      if (messageBody.toLowerCase().includes('book') || 
          messageBody.toLowerCase().includes('appointment')) {
        await handleBookingRequest(from, messageBody);
      }
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ status: 'received' }, { status: 200 });
  } catch (error) {
    console.error('Error processing WhatsApp webhook:', error);
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
}

/**
 * Handle incoming booking requests from WhatsApp
 */
async function handleBookingRequest(phoneNumber: string, message: string) {
  try {
    const supabase = await createClient();

    // Try to find existing client by phone
    const { data: client } = await supabase
      .from('clients')
      .select('id, full_name, tenant_id')
      .eq('phone', phoneNumber)
      .single();

    // Parse message for booking details (simple parsing)
    // Format expected: "Book [service] on [date] at [time]"
    // For MVP, we'll create a pending request

    // Create a booking request entry
    const { data: request, error } = await supabase
      .from('booking_requests')
      .insert({
        client_id: client?.id,
        phone_number: phoneNumber,
        message: message,
        status: 'PENDING',
        source: 'WHATSAPP',
        requested_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Get salon's WhatsApp number to send notification
    if (client?.tenant_id) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('whatsapp_number, name')
        .eq('id', client.tenant_id)
        .single();

      if (tenant?.whatsapp_number) {
        await sendNewBookingRequestNotification(tenant.whatsapp_number, {
          clientName: client.full_name || 'Unknown',
          clientPhone: phoneNumber,
          serviceName: 'To be confirmed',
          preferredDate: 'To be confirmed',
          preferredTime: 'To be confirmed',
        });
      }
    }

    console.log('Booking request created:', request);
  } catch (error) {
    console.error('Error handling booking request:', error);
  }
}
