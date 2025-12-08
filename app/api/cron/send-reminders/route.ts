import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendBookingReminder } from '@/lib/whatsapp/client';

/**
 * Cron job to send booking reminders 1 hour before appointment
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
    // 1. Starting in the next 60-75 minutes (to catch them in the window)
    // 2. Not cancelled
    // 3. Haven't had reminder sent yet
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    const oneHour15Later = new Date(now.getTime() + 75 * 60 * 1000);

    const { data: bookings, error } = await supabase
      .from('bookings')
      .select(`
        id,
        scheduled_start,
        reminder_sent,
        client:clients (
          id,
          full_name,
          phone
        ),
        branch:branches (
          name
        ),
        booking_items (
          service:services (
            name
          )
        )
      `)
      .gte('scheduled_start', oneHourLater.toISOString())
      .lte('scheduled_start', oneHour15Later.toISOString())
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

        const scheduledTime = new Date(booking.scheduled_start);
        const timeString = scheduledTime.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        });

        await sendBookingReminder(booking.client.phone, {
          clientName: booking.client.full_name || 'Valued Customer',
          serviceName,
          time: timeString,
          branch: booking.branch?.name || 'Our Location',
        });

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
