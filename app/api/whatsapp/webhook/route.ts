import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { sendTextMessage, sendInteractiveButtons, sendInteractiveList } from '@/lib/whatsapp/client';

// Default tenant ID from environment variable (simpler approach like elychat)
const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID;

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
  console.log('\n========================================');
  console.log('🔔 GET /api/whatsapp/webhook - VERIFICATION REQUEST');
  console.log('========================================\n');
  
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  console.log('📋 Verification details:');
  console.log('  Mode:', mode);
  console.log('  Token received:', token);
  console.log('  Challenge:', challenge?.substring(0, 50) + '...');

  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
  console.log('  Expected token:', VERIFY_TOKEN);
  console.log('  Token match:', token === VERIFY_TOKEN);
  console.log('  Mode match:', mode === 'subscribe');

  // Check if environment variable is set
  if (!VERIFY_TOKEN) {
    console.error('❌ WHATSAPP_VERIFY_TOKEN environment variable is NOT set!');
    console.error('💡 Set it in your Render dashboard environment variables');
    return NextResponse.json({ 
      error: 'Server configuration error',
      message: 'WHATSAPP_VERIFY_TOKEN not configured' 
    }, { status: 500 });
  }

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verified successfully!\n');
    // Must return ONLY the challenge string as plain text
    return new NextResponse(challenge, { 
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
      }
    });
  }

  console.log('❌ Verification failed');
  if (mode !== 'subscribe') {
    console.log('  Reason: Invalid mode:', mode);
  }
  if (token !== VERIFY_TOKEN) {
    console.log('  Reason: Token mismatch');
  }
  console.log('\n');
  
  return NextResponse.json({ 
    error: 'Verification failed',
    details: 'Invalid verify token or mode'
  }, { status: 403 });
}

/**
 * WhatsApp Webhook Handler (POST)
 * Receives incoming messages from WhatsApp
 */
export async function POST(request: NextRequest) {
  // Log immediately to confirm webhook is being hit
  console.log('\n🚨🚨🚨 WEBHOOK HIT 🚨🚨🚨');
  console.log('========== WHATSAPP WEBHOOK POST ==========');
  console.log('Time:', new Date().toISOString());
  console.log('Headers:', Object.fromEntries(request.headers.entries()));

  try {
    const rawBody = await request.text();
    console.log('📦 Raw body received:', rawBody.substring(0, 500));
    
    const body = JSON.parse(rawBody);
    
    // WhatsApp sends status updates and messages
    const value = body.entry?.[0]?.changes?.[0]?.value;
    
    if (!value) {
      console.log('No value in webhook - status update or other');
      return NextResponse.json({ status: 'received' }, { status: 200 });
    }

    // Check for status updates
    if (value.statuses) {
      console.log('Status update received - ignoring');
      return NextResponse.json({ status: 'received' }, { status: 200 });
    }

    // Process incoming messages
    if (!value.messages || value.messages.length === 0) {
      console.log('No messages in payload');
      return NextResponse.json({ status: 'received' }, { status: 200 });
    }

    const message = value.messages[0];
    const from = message.from;
    const messageType = message.type;
    const profileName = value.contacts?.[0]?.profile?.name || 'Customer';

    console.log('📱 Message from:', from, '| Name:', profileName, '| Type:', messageType);

    // Get tenant ID - use env variable or fetch from database
    const tenantId = await getTenantId();
    
    if (!tenantId) {
      console.error('❌ No tenant configured! Set DEFAULT_TENANT_ID env variable');
      return NextResponse.json({ status: 'received' }, { status: 200 });
    }

    console.log('✅ Using tenant:', tenantId);

    // Handle different message types
    if (messageType === 'text') {
      const messageBody = message.text?.body || '';
      console.log('💬 Text message:', messageBody);
      
      await handleTextMessage(from, messageBody, profileName, tenantId);
    } 
    else if (messageType === 'interactive') {
      const interactive = message.interactive;
      
      if (interactive?.type === 'button_reply') {
        const buttonId = interactive.button_reply?.id;
        console.log('🔘 Button click:', buttonId);
        await handleButtonClick(from, buttonId, profileName, tenantId);
      }
      else if (interactive?.type === 'list_reply') {
        const listId = interactive.list_reply?.id;
        console.log('📋 List selection:', listId);
        await handleListSelection(from, listId, profileName, tenantId);
      }
    }

    console.log('✅ Webhook processed\n');
    return NextResponse.json({ status: 'received' }, { status: 200 });
  } catch (error: any) {
    console.error('❌ Webhook error:', error.message);
    return NextResponse.json({ status: 'error' }, { status: 200 });
  }
}

/**
 * Get tenant ID - from env variable or first tenant in database
 */
async function getTenantId(): Promise<string | null> {
  // First try environment variable (fastest, most reliable)
  if (DEFAULT_TENANT_ID) {
    return DEFAULT_TENANT_ID;
  }

  // Fallback: get first tenant from database
  try {
    const supabase = createServiceRoleClient();
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();
    
    if (tenant) {
      console.log('📍 Found tenant from database:', tenant.id);
      return tenant.id;
    }
  } catch (error) {
    console.error('Error fetching tenant:', error);
  }

  return null;
}

/**
 * Handle text messages
 */
async function handleTextMessage(from: string, messageBody: string, profileName: string, tenantId: string) {
  const lowerMessage = messageBody.toLowerCase().trim();
  
  // Check for greetings or menu request
  const isGreeting = ['hi', 'hello', 'hey', 'start', 'menu', 'help'].some(
    word => lowerMessage === word || lowerMessage.startsWith(word + ' ')
  );

  if (isGreeting) {
    await sendWelcomeMenu(from, profileName, tenantId);
    return;
  }

  // Check for booking keywords
  if (lowerMessage.includes('book') || lowerMessage.includes('appointment')) {
    await handleBookingRequest(from, messageBody, profileName, tenantId);
    return;
  }

  // Default response with menu
  await sendWelcomeMenu(from, profileName, tenantId);
}

/**
 * Send welcome menu with interactive buttons
 */
async function sendWelcomeMenu(from: string, profileName: string, tenantId: string) {
  try {
    // Get salon name
    const supabase = createServiceRoleClient();
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name')
      .eq('id', tenantId)
      .single();

    const salonName = tenant?.name || 'our salon';

    await sendInteractiveButtons(from, {
      headerText: `Welcome to ${salonName}! 👋`,
      bodyText: `Hi ${profileName}! How can we help you today?\n\nTap a button below to get started:`,
      buttons: [
        { id: 'book_appointment', title: '📅 Book Appointment' },
        { id: 'view_services', title: '💇 Our Services' },
        { id: 'contact_us', title: '📞 Contact Us' }
      ],
      footerText: 'We look forward to serving you!'
    });

    console.log('✅ Welcome menu sent to', from);
  } catch (error) {
    console.error('Error sending welcome menu:', error);
    // Fallback to text message
    await sendTextMessage(from, 
      `Hi ${profileName}! 👋\n\nWelcome! To book an appointment, please reply with "book" followed by your preferred service and date.\n\nExample: "book haircut tomorrow 3pm"`
    );
  }
}

/**
 * Handle button clicks
 */
async function handleButtonClick(from: string, buttonId: string, profileName: string, tenantId: string) {
  console.log('Button clicked:', buttonId);
  
  switch (buttonId) {
    case 'book_appointment':
      await sendServicesListInteractive(from, tenantId);
      break;
    
    case 'view_services':
      await sendServicesList(from, tenantId);
      break;
    
    case 'contact_us':
      await sendContactInfo(from, tenantId);
      break;
    
    default:
      await sendWelcomeMenu(from, profileName, tenantId);
  }
}

/**
 * Handle list selections
 */
async function handleListSelection(from: string, listId: string, profileName: string, tenantId: string) {
  console.log('List selection:', listId);
  
  // Parse selection type
  if (listId.startsWith('service_')) {
    const serviceId = listId.replace('service_', '');
    await sendDateSelection(from, serviceId, tenantId);
  } else if (listId.startsWith('date_')) {
    const parts = listId.split('_');
    const date = parts[1]; // YYYY-MM-DD format
    const serviceId = parts[2];
    await sendTimeSlotPeriodSelection(from, serviceId, date, tenantId);
  } else if (listId.startsWith('period_')) {
    const parts = listId.split('_');
    const period = parts[1]; // morning, afternoon, evening
    const date = parts[2];
    const serviceId = parts[3];
    await sendTimeSlotSelection(from, serviceId, date, period, tenantId);
  } else if (listId.startsWith('time_')) {
    const parts = listId.split('_');
    const time = parts[1]; // HH:MM format
    const date = parts[2];
    const serviceId = parts[3];
    await confirmBooking(from, serviceId, date, time, profileName, tenantId);
  }
}

/**
 * Send interactive services list for booking
 */
async function sendServicesListInteractive(from: string, tenantId: string) {
  try {
    const supabase = createServiceRoleClient();
    const { data: services } = await supabase
      .from('services')
      .select('id, name, duration_minutes, base_price')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('name')
      .limit(10);

    if (!services || services.length === 0) {
      await sendTextMessage(from, 
        'Our services menu is being updated. Please contact us directly! 📞'
      );
      return;
    }

    await sendInteractiveList(from, {
      headerText: 'Book Appointment',
      bodyText: 'Please select a service:',
      buttonText: 'View Services',
      footerText: 'Choose your preferred service',
      sections: [{
        title: 'Available Services',
        rows: services.map(service => ({
          id: `service_${service.id}`,
          title: service.name,
          description: `${service.duration_minutes}min • ₹${service.base_price}`
        }))
      }]
    });

    console.log('✅ Services list sent to', from);
  } catch (error) {
    console.error('Error sending services list:', error);
    await sendTextMessage(from, 'Unable to load services. Please try again later.');
  }
}

/**
 * Send list of services (text only)
 */
async function sendServicesList(from: string, tenantId: string) {
  try {
    const supabase = createServiceRoleClient();
    const { data: services } = await supabase
      .from('services')
      .select('id, name, duration_minutes, base_price')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('name')
      .limit(10);

    if (!services || services.length === 0) {
      await sendTextMessage(from, 
        'Our services menu is being updated. Please contact us directly for service details! 📞'
      );
      return;
    }

    let message = '💇 *Our Services:*\n\n';
    services.forEach((service, index) => {
      message += `${index + 1}. *${service.name}*\n`;
      message += `   ⏱ ${service.duration_minutes} mins | ₹${service.base_price}\n\n`;
    });
    message += 'Reply with "book" to make an appointment!';

    await sendTextMessage(from, message);
  } catch (error) {
    console.error('Error fetching services:', error);
    await sendTextMessage(from, 'Unable to load services. Please try again later.');
  }
}

/**
 * Send date selection (next 7 days from tomorrow)
 */
async function sendDateSelection(from: string, serviceId: string, tenantId: string) {
  try {
    // Get service details
    const supabase = createServiceRoleClient();
    const { data: service } = await supabase
      .from('services')
      .select('name')
      .eq('id', serviceId)
      .single();

    // Generate next 7 days starting from tomorrow (IST)
    const dates = [];
    const now = new Date();
    // Convert to IST
    const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
    const istNow = new Date(now.getTime() + istOffset);
    
    for (let i = 1; i <= 7; i++) {
      const date = new Date(istNow);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
      const dayName = date.toLocaleDateString('en-IN', { weekday: 'long', timeZone: 'Asia/Kolkata' });
      const dateDisplay = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
      
      dates.push({
        id: `date_${dateStr}_${serviceId}`,
        title: `${dayName}`,
        description: dateDisplay
      });
    }

    await sendInteractiveList(from, {
      headerText: service?.name || 'Select Date',
      bodyText: 'When would you like to book?',
      buttonText: 'Choose Date',
      footerText: 'Select your preferred date',
      sections: [{
        title: 'Available Dates',
        rows: dates
      }]
    });

    console.log('✅ Date selection sent to', from);
  } catch (error) {
    console.error('Error sending date selection:', error);
    await sendTextMessage(from, 'Unable to show dates. Please try again.');
  }
}

/**
 * Send time period selection (Morning/Afternoon/Evening)
 */
async function sendTimeSlotPeriodSelection(from: string, serviceId: string, date: string, tenantId: string) {
  try {
    const supabase = createServiceRoleClient();
    const { data: service } = await supabase
      .from('services')
      .select('name')
      .eq('id', serviceId)
      .single();

    const dateObj = new Date(date + 'T00:00:00');
    const dateDisplay = dateObj.toLocaleDateString('en-IN', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'short',
      timeZone: 'Asia/Kolkata'
    });

    // Generate time slots based on selected period
    const timeSlots = [];
    let startHour = 10;
    let endHour = 21;
    let periodName = '';

    if (period === 'morning') {
      startHour = 10;
      endHour = 12;
      periodName = '☀️ Morning (10 AM - 12 PM)';
    } else if (period === 'afternoon') {
      startHour = 12;
      endHour = 17;
      periodName = '☀️ Afternoon (12 PM - 5 PM)';
    } else if (period === 'evening') {
      startHour = 17;
      endHour = 21;
      periodName = '🌙 Evening (5 PM - 9 PM)';
    }

    // Generate slots for the selected period
    for (let hour = startHour; hour <= endHour; hour++) {
      for (let min = 0; min < 60; min += 30) {
        if (hour === endHour && min > 0) break;
        if (hour === 21 && min > 0) break; // Stop at 9:00 PM
        
        const time = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
        const display12 = hour > 12 ? hour - 12 : (hour === 12 ? 12 : hour);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const display = `${display12}:${min === 0 ? '00' : min} ${ampm}`;
        
        timeSlots.push({
          id: `time_${time}_${date}_${serviceId}`,
          title: display,
          description: `Available`
        });
      }
    }

    await sendInteractiveList(from, {
      headerText: service?.name || 'Select Time',
      bodyText: `${periodName} slots for ${dateDisplay}:`,
      buttonText: 'Choose Time',
      footerText: 'All times in IST',
      sections: [{
        title: periodName,
        rows: timeSlots.slice(0, 10)
      }]
    });

    console.log('✅ Time slots sent to', from);
  } catch (error) {
    console.error('Error sending time slots:', error);
    await sendTextMessage(from, 'Unable to show time slots. Please try again.');
  }
}   const dateDisplay = dateObj.toLocaleDateString('en-IN', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'short',
      timeZone: 'Asia/Kolkata'
    });

    // Split into 3 sections with max 9 rows each (staying under 10 limit)
    const morning = timeSlots.filter(slot => slot.description === '☀️ Morning');
    const afternoon = timeSlots.filter(slot => slot.description === '☀️ Afternoon');
    const evening = timeSlots.filter(slot => slot.description === '🌙 Evening');

    await sendInteractiveList(from, {
      headerText: service?.name || 'Select Time',
      bodyText: `Choose your preferred time on ${dateDisplay}:`,
      buttonText: 'Choose Time',
      footerText: 'All times in IST',
      sections: [
        {
          title: '☀️ Morning (10 AM - 12 PM)',
          rows: morning.slice(0, 9)
        },
        {
          title: '☀️ Afternoon (12 PM - 5 PM)',
          rows: afternoon.slice(0, 9)
        },
        {
          title: '🌙 Evening (5 PM - 9 PM)',
          rows: evening.slice(0, 9)
        }
      ].filter(section => section.rows.length > 0)
    });

    console.log('✅ Time slots sent to', from);
  } catch (error) {
    console.error('Error sending time slots:', error);
    await sendTextMessage(from, 'Unable to show time slots. Please try again.');
  }
}

/**
 * Send contact information
 */
async function sendContactInfo(from: string, tenantId: string) {
  try {
    const supabase = createServiceRoleClient();
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name, phone, address')
      .eq('id', tenantId)
      .single();

    const message = `📍 *${tenant?.name || 'Contact Us'}*\n\n` +
      (tenant?.phone ? `📞 Phone: ${tenant.phone}\n` : '') +
      (tenant?.address ? `📍 Address: ${tenant.address}\n` : '') +
      '\nWe\'re happy to help! 😊';

    await sendTextMessage(from, message);
  } catch (error) {
    console.error('Error fetching contact info:', error);
    await sendTextMessage(from, 'Please check our website or social media for contact details.');
  }
}

/**
 * Confirm and create booking
 */
async function confirmBooking(from: string, serviceId: string, date: string, time: string, profileName: string, tenantId: string) {
  try {
    const supabase = createServiceRoleClient();
    
    // Get service details
    const { data: service } = await supabase
      .from('services')
      .select('name, duration_minutes, base_price')
      .eq('id', serviceId)
      .single();

    if (!service) {
      await sendTextMessage(from, 'Service not found. Please try booking again.');
      return;
    }

    // Find or create client
    const phoneVariations = getPhoneVariations(from);
    let clientId = null;
    
    for (const variation of phoneVariations) {
      const { data } = await supabase
        .from('clients')
        .select('id, full_name')
        .eq('tenant_id', tenantId)
        .eq('phone', variation)
        .maybeSingle();

      if (data) {
        clientId = data.id;
        break;
      }
    }

    // Parse date and time to create booking datetime (IST)
    const bookingDateTime = `${date}T${time}:00+05:30`; // IST timezone

    // Format display
    const dateObj = new Date(date + 'T00:00:00');
    const dateDisplay = dateObj.toLocaleDateString('en-IN', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Kolkata'
    });

    // Format time for display (convert 24h to 12h)
    const [hours, minutes] = time.split(':');
    const hour12 = parseInt(hours) > 12 ? parseInt(hours) - 12 : parseInt(hours);
    const ampm = parseInt(hours) >= 12 ? 'PM' : 'AM';
    const timeDisplay = `${hour12}:${minutes} ${ampm}`;

    // Create booking request
    const { data: request, error } = await supabase
      .from('booking_requests')
      .insert({
        tenant_id: tenantId,
        client_id: clientId,
        phone_number: from,
        message: `Service: ${service.name}\nDate: ${dateDisplay}\nTime: ${timeDisplay} IST`,
        parsed_service: service.name,
        parsed_date: date,
        parsed_time: time,
        status: 'PENDING',
        source: 'WHATSAPP',
        requested_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Send confirmation with details
    await sendTextMessage(from, 
      `✅ *Booking Request Confirmed!*\n\n` +
      `Hi ${profileName}! Your appointment request has been submitted.\n\n` +
      `📋 *Booking Details:*\n` +
      `💇 Service: ${service.name}\n` +
      `📅 Date: ${dateDisplay}\n` +
      `🕐 Time: ${timeDisplay} IST\n` +
      `⏱ Duration: ${service.duration_minutes} mins\n` +
      `💰 Price: ₹${service.base_price}\n\n` +
      `📝 Request ID: ${request.id.substring(0, 8)}\n\n` +
      `Our team will review and confirm your appointment shortly. ` +
      `You'll receive a confirmation message once approved!\n\n` +
      `Thank you for choosing us! 🎉`
    );

    console.log('✅ Booking confirmed:', request.id);
  } catch (error) {
    console.error('Error confirming booking:', error);
    await sendTextMessage(from, 
      `We encountered an issue creating your booking. ` +
      `Please call us directly or try again later. Sorry for the inconvenience! 🙏`
    );
  }
}

/**
 * Handle booking requests (fallback text-based)
 */
async function handleBookingRequest(from: string, message: string, profileName: string, tenantId: string) {
  try {
    const supabase = createServiceRoleClient();
    const phoneVariations = getPhoneVariations(from);

    // Find or create client
    let clientId = null;
    for (const variation of phoneVariations) {
      const { data } = await supabase
        .from('clients')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('phone', variation)
        .maybeSingle();

      if (data) {
        clientId = data.id;
        break;
      }
    }

    // Create booking request
    const { data: request, error } = await supabase
      .from('booking_requests')
      .insert({
        tenant_id: tenantId,
        client_id: clientId,
        phone_number: from,
        message: message,
        status: 'PENDING',
        source: 'WHATSAPP',
        requested_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Send confirmation
    await sendTextMessage(from, 
      `Thank you ${profileName}! 🎉\n\n` +
      `Your booking request has been received.\n\n` +
      `📋 Request ID: ${request.id.substring(0, 8)}\n\n` +
      `Our team will review and confirm your appointment shortly. You'll receive a confirmation message once approved!`
    );

    console.log('✅ Booking request created:', request.id);
  } catch (error) {
    console.error('Error creating booking request:', error);
    await sendTextMessage(from, 
      `We received your booking request but encountered an issue. ` +
      `Please call us directly to confirm your appointment. Sorry for the inconvenience! 🙏`
    );
  }
}
