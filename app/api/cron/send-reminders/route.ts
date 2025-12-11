import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTenantWhatsAppCredentials } from '@/lib/whatsapp/server';

/**
 * Cron job to send booking reminders 2 hours before appointment
 * Set up a cron trigger to call this endpoint every 15 minutes
 * 
 * For Render: Add a Cron Job pointing to: https://your-app.onrender.com/api/cron/send-reminders
 * Schedule: Every 15 minutes
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'your-secret-key';
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    
    // Get bookings that are:
    // 1. Starting in the next 120-135 minutes (2 hours window, to catch them)
    // 2. Not cancelled
    // 3. Haven't had reminder sent yet
    const now = new Date();
    const twoHoursLater = new Date(now.getTime() + 120 * 60 * 1000);
    const twoHours15Later = new Date(now.getTime() + 135 * 60 * 1000);

    const { data: bookings, error } = await supabase
      .from('bookings')
      .select(`
        id,
        scheduled_start,
        reminder_sent,
        tenant_id,
        client:clients (
          id,
          full_name,
          phone
        ),
        branch:branches (
          name,
          address
        ),
        booking_items (
          service:services (
            name
          ),
          staff:staff (
            display_name
          )
        )
      `)
      .gte('scheduled_start', twoHoursLater.toISOString())
      .lte('scheduled_start', twoHours15Later.toISOString())
      .eq('reminder_sent', false)
      .neq('status', 'CANCELLED')
      .neq('status', 'NO_SHOW');

    if (error) {
      console.error('Error fetching bookings:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const results = {
      total: bookings?.length || 0,
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Send reminders
    for (const booking of bookings || []) {
      try {
        if (!booking.client?.phone) {
          results.failed++;
          results.errors.push(`No phone number for booking ${booking.id}`);
          continue;
        }

        const serviceName = booking.booking_items
          ?.map((item: any) => item.service?.name)
          .filter(Boolean)
          .join(', ') || 'Service';

        const staffName = booking.booking_items?.[0]?.staff?.display_name;

        const scheduledTime = new Date(booking.scheduled_start);
        const dateString = scheduledTime.toLocaleDateString('en-IN', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          timeZone: 'Asia/Kolkata'
        });
        const timeString = scheduledTime.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
          timeZone: 'Asia/Kolkata'
        });

        // Send WhatsApp reminder message
        const reminderMessage = 
          `⏰ *Appointment Reminder*\n\n` +
          `Hi ${booking.client.full_name || 'there'}! 👋\n\n` +
          `This is a friendly reminder about your upcoming appointment in 2 hours:\n\n` +
          `📋 *Booking Details:*\n` +
          `💇 Service: ${serviceName}\n` +
          (staffName ? `👤 Staff: ${staffName}\n` : '') +
          `📅 Date: ${dateString}\n` +
          `🕐 Time: ${timeString}\n` +
          (booking.branch?.address ? `📍 Location: ${booking.branch.address}\n` : '') +
          `\n⏱ *Please arrive 10 minutes early.*\n\n` +
          `If you need to reschedule or cancel, please contact us as soon as possible.\n\n` +
          `See you soon! 😊`;

        // Use sendTextMessage directly with custom message
        const { sendTextMessage } = await import('@/lib/whatsapp/client');
        const credentials = await getTenantWhatsAppCredentials(booking.tenant_id);
        
        if (!credentials) {
          console.warn(`WhatsApp not configured for tenant ${booking.tenant_id}, skipping reminder for booking ${booking.id}`);
          results.failed++;
          results.errors.push(`Booking ${booking.id}: WhatsApp not configured for tenant`);
          continue;
        }
        
        await sendTextMessage(booking.client.phone, reminderMessage, credentials);

        // Update booking to mark reminder as sent
        await supabase
          .from('bookings')
          .update({
            reminder_sent: true,
            reminder_sent_at: new Date().toISOString(),
          })
          .eq('id', booking.id);

        results.sent++;
      } catch (error: any) {
        console.error(`Error sending reminder for booking ${booking.id}:`, error);
        results.failed++;
        results.errors.push(`Booking ${booking.id}: ${error.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...results,
    });
  } catch (error: any) {
    console.error('Error in send-reminders cron:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
