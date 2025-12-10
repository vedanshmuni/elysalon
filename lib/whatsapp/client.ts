/**
 * WhatsApp Business API Client
 * Uses WhatsApp Cloud API (Meta)
 */

const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

interface WhatsAppMessage {
  to: string;
  type: 'text' | 'template' | 'document';
  text?: {
    body: string;
  };
  template?: {
    name: string;
    language: {
      code: string;
    };
    components?: any[];
  };
  document?: {
    link: string;
    filename: string;
    caption?: string;
  };
}

export async function sendWhatsAppMessage(message: WhatsAppMessage) {
  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
    console.error('WhatsApp credentials not configured');
    throw new Error('WhatsApp integration not configured. Please set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN in environment variables.');
  }

  try {
    const response = await fetch(
      `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          ...message,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('WhatsApp API Error:', error);
      throw new Error(`WhatsApp API error: ${error.error?.message || 'Unknown error'}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    throw error;
  }
}

/**
 * Send text message via WhatsApp
 */
export async function sendTextMessage(phoneNumber: string, message: string) {
  // Remove any non-digit characters and ensure proper format
  const cleanPhone = phoneNumber.replace(/\D/g, '');
  
  return sendWhatsAppMessage({
    to: cleanPhone,
    type: 'text',
    text: {
      body: message,
    },
  });
}

/**
 * Send booking confirmation message
 */
export async function sendBookingConfirmation(
  phoneNumber: string,
  bookingDetails: {
    clientName: string;
    serviceName: string;
    date: string;
    time: string;
    branch: string;
  }
) {
  const message = `Hi ${bookingDetails.clientName}! 👋

Your booking has been confirmed! ✅

📅 Date: ${bookingDetails.date}
🕐 Time: ${bookingDetails.time}
💇 Service: ${bookingDetails.serviceName}
📍 Location: ${bookingDetails.branch}

We look forward to seeing you! If you need to reschedule, please contact us.`;

  return sendTextMessage(phoneNumber, message);
}

/**
 * Send booking reminder (1 hour before)
 */
export async function sendBookingReminder(
  phoneNumber: string,
  bookingDetails: {
    clientName: string;
    serviceName: string;
    time: string;
    branch: string;
  }
) {
  const message = `Hi ${bookingDetails.clientName}! ⏰

Reminder: Your appointment is in 1 hour!

🕐 Time: ${bookingDetails.time}
💇 Service: ${bookingDetails.serviceName}
📍 Location: ${bookingDetails.branch}

See you soon! 😊`;

  return sendTextMessage(phoneNumber, message);
}

/**
 * Send invoice PDF via WhatsApp
 */
export async function sendInvoicePDF(
  phoneNumber: string,
  invoiceDetails: {
    clientName: string;
    invoiceNumber: string;
    pdfUrl: string;
    amount: string;
  }
) {
  const cleanPhone = phoneNumber.replace(/\D/g, '');

  // First send a text message
  await sendTextMessage(
    cleanPhone,
    `Hi ${invoiceDetails.clientName}! 🧾

Thank you for your payment of ${invoiceDetails.amount}! 

Your invoice #${invoiceDetails.invoiceNumber} is attached below. 

Thank you for choosing us! 💙`
  );

  // Then send the PDF document
  return sendWhatsAppMessage({
    to: cleanPhone,
    type: 'document',
    document: {
      link: invoiceDetails.pdfUrl,
      filename: `Invoice_${invoiceDetails.invoiceNumber}.pdf`,
      caption: `Invoice #${invoiceDetails.invoiceNumber}`,
    },
  });
}

/**
 * Send new booking request notification to salon
 */
export async function sendNewBookingRequestNotification(
  salonPhoneNumber: string,
  requestDetails: {
    clientName: string;
    clientPhone: string;
    serviceName: string;
    preferredDate: string;
    preferredTime: string;
  }
) {
  const message = `🔔 NEW BOOKING REQUEST

Client: ${requestDetails.clientName}
Phone: ${requestDetails.clientPhone}
Service: ${requestDetails.serviceName}
Preferred Date: ${requestDetails.preferredDate}
Preferred Time: ${requestDetails.preferredTime}

Please check your dashboard to accept or decline this booking.`;

  return sendTextMessage(salonPhoneNumber, message);
}

/**
 * Send broadcast message (offer/promotion) to multiple clients
 * This function handles single message send - use in a loop for bulk sends
 */
export async function sendBroadcastMessage(
  phoneNumber: string,
  broadcastDetails: {
    title: string;
    message: string;
    imageUrl?: string;
  }
) {
  const cleanPhone = phoneNumber.replace(/\D/g, '');
  const fullMessage = `${broadcastDetails.title}\n\n${broadcastDetails.message}`;

  // If image URL is provided, send with image
  if (broadcastDetails.imageUrl) {
    try {
      const cleanPhone = phoneNumber.replace(/\D/g, '');

      if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
        console.error('WhatsApp credentials not configured');
        throw new Error('WhatsApp integration not configured');
      }

      // Send image with caption
      const response = await fetch(
        `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: cleanPhone,
            type: 'image',
            image: {
              link: broadcastDetails.imageUrl,
              caption: fullMessage,
            },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        console.error('WhatsApp API Error:', error);
        throw new Error(`WhatsApp API error: ${error.error?.message || 'Unknown error'}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error sending broadcast with image:', error);
      // Fallback to text-only if image fails
      return sendTextMessage(cleanPhone, fullMessage);
    }
  }

  // Send text-only message
  return sendTextMessage(cleanPhone, fullMessage);
}

/**
 * Send interactive buttons (max 3 buttons)
 */
export async function sendInteractiveButtons(
  phoneNumber: string,
  options: {
    headerText?: string;
    bodyText: string;
    footerText?: string;
    buttons: Array<{ id: string; title: string }>;
  }
) {
  const cleanPhone = phoneNumber.replace(/\D/g, '');

  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
    throw new Error('WhatsApp integration not configured');
  }

  const payload: any = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanPhone,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: {
        text: options.bodyText
      },
      action: {
        buttons: options.buttons.slice(0, 3).map(btn => ({
          type: 'reply',
          reply: {
            id: btn.id,
            title: btn.title.substring(0, 20) // Max 20 chars
          }
        }))
      }
    }
  };

  if (options.headerText) {
    payload.interactive.header = {
      type: 'text',
      text: options.headerText
    };
  }

  if (options.footerText) {
    payload.interactive.footer = {
      text: options.footerText
    };
  }

  try {
    const response = await fetch(
      `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('WhatsApp Interactive Error:', error);
      throw new Error(`WhatsApp API error: ${error.error?.message || 'Unknown error'}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error sending interactive buttons:', error);
    throw error;
  }
}

/**
 * Send interactive list (up to 10 items per section)
 */
export async function sendInteractiveList(
  phoneNumber: string,
  options: {
    headerText?: string;
    bodyText: string;
    footerText?: string;
    buttonText: string;
    sections: Array<{
      title?: string;
      rows: Array<{
        id: string;
        title: string;
        description?: string;
      }>;
    }>;
  }
) {
  const cleanPhone = phoneNumber.replace(/\D/g, '');

  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
    throw new Error('WhatsApp integration not configured');
  }

  const payload: any = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanPhone,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: {
        text: options.bodyText
      },
      action: {
        button: options.buttonText.substring(0, 20),
        sections: options.sections.map(section => ({
          title: section.title,
          rows: section.rows.map(row => ({
            id: row.id,
            title: row.title.substring(0, 24), // Max 24 chars
            description: row.description?.substring(0, 72) // Max 72 chars
          }))
        }))
      }
    }
  };

  if (options.headerText) {
    payload.interactive.header = {
      type: 'text',
      text: options.headerText
    };
  }

  if (options.footerText) {
    payload.interactive.footer = {
      text: options.footerText
    };
  }

  try {
    const response = await fetch(
      `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('WhatsApp Interactive List Error:', error);
      throw new Error(`WhatsApp API error: ${error.error?.message || 'Unknown error'}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error sending interactive list:', error);
    throw error;
  }
}

/**
 * Send offer/promotion template message (if you have approved templates)
 */
export async function sendOfferTemplate(
  phoneNumber: string,
  templateName: string,
  parameters: string[]
) {
  const cleanPhone = phoneNumber.replace(/\D/g, '');

  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
    console.error('WhatsApp credentials not configured');
    throw new Error('WhatsApp integration not configured');
  }

  try {
    const response = await fetch(
      `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: cleanPhone,
          type: 'template',
          template: {
            name: templateName,
            language: {
              code: 'en_US',
            },
            components: [
              {
                type: 'body',
                parameters: parameters.map(param => ({
                  type: 'text',
                  text: param,
                })),
              },
            ],
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('WhatsApp Template API Error:', error);
      throw new Error(`WhatsApp API error: ${error.error?.message || 'Unknown error'}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error sending offer template:', error);
    throw error;
  }
}
