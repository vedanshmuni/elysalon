# WhatsApp Business Integration Setup Guide

This guide will help you set up WhatsApp Business API integration for automated booking requests, reminders, and invoice delivery.

## Overview

The WhatsApp integration provides:
- 📥 **Booking Requests**: Customers can request bookings via WhatsApp
- 🔔 **Automated Reminders**: Send reminders 1 hour before appointments
- 📄 **Invoice Delivery**: Send invoice PDFs via WhatsApp after payment
- ✅ **Booking Confirmations**: Automatic confirmation messages

## Prerequisites

- Facebook Business Account
- WhatsApp Business Account
- Phone number for WhatsApp Business API
- Meta Developer Account

## Step 1: Create Meta App for WhatsApp Business

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Click **My Apps** → **Create App**
3. Select **Business** as app type
4. Fill in app details:
   - **App Name**: ElySalon WhatsApp Integration
   - **App Contact Email**: Your email
   - **Business Account**: Select or create one
5. Click **Create App**

## Step 2: Set Up WhatsApp Business API

1. In your Meta app dashboard, click **Add Product**
2. Find **WhatsApp** and click **Set Up**
3. Under **API Setup**, you'll see:
   - **Phone Number ID**: Copy this (needed for `WHATSAPP_PHONE_NUMBER_ID`)
   - **WhatsApp Business Account ID**: Note this
4. Under **Temporary Access Token**:
   - Click **Copy** to get your access token (valid for 24 hours)
   - Later, you'll create a permanent access token

## Step 3: Create Permanent Access Token

1. Go to **Settings** → **Business Settings**
2. Navigate to **System Users**
3. Click **Add** to create a new system user:
   - **Name**: ElySalon WhatsApp Bot
   - **Role**: Admin
4. Click **Add Assets**
5. Select **Apps** → Your app → Enable **Manage App**
6. Click **Generate New Token**:
   - **App**: Select your app
   - **Permissions**: Select `whatsapp_business_messaging`, `whatsapp_business_management`
7. **Copy and save** this token (needed for `WHATSAPP_ACCESS_TOKEN`)

## Step 4: Add Phone Number

1. In WhatsApp settings, click **Add Phone Number**
2. Follow the verification process:
   - Enter your phone number
   - Verify via SMS/Voice call
3. **Important**: This number will be used to send/receive messages
4. Complete the business verification process

## Step 5: Configure Environment Variables

Add these to your `.env` file:

```bash
# WhatsApp Business API Configuration
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here
WHATSAPP_ACCESS_TOKEN=your_permanent_access_token_here
WHATSAPP_VERIFY_TOKEN=elysalon_verify_2024_secure

# Cron Job Security
CRON_SECRET=generate_a_random_secure_string_here
```

**To generate `CRON_SECRET`**, run:
```bash
openssl rand -base64 32
```

## Step 6: Set Up Webhook

1. In your Meta app, go to **WhatsApp** → **Configuration**
2. Under **Webhook**, click **Edit**
3. Enter webhook details:
   - **Callback URL**: `https://your-app.onrender.com/api/whatsapp/webhook`
   - **Verify Token**: Use the same value as `WHATSAPP_VERIFY_TOKEN` in your .env
4. Click **Verify and Save**
5. Under **Webhook Fields**, subscribe to:
   - ✅ `messages`
   - ✅ `message_status`

## Step 7: Update Database

Run the migration to add WhatsApp support:

```bash
# Apply the migration in Supabase dashboard or via CLI
# Migration file: supabase/migrations/008_whatsapp_integration.sql
```

Or manually in Supabase SQL Editor:
1. Go to your Supabase dashboard
2. Navigate to **SQL Editor**
3. Copy contents of `supabase/migrations/008_whatsapp_integration.sql`
4. Execute the query

## Step 8: Update Tenant WhatsApp Number

In your Supabase database, update your tenant record:

```sql
UPDATE tenants
SET whatsapp_number = 'YOUR_BUSINESS_WHATSAPP_NUMBER'
WHERE id = 'your_tenant_id';
```

**Format**: Use international format without '+' or spaces (e.g., `919876543210` for India)

## Step 9: Set Up Cron Job for Reminders

On Render.com:

1. Go to your service dashboard
2. Click **Cron Jobs** (or add a new cron job)
3. Create new cron job:
   - **Name**: Send WhatsApp Reminders
   - **Command**: `curl -X POST https://your-app.onrender.com/api/cron/send-reminders -H "Authorization: Bearer YOUR_CRON_SECRET"`
   - **Schedule**: `*/15 * * * *` (every 15 minutes)
4. Save the cron job

**Alternative using external cron service** (like cron-job.org):
1. Create account on [cron-job.org](https://cron-job.org)
2. Add new cron job:
   - **URL**: `https://your-app.onrender.com/api/cron/send-reminders`
   - **Schedule**: Every 15 minutes
   - **Headers**: Add `Authorization: Bearer YOUR_CRON_SECRET`

## Step 10: Test the Integration

### Test 1: Webhook Verification
```bash
curl -X GET "https://your-app.onrender.com/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=elysalon_verify_2024_secure&hub.challenge=test123"
```
Should return: `test123`

### Test 2: Send Booking Request
1. Send a WhatsApp message to your business number:
   ```
   I want to book a haircut on 2024-12-25 at 2pm
   ```
2. Check dashboard → **Booking Requests**
3. Should see the new request with status "pending"

### Test 3: Accept Booking & Confirmation
1. Click **Accept** on a pending request
2. Complete the booking form
3. Customer should receive confirmation via WhatsApp

### Test 4: Reminder
1. Create a booking for 1 hour from now
2. Wait for cron job to run (or trigger manually)
3. Customer should receive reminder via WhatsApp

### Test 5: Invoice Delivery
1. Process a payment in POS for a client with phone number
2. Confirm to send invoice via WhatsApp
3. Customer should receive invoice PDF

## Troubleshooting

### Messages Not Sending
- Verify `WHATSAPP_ACCESS_TOKEN` is valid (not expired)
- Check `WHATSAPP_PHONE_NUMBER_ID` is correct
- Ensure phone numbers are in international format without '+'
- Check Render logs for errors: `Dashboard → Logs`

### Webhook Not Receiving Messages
- Verify webhook URL is publicly accessible
- Check `WHATSAPP_VERIFY_TOKEN` matches in both .env and Meta dashboard
- Ensure webhook subscriptions are active in Meta dashboard
- Check webhook logs in Meta dashboard

### Cron Job Not Running
- Verify `CRON_SECRET` matches in both .env and cron configuration
- Check if Render free tier has cron limitations
- Test manually: `curl -X POST https://your-app.onrender.com/api/cron/send-reminders -H "Authorization: Bearer YOUR_CRON_SECRET"`

### Database Errors
- Ensure migration 008 is applied: `booking_requests` table exists
- Check `tenants.whatsapp_number` is populated
- Verify RLS policies allow access

## Production Checklist

- [ ] Meta app is in production mode (not development)
- [ ] Business verification completed
- [ ] Phone number verified and active
- [ ] Permanent access token generated and stored securely
- [ ] Webhook configured and verified
- [ ] Environment variables set in Render
- [ ] Database migration applied
- [ ] Tenant WhatsApp number updated
- [ ] Cron job configured and running
- [ ] All tests passed successfully
- [ ] Customer phone numbers in database are in correct format
- [ ] Monitor logs for errors after launch

## Important Notes

1. **Rate Limits**: WhatsApp has rate limits based on your tier:
   - Tier 1: 1,000 messages/day
   - Tier 2: 10,000 messages/day
   - Tier 3: 100,000 messages/day

2. **Message Templates**: For broadcasting, you need approved message templates

3. **Phone Number Format**: Always use international format without '+' (e.g., `919876543210`)

4. **Business Verification**: Required for production access and higher rate limits

5. **Costs**: WhatsApp Business API may have messaging costs depending on volume

## Support

- [WhatsApp Business Platform Documentation](https://developers.facebook.com/docs/whatsapp)
- [Meta Business Help Center](https://www.facebook.com/business/help)
- [WhatsApp API Postman Collection](https://www.postman.com/meta/workspace/whatsapp-business-platform)

## Security Best Practices

1. **Never commit** access tokens to version control
2. Use **environment variables** for all secrets
3. **Rotate** access tokens periodically
4. **Monitor** webhook logs for suspicious activity
5. **Validate** all incoming webhook data
6. Use **HTTPS only** for webhook URLs
7. Implement **rate limiting** on webhook endpoint if needed
