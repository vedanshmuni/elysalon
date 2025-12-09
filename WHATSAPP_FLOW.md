# WhatsApp Integration - Complete Flow

## 🎯 Overview
Complete WhatsApp Business API integration for automated booking requests, confirmations, reminders, and invoice delivery.

## 📱 Customer Flow

### 1. Initial Contact
When a customer messages the salon on WhatsApp:
- **User sends:** "Hi" or any message
- **System responds:** Welcome message with 3 interactive buttons:
  - 📅 **Book Appointment**
  - 💇 **View Services**  
  - 📞 **Contact Us**

### 2. Booking Request
When customer clicks "Book Appointment":
- **System responds:** Confirmation that request is received with a booking reference
- **Database:** Creates entry in `booking_requests` table with status `PENDING`
- **Dashboard:** Request appears in `/dashboard/bookings/requests` page

### 3. Staff Action (Dashboard)
Staff reviews booking request and either:

#### Accept Booking
- Staff selects service, date, time, and branch
- API endpoint: `PATCH /api/booking-requests/{id}` with `action: "ACCEPT"`
- **System creates:** Actual booking in `bookings` table
- **WhatsApp sends:** Confirmation message to customer with full details:
  ```
  Hi [Name]! 👋
  Your booking has been confirmed! ✅
  
  📅 Date: Monday, December 9, 2025
  🕐 Time: 2:00 PM
  💇 Service: Haircut & Styling
  📍 Location: Main Branch
  ```

#### Decline Booking
- Staff clicks decline
- API endpoint: `PATCH /api/booking-requests/{id}` with `action: "DECLINE"`
- **WhatsApp sends:** Polite decline message to customer

## ⏰ Automated Reminders

### Cron Job Setup
**Endpoint:** `GET /api/cron/send-reminders`
**Schedule:** Every 15 minutes
**Auth:** Bearer token via `CRON_SECRET` env variable

### Reminder Logic
- Runs every 15 minutes
- Finds bookings starting in 60-75 minutes
- Checks `reminder_sent = false` and status not `CANCELLED`/`NO_SHOW`
- Sends WhatsApp reminder:
  ```
  Hi [Name]! ⏰
  Reminder: Your appointment is in 1 hour!
  
  🕐 Time: 2:00 PM
  💇 Service: Haircut & Styling
  📍 Location: Main Branch
  
  See you soon! 😊
  ```
- Updates `reminder_sent = true` and `reminder_sent_at` timestamp

### Render Cron Setup
1. Go to Render Dashboard
2. Add Cron Job:
   - **Name:** Send Booking Reminders
   - **Command:** `curl -X GET https://elysalon.onrender.com/api/cron/send-reminders -H "Authorization: Bearer your-secret-key"`
   - **Schedule:** `*/15 * * * *` (every 15 minutes)

## 💰 Invoice Delivery

### After Payment
When staff marks invoice as paid:
**Endpoint:** `POST /api/invoices/send-whatsapp`
**Payload:** `{ "invoiceId": "uuid" }`

**WhatsApp sends:**
1. Text message with payment confirmation
2. PDF document attachment with invoice

```
Hi [Name]! 🧾

Thank you for your payment of ₹500.00!

Your invoice #INV-001 is attached below.

Thank you for choosing us! 💙
```

## 🔧 Environment Variables Required

```env
# WhatsApp Configuration
WHATSAPP_ACCESS_TOKEN=your_access_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_VERIFY_TOKEN=your_verify_token

# Cron Security
CRON_SECRET=your_secret_key_for_cron_auth

# Application
NEXT_PUBLIC_APP_URL=https://elysalon.onrender.com
```

## 📊 Database Tables Used

### `booking_requests`
- Stores incoming WhatsApp booking requests
- Status: PENDING → ACCEPTED/DECLINED
- Links to created booking via `booking_id`

### `bookings`
- Actual confirmed bookings
- Fields: `reminder_sent`, `reminder_sent_at`

### `invoices`
- Invoice records
- Fields: `invoice_sent_via_whatsapp`, `invoice_sent_at`

## 🚀 Deployment Checklist

- [x] WhatsApp webhook verified at `/api/whatsapp/webhook`
- [x] Middleware excludes webhook from auth
- [x] Environment variables set in Render
- [x] Redirect URLs configured in Supabase
- [ ] Set up Render Cron Job for reminders
- [ ] Test complete flow end-to-end
- [ ] Run database migrations (008_whatsapp_integration.sql)

## 🧪 Testing

### Test Webhook
```
https://elysalon.onrender.com/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=my_webhook_verify_token_123&hub.challenge=test123
```
Should return: `test123`

### Test Flow
1. Send "Hi" from WhatsApp → Should receive buttons
2. Click "Book Appointment" → Should receive confirmation
3. Accept booking in dashboard → Customer gets confirmation
4. Wait for reminder time → Customer gets reminder (via cron)
5. Mark invoice as paid → Send via API → Customer gets invoice PDF

## 📝 Notes

- Interactive buttons limited to 3 per message (WhatsApp limit)
- Button titles max 20 characters
- PDF generation can be enhanced with proper PDF library
- Consider rate limits for WhatsApp API (check Meta documentation)
- Store conversation state if implementing multi-step booking flow

## 🔮 Future Enhancements

- [ ] Multi-step booking flow with date/time selection in WhatsApp
- [ ] List picker for services selection
- [ ] Payment link integration in WhatsApp
- [ ] Review request after service completion
- [ ] Rescheduling via WhatsApp
- [ ] Staff assignment notifications
