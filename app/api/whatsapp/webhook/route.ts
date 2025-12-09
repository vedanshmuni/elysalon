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

    // Get the business phone number that received the message
    const businessPhoneNumberId = body.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
    const displayPhoneNumber = body.entry?.[0]?.changes?.[0]?.value?.metadata?.display_phone_number;

    console.log('Message received on business phone:', { businessPhoneNumberId, displayPhoneNumber });

    // Find which salon this WhatsApp number belongs to
    const tenantId = await getTenantByWhatsAppNumber(displayPhoneNumber);
    
    if (!tenantId) {
      console.log('No tenant found for WhatsApp number:', displayPhoneNumber);
      return NextResponse.json({ status: 'received' }, { status: 200 });
    }

    // Handle interactive button responses
    if (body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.interactive) {
      const message = body.entry[0].changes[0].value.messages[0];
      const from = message.from;
      const buttonReply = message.interactive?.button_reply?.id;

      console.log('Received button response:', { from, buttonReply, tenantId });

      if (buttonReply === 'book_appointment') {
        await handleBookingRequest(from, 'I want to book an appointment', tenantId);
      } else if (buttonReply === 'view_services') {
        await handleViewServices(from, tenantId);
      } else if (buttonReply === 'contact_us') {
        await handleContactUs(from, tenantId);
      }

      return NextResponse.json({ status: 'received' }, { status: 200 });
    }

    // Handle regular text messages
    if (body.entry?.[0]?.changes?.[0]?.value?.messages) {
      const message = body.entry[0].changes[0].value.messages[0];
      const from = message.from;
      const messageBody = message.text?.body || '';

      console.log('Received WhatsApp message:', { from, messageBody, tenantId });

      // Send welcome message with interactive buttons
      await handleIncomingMessage(from, messageBody, tenantId);
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ status: 'received' }, { status: 200 });
  } catch (error) {
    console.error('Error processing WhatsApp webhook:', error);
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
}

/**
 * Get tenant ID by WhatsApp number
 */
async function getTenantByWhatsAppNumber(whatsappNumber: string): Promise<string | null> {
  try {
    const supabase = await createClient();
    
    // Clean the phone number (remove + and any formatting)
    const cleanNumber = whatsappNumber?.replace(/\D/g, '');
    
    if (!cleanNumber) return null;

    // Find tenant by WhatsApp number
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, name')
/**
 * Handle booking requests from WhatsApp
 */
async function handleBookingRequest(phoneNumber: string, message: string, tenantId: string) {
  try {
    const supabase = await createClient();
    const { sendTextMessage } = await import('@/lib/whatsapp/client');

    // Try to find existing client by phone for this specific salon
    const { data: clients } = await supabase
      .from('clients')
      .select('id, full_name, tenant_id, tenants(name, whatsapp_number)')
      .eq('phone', phoneNumber)
      .eq('tenant_id', tenantId);

    let client = clients?.[0];

    // If client doesn't exist for this salon, create them
    if (!client) {
      const { data: newClient } = await supabase
        .from('clients')
        .insert({
          tenant_id: tenantId,
          phone: phoneNumber,
          full_name: 'WhatsApp Customer',
          source: 'WHATSAPP',
        })
        .select('id, full_name, tenant_id')
        .single();
      
      client = newClient;
    }

    // Create a booking request entry
    const { data: request, error } = await supabase
      .from('booking_requests')
      .insert({
        tenant_id: tenantId,
        client_id: client?.id,
        phone_number: phoneNumber,
        message: message,
        status: 'PENDING',
        source: 'WHATSAPP',
        requested_at: new Date().toISOString(),
      })
      .select()
      .single();
  const salonName = tenant?.name || 'our salon';
  
  await sendInteractiveButtons(phoneNumber, {
    bodyText: `Hello! 👋 Welcome to ${salonName}!\n\nHow can we help you today?`,
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
async function handleBookingRequest(phoneNumber: string, message: string, tenantId: string) {
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

/**
 * Handle view services request
 */
async function handleViewServices(phoneNumber: string, tenantId: string) {
  const { sendTextMessage } = await import('@/lib/whatsapp/client');
  const supabase = await createClient();
  
  try {
    // Get salon name
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name')
      .eq('id', tenantId)
      .single();

    const salonName = tenant?.name || 'our salon';

    // Fetch actual services from database for this salon
    const { data: services, error } = await supabase
      .from('services')
      .select('name, description, base_price, duration_minutes, service_categories(name)')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('name');

    if (error || !services || services.length === 0) {
      await sendTextMessage(
        phoneNumber,
        `💇 Services at ${salonName}:\n\n` +
        `Please contact us for our service menu! ✨`
      );
      return;
    }

    // Group services by category
    const servicesByCategory: Record<string, any[]> = {};
    services.forEach((service: any) => {
      const category = service.service_categories?.name || 'Other Services';
      if (!servicesByCategory[category]) {
        servicesByCategory[category] = [];
      }
      servicesByCategory[category].push(service);
    });

    // Build message
    let message = `💇 Services at ${salonName}:\n\n`;
    
    Object.entries(servicesByCategory).forEach(([category, categoryServices]) => {
      message += `*${category}*\n`;
      categoryServices.forEach((service: any) => {
        message += `• ${service.name}`;
        if (service.base_price) {
          message += ` - ₹${service.base_price}`;
        }
        if (service.duration_minutes) {
          message += ` (${service.duration_minutes}min)`;
        }
        message += `\n`;
        if (service.description) {
          message += `  ${service.description}\n`;
        }
      });
      message += `\n`;
    });

    message += `Book an appointment to experience our services! ✨`;

    await sendTextMessage(phoneNumber, message);
  } catch (error) {
    console.error('Error fetching services:', error);
    await sendTextMessage(
/**
 * Handle contact us request
 */
async function handleContactUs(phoneNumber: string, tenantId: string) {
  const { sendTextMessage } = await import('@/lib/whatsapp/client');
  const supabase = await createClient();
  
  // Get salon contact details
  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, phone, address')
    .eq('id', tenantId)
    .single();
  
  let contactMessage = `📞 Contact Us:\n\n`;
  
  if (tenant?.name) {
    contactMessage += `${tenant.name}\n\n`;
  }
  
  if (tenant?.phone) {
    contactMessage += `📱 Phone: ${tenant.phone}\n`;
  }
  
  if (tenant?.address) {
    contactMessage += `📍 Address: ${tenant.address}\n`;
  }
  
  contactMessage += `\nFeel free to reach out to us for any queries!\n\nWe're here to help! 💙`;
  
  await sendTextMessage(phoneNumber, contactMessage);
} 
  await sendTextMessage(
    phoneNumber,
    `📞 Contact Us:\n\n` +
    `Feel free to reach out to us for any queries!\n\n` +
    `We're here to help! 💙`
  );
}
