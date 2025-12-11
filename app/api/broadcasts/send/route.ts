import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendBroadcastMessage } from '@/lib/whatsapp/client';
import { getTenantWhatsAppCredentials } from '@/lib/whatsapp/server';

/**
 * POST /api/broadcasts/send
 * Send broadcast messages to clients via WhatsApp
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Authenticate user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's tenant
    const { data: profile } = await supabase
      .from('profiles')
      .select('default_tenant_id')
      .eq('id', user.id)
      .single();

    const tenantId = profile?.default_tenant_id;
    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 400 });
    }

    const body = await request.json();
    const { title, message, target_type, broadcast_type, image_url, client_ids } = body;

    if (!title || !message) {
      return NextResponse.json(
        { error: 'Title and message are required' },
        { status: 400 }
      );
    }

    // Create broadcast record
    const { data: broadcast, error: broadcastError } = await supabase
      .from('broadcasts')
      .insert({
        tenant_id: tenantId,
        title,
        message,
        broadcast_type: broadcast_type || 'marketing',
        target_type: target_type || 'all',
        image_url: image_url || null,
        status: 'SENDING',
        created_by: user.id,
      })
      .select()
      .single();

    if (broadcastError) {
      console.error('Error creating broadcast:', broadcastError);
      return NextResponse.json(
        { error: 'Failed to create broadcast' },
        { status: 500 }
      );
    }

    // Get target clients based on criteria
    let clientsQuery = supabase
      .from('clients')
      .select('id, full_name, phone')
      .eq('tenant_id', tenantId)
      .not('phone', 'is', null);

    // Apply filters based on target_type
    if (target_type === 'selected' && client_ids && client_ids.length > 0) {
      clientsQuery = clientsQuery.in('id', client_ids);
    } else if (target_type === 'active') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      clientsQuery = clientsQuery.gte('last_visit_at', thirtyDaysAgo.toISOString());
    } else if (target_type === 'inactive') {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      clientsQuery = clientsQuery.lt('last_visit_at', ninetyDaysAgo.toISOString());
    } else if (target_type === 'consent_whatsapp') {
      clientsQuery = clientsQuery.eq('consent_whatsapp', true);
    }

    const { data: clients, error: clientsError } = await clientsQuery;

    if (clientsError) {
      console.error('Error fetching clients:', clientsError);
      return NextResponse.json(
        { error: 'Failed to fetch clients' },
        { status: 500 }
      );
    }

    if (!clients || clients.length === 0) {
      await supabase
        .from('broadcasts')
        .update({ status: 'FAILED', target_count: 0, sent_count: 0 })
        .eq('id', broadcast.id);

      return NextResponse.json(
        { error: 'No clients found matching criteria' },
        { status: 400 }
      );
    }

    // Update target count
    await supabase
      .from('broadcasts')
      .update({ target_count: clients.length })
      .eq('id', broadcast.id);

    // Send messages asynchronously (don't wait for completion)
    const credentials = await getTenantWhatsAppCredentials(tenantId);
    sendBroadcastMessagesAsync(
      supabase,
      broadcast.id,
      tenantId,
      clients,
      title,
      message,
      image_url,
      credentials
    );

    return NextResponse.json({
      success: true,
      broadcastId: broadcast.id,
      targetCount: clients.length,
      message: `Broadcast initiated. Sending to ${clients.length} clients...`,
    });
  } catch (error: any) {
    console.error('Error in broadcast send:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send broadcast' },
      { status: 500 }
    );
  }
}

/**
 * Send broadcast messages asynchronously
 */
async function sendBroadcastMessagesAsync(
  supabase: any,
  broadcastId: string,
  tenantId: string,
  clients: any[],
  title: string,
  message: string,
  imageUrl?: string,
  credentials?: { phoneNumberId: string; accessToken: string } | null
) {
  let sentCount = 0;
  let failedCount = 0;

  for (const client of clients) {
    try {
      // Skip clients without phone numbers
      if (!client.phone) {
        failedCount++;
        continue;
      }

      // Create recipient record
      const { data: recipient } = await supabase
        .from('broadcast_recipients')
        .insert({
          tenant_id: tenantId,
          broadcast_id: broadcastId,
          client_id: client.id,
          phone_number: client.phone,
          status: 'PENDING',
        })
        .select()
        .single();

      if (!recipient) {
        failedCount++;
        continue;
      }

      // Send WhatsApp message
      const result = await sendBroadcastMessage(client.phone, {
        title,
        message,
        imageUrl: imageUrl || undefined,
      }, credentials || undefined);

      if (result && result.messages && result.messages.length > 0) {
        sentCount++;
        await supabase
          .from('broadcast_recipients')
          .update({
            status: 'SENT',
            sent_at: new Date().toISOString(),
            whatsapp_message_id: result.messages[0].id,
          })
          .eq('id', recipient.id);
      } else {
        failedCount++;
        await supabase
          .from('broadcast_recipients')
          .update({
            status: 'FAILED',
            error_message: 'No response from WhatsApp API',
          })
          .eq('id', recipient.id);
      }

      // Update broadcast progress every 10 messages
      if ((sentCount + failedCount) % 10 === 0) {
        await supabase
          .from('broadcasts')
          .update({
            sent_count: sentCount,
            failed_count: failedCount,
          })
          .eq('id', broadcastId);
      }

      // Small delay to avoid rate limiting (100ms between messages)
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error: any) {
      console.error(`Error sending to client ${client.id}:`, error);
      failedCount++;
      
      // Update recipient status
      await supabase
        .from('broadcast_recipients')
        .update({
          status: 'FAILED',
          error_message: error.message || 'Unknown error',
        })
        .eq('broadcast_id', broadcastId)
        .eq('client_id', client.id);
    }
  }

  // Final update
  const finalStatus = sentCount === 0 ? 'FAILED' : sentCount === clients.length ? 'COMPLETED' : 'COMPLETED';
  
  await supabase
    .from('broadcasts')
    .update({
      status: finalStatus,
      sent_count: sentCount,
      failed_count: failedCount,
      sent_at: new Date().toISOString(),
    })
    .eq('id', broadcastId);

  console.log(`Broadcast ${broadcastId} completed: ${sentCount} sent, ${failedCount} failed`);
}
