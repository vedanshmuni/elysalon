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

    // Handle interactive button responses
    if (body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.interactive) {
      const message = body.entry[0].changes[0].value.messages[0];
      const from = message.from;
      const buttonReply = message.interactive?.button_reply?.id;

      console.log('Received button response:', { from, buttonReply });

      if (buttonReply === 'book_appointment') {
        await handleBookingRequest(from, 'I want to book an appointment');
      } else if (buttonReply === 'view_services') {
        await handleViewServices(from);
      } else if (buttonReply === 'contact_us') {
        await handleContactUs(from);
      }

      return NextResponse.json({ status: 'received' }, { status: 200 });
    }

    // Handle regular text messages
    if (body.entry?.[0]?.changes?.[0]?.value?.messages) {
      const message = body.entry[0].changes[0].value.messages[0];
      const from = message.from;
      const messageBody = message.text?.body || '';

      console.log('Received WhatsApp message:', { from, messageBody });

      // Send welcome message with interactive buttons
      await handleIncomingMessage(from, messageBody);
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ status: 'received' }, { status: 200 });
  } catch (error) {
    console.error('Error processing WhatsApp webhook:', error);
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
}

/**
 * Handle incoming messages and send welcome menu
 */
async function handleIncomingMessage(phoneNumber: string, message: string) {
  const { sendInteractiveButtons } = await import('@/lib/whatsapp/client');
  
  await sendInteractiveButtons(phoneNumber, {
    bodyText: `Hello! 👋 Welcome to our salon!\n\nHow can we help you today?`,
    buttons: [
      { id: 'book_appointment', title: '📅 Book Appointment' },
      { id: 'view_services', title: '💇 View Services' },
      { id: 'contact_us', title: '📞 Contact Us' },
    ],
  });
}

/**
 * Handle booking requests from WhatsApp
 */
async function handleBookingRequest(phoneNumber: string, message: string) {
  try {
    const supabase = await createClient();
    const { sendTextMessage } = await import('@/lib/whatsapp/client');

    // Try to find existing client by phone
    const { data: clients } = await supabase
      .from('clients')
      .select('id, full_name, tenant_id, tenants(name, whatsapp_number)')
      .eq('phone', phoneNumber);

    const client = clients?.[0];

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

    // Send confirmation to customer
    await sendTextMessage(
      phoneNumber,
      `✅ Your booking request has been received!\n\nOur team will review it and get back to you shortly. You'll receive a confirmation once your appointment is approved.\n\nBooking Reference: ${request.id.slice(0, 8)}`
    );

    // Notify salon owner/staff via dashboard (notification will appear in booking requests page)
    console.log('Booking request created:', request);
    
    // If there's a tenant with WhatsApp, notify them
    if (client?.tenants?.whatsapp_number) {
      await sendNewBookingRequestNotification(client.tenants.whatsapp_number, {
        clientName: client.full_name || 'New Customer',
        clientPhone: phoneNumber,
        serviceName: 'To be confirmed',
        preferredDate: 'To be confirmed',
        preferredTime: 'To be confirmed',
      });
    }
  } catch (error) {
    console.error('Error handling booking request:', error);
  }
}

/**
 * Handle view services request
 */
async function handleViewServices(phoneNumber: string) {
  const { sendTextMessage } = await import('@/lib/whatsapp/client');
  
  await sendTextMessage(
    phoneNumber,
    `💇 Our Services:\n\n` +
    `• Haircut & Styling\n` +
    `• Hair Color & Highlights\n` +
    `• Spa & Facial Treatments\n` +
    `• Manicure & Pedicure\n` +
    `• Bridal Makeup\n` +
    `• And much more!\n\n` +
    `Visit our website or book an appointment to see our full service menu! ✨`
  );
}

/**
 * Handle contact us request
 */
async function handleContactUs(phoneNumber: string) {
  const { sendTextMessage } = await import('@/lib/whatsapp/client');
  
  await sendTextMessage(
    phoneNumber,
    `📞 Contact Us:\n\n` +
    `Feel free to reach out to us for any queries!\n\n` +
    `We're here to help! 💙`
  );
}
