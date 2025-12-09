import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { sendNewBookingRequestNotification, sendTextMessage } from '@/lib/whatsapp/client';

/**
 * Clean phone number to various formats for matching
 */
function cleanPhoneNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Generate phone number variations for matching
 */
function getPhoneVariations(phone: string): string[] {
  const cleaned = cleanPhoneNumber(phone);
  const variations = [
    cleaned,
    `+${cleaned}`,
  ];
  
  // If starts with country code 91 (India), also try without it
  if (cleaned.startsWith('91') && cleaned.length > 10) {
    variations.push(cleaned.substring(2));
  }
  
  // If doesn't start with country code and is 10 digits (Indian number)
  if (!cleaned.startsWith('91') && cleaned.length === 10) {
    variations.push(`91${cleaned}`);
    variations.push(`+91${cleaned}`);
  }
  
  return [...new Set(variations)]; // Remove duplicates
}

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
  // Log immediately to see if endpoint is hit
  const timestamp = new Date().toISOString();
  console.log('\n========================================');
  console.log('🔔 WEBHOOK CALLED AT:', timestamp);
  console.log('========================================\n');

  try {
    // Parse body
    let body;
    try {
      body = await request.json();
      console.log('📱 Raw webhook payload:', JSON.stringify(body, null, 2));
    } catch (parseError) {
      console.error('❌ Failed to parse webhook body:', parseError);
      return NextResponse.json({ status: 'error', message: 'Invalid JSON' }, { status: 400 });
    }

    // WhatsApp sends status updates and messages
    const value = body.entry?.[0]?.changes?.[0]?.value;
    
    if (!value) {
      console.log('⚠️ No value in webhook payload - might be a status update');
      console.log('Full body:', JSON.stringify(body, null, 2));
      return NextResponse.json({ status: 'received' }, { status: 200 });
    }

    // Extract business phone number info
    const businessPhoneNumberId = value.metadata?.phone_number_id;
    const displayPhoneNumber = value.metadata?.display_phone_number;
    
    console.log('📞 Business phone info:', {
      businessPhoneNumberId,
      displayPhoneNumber
    });

    // Check for status updates (message sent, delivered, read, etc.)
    if (value.statuses) {
      console.log('📊 Status update received:', JSON.stringify(value.statuses, null, 2));
      return NextResponse.json({ status: 'received' }, { status: 200 });
    }

    // Process incoming messages
    if (value.messages && value.messages.length > 0) {
      const message = value.messages[0];
      const from = message.from; // Customer's phone number
      const messageBody = message.text?.body || '';
      const messageType = message.type;

      console.log('💬 Message details:', { 
        from, 
        messageBody, 
        messageType,
        timestamp: message.timestamp 
      });

      // Only process text messages
      if (messageType !== 'text') {
        console.log(`⚠️ Ignoring non-text message type: ${messageType}`);
        return NextResponse.json({ status: 'received' }, { status: 200 });
      }

      // Identify which tenant owns this business WhatsApp number
      console.log('🔍 Finding tenant for business number:', displayPhoneNumber);
      const tenant = await findTenantByWhatsAppNumber(displayPhoneNumber);
      
      if (!tenant) {
        console.error('❌ No tenant found for business WhatsApp number:', displayPhoneNumber);
        console.error('💡 Make sure your tenant has whatsapp_number set to:', displayPhoneNumber);
        return NextResponse.json({ status: 'received' }, { status: 200 });
      }

      console.log('✅ Found tenant:', { id: tenant.id, name: tenant.name });

      // Check if it's a booking request
      const lowerMessage = messageBody.toLowerCase();
      if (lowerMessage.includes('book') || lowerMessage.includes('appointment')) {
        console.log('📅 Processing as booking request');
        await handleBookingRequest(from, messageBody, tenant.id);
      } else {
        console.log('💭 Sending default response');
        // Send a default response for non-booking messages
        await sendTextMessage(from, `Hello! Thank you for messaging ${tenant.name}. To book an appointment, please include the word "book" or "appointment" in your message. 😊`);
      }
    } else {
      console.log('⚠️ No messages in webhook payload');
    }

    // Always return 200 to acknowledge receipt
    console.log('✅ Webhook processed successfully\n');
    return NextResponse.json({ status: 'received' }, { status: 200 });
  } catch (error: any) {
    console.error('❌ CRITICAL ERROR in webhook:', error);
    console.error('Stack trace:', error.stack);
    // Still return 200 to prevent WhatsApp from retrying
    return NextResponse.json({ status: 'error', message: error.message }, { status: 200 });
  }
}

/**
 * Find tenant by WhatsApp business number with multiple format matching
 */
async function findTenantByWhatsAppNumber(phoneNumber: string | undefined) {
  if (!phoneNumber) {
    console.log('⚠️ No phone number provided');
    return null;
  }

  // Use service role client to bypass RLS policies
  // Webhooks are not authenticated user requests
  const supabase = createServiceRoleClient();
  
  const cleaned = cleanPhoneNumber(phoneNumber);
  const variations = getPhoneVariations(phoneNumber);
  
  console.log('🔍 Looking for tenant with WhatsApp number:', { 
    original: phoneNumber, 
    cleaned,
    variations 
  });

  // First, check if we have any tenants at all
  const { data: allTenants, error: debugError } = await supabase
    .from('tenants')
    .select('id, name, whatsapp_number, phone');
  
  console.log('📋 All tenants in database:', allTenants);
  
  if (debugError) {
    console.error('❌ Error fetching tenants for debug:', debugError);
  }

  // Try to find tenant with any variation of the phone number
  for (const variation of variations) {
    console.log(`🔎 Trying variation: ${variation}`);
    
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('id, name, whatsapp_number, phone')
      .or(`whatsapp_number.eq.${variation},phone.eq.${variation}`)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('❌ Query error for variation', variation, ':', error);
      continue;
    }

    if (tenant) {
      console.log('✅ Found tenant with variation:', variation, tenant);
      return tenant;
    }
  }

  console.log('❌ No tenant found. Checked:', variations.join(', '));
  return null;
}

/**
 * Handle incoming booking requests from WhatsApp
 */
async function handleBookingRequest(phoneNumber: string, message: string, tenantId: string) {
  try {
    // Use service role client to bypass RLS policies
    const supabase = createServiceRoleClient();
    const phoneVariations = getPhoneVariations(phoneNumber);

    console.log('🔍 Looking for client with phone:', phoneVariations);

    // Try to find existing client by phone (try all variations)
    let client = null;
    for (const variation of phoneVariations) {
      const { data } = await supabase
        .from('clients')
        .select('id, full_name, tenant_id, phone')
        .eq('tenant_id', tenantId)
        .eq('phone', variation)
        .maybeSingle();

      if (data) {
        client = data;
        console.log('✅ Found existing client:', client);
        break;
      }
    }

    if (!client) {
      console.log('⚠️ No existing client found, will create booking request without client_id');
    }

    // Create a booking request entry
    const { data: request, error } = await supabase
      .from('booking_requests')
      .insert({
        tenant_id: tenantId,
        client_id: client?.id || null,
        phone_number: phoneNumber,
        message: message,
        status: 'PENDING',
        source: 'WHATSAPP',
        requested_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating booking request:', error);
      throw error;
    }

    console.log('✅ Booking request created:', request);

    // Send confirmation to customer
    await sendTextMessage(phoneNumber, 
      `Thank you for your booking request! 🎉\n\nWe've received your message and will get back to you shortly to confirm your appointment.\n\nYour request ID: ${request.id.substring(0, 8)}`
    );

    // Get tenant info to send notification
    const { data: tenant } = await supabase
      .from('tenants')
      .select('whatsapp_number, name, phone')
      .eq('id', tenantId)
      .single();

    // Note: Don't send notification to the same number that received the message
    // The salon owner should check their dashboard for new booking requests
    
    console.log('✅ Booking request flow completed successfully');
  } catch (error) {
    console.error('❌ Error handling booking request:', error);
    
    // Try to send error message to customer
    try {
      await sendTextMessage(phoneNumber, 
        'We encountered an error processing your booking request. Please try again or contact us directly. Sorry for the inconvenience! 🙏'
      );
    } catch (msgError) {
      console.error('❌ Failed to send error message to customer:', msgError);
    }
  }
}
