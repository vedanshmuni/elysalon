import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendBookingConfirmation, sendTextMessage } from '@/lib/whatsapp/client';

/**
 * Update booking request status (ACCEPT or DECLINE)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { action, bookingDetails } = await request.json();
    const requestId = params.id;

    if (!['ACCEPT', 'DECLINE'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be ACCEPT or DECLINE' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get the booking request
    const { data: bookingRequest, error: fetchError } = await supabase
      .from('booking_requests')
      .select('*, clients(full_name, phone)')
      .eq('id', requestId)
      .single();

    if (fetchError || !bookingRequest) {
      return NextResponse.json(
        { error: 'Booking request not found' },
        { status: 404 }
      );
    }

    if (action === 'ACCEPT') {
      // Create actual booking if details provided
      if (bookingDetails) {
        const { data: booking, error: bookingError } = await supabase
          .from('bookings')
          .insert({
            tenant_id: bookingRequest.tenant_id,
            client_id: bookingRequest.client_id,
            branch_id: bookingDetails.branch_id,
            scheduled_start: bookingDetails.scheduled_start,
            scheduled_end: bookingDetails.scheduled_end,
            status: 'CONFIRMED',
            notes: bookingRequest.notes || '',
          })
          .select()
          .single();

        if (bookingError) {
          return NextResponse.json(
            { error: 'Failed to create booking' },
            { status: 500 }
          );
        }

        // Add booking items (services)
        if (bookingDetails.services && bookingDetails.services.length > 0) {
          const bookingItems = bookingDetails.services.map((serviceId: string) => ({
            tenant_id: bookingRequest.tenant_id,
            booking_id: booking.id,
            service_id: serviceId,
          }));

          await supabase.from('booking_items').insert(bookingItems);
        }

        // Update booking request
        await supabase
          .from('booking_requests')
          .update({
            status: 'ACCEPTED',
            booking_id: booking.id,
            responded_at: new Date().toISOString(),
          })
          .eq('id', requestId);

        // Send confirmation via WhatsApp
        const clientPhone = bookingRequest.phone_number;
        const scheduledDate = new Date(bookingDetails.scheduled_start);
        
        await sendBookingConfirmation(clientPhone, {
          clientName: bookingRequest.clients?.full_name || 'Valued Customer',
          serviceName: bookingDetails.serviceName || 'Your selected service',
          date: scheduledDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
          time: scheduledDate.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          branch: bookingDetails.branchName || 'Our salon',
        });

        return NextResponse.json({
          success: true,
          message: 'Booking accepted and confirmed',
          booking,
        });
      } else {
        // Just mark as accepted without creating booking yet
        await supabase
          .from('booking_requests')
          .update({
            status: 'ACCEPTED',
            responded_at: new Date().toISOString(),
          })
          .eq('id', requestId);

        return NextResponse.json({
          success: true,
          message: 'Booking request accepted',
        });
      }
    } else if (action === 'DECLINE') {
      // Update status to declined
      await supabase
        .from('booking_requests')
        .update({
          status: 'DECLINED',
          responded_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      // Send decline message via WhatsApp
      const clientPhone = bookingRequest.phone_number;
      await sendTextMessage(
        clientPhone,
        `Hello! Thank you for your interest in booking with us.\n\nUnfortunately, we are unable to accommodate your booking request at this time. Please feel free to contact us directly or try booking for a different time.\n\nWe appreciate your understanding! 💙`
      );

      return NextResponse.json({
        success: true,
        message: 'Booking request declined',
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating booking request:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
