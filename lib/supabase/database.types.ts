// Placeholder for Supabase generated types
// Run: npm run supabase:generate-types after setting up your Supabase project

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      [key: string]: any;
    };
    Views: {
      [key: string]: any;
    };
    Functions: {
      [key: string]: any;
    };
    Enums: {
      user_role: 'SUPER_ADMIN' | 'OWNER' | 'MANAGER' | 'STAFF' | 'CASHIER' | 'READ_ONLY';
      booking_status:
        | 'PENDING'
        | 'CONFIRMED'
        | 'IN_PROGRESS'
        | 'COMPLETED'
        | 'CANCELLED'
        | 'NO_SHOW';
      invoice_status: 'DRAFT' | 'OPEN' | 'PAID' | 'VOID' | 'REFUNDED';
      payment_method: 'CASH' | 'CARD' | 'UPI' | 'WALLET' | 'OTHER';
      discount_type: 'PERCENT' | 'FIXED';
      campaign_status: 'DRAFT' | 'SCHEDULED' | 'SENT' | 'CANCELLED';
      notification_channel: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH';
      subscription_status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED';
    };
  };
}
