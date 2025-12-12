import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

// Initialize Supabase Admin Client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      razorpay_payment_id, 
      razorpay_order_id, 
      razorpay_signature, 
      email, 
      plan_code, 
      product_code 
    } = body;

    // 1. Verify Razorpay Signature
    // This ensures the payment actually happened and wasn't faked by the frontend
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      console.error('RAZORPAY_KEY_SECRET is not set');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const generated_signature = crypto
      .createHmac('sha256', secret)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (generated_signature !== razorpay_signature) {
      return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 });
    }

    // 2. Generate Secure Token
    // Payment is valid, so we generate the token for onboarding
    const token = crypto.randomBytes(32).toString('hex');

    // 3. Store Token in Database
    const { error: dbError } = await supabaseAdmin
      .from('subscription_tokens')
      .insert({
        token: token,
        email: email,
        product_code: product_code || 'salon',
        plan_code: plan_code,
        payment_id: razorpay_payment_id,
        payment_metadata: {
          order_id: razorpay_order_id,
          signature: razorpay_signature
        }
      });

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 });
    }

    // 4. Return Token to Frontend
    return NextResponse.json({ 
      success: true, 
      token: token,
      redirect_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/onboarding?token=${token}`
    });

  } catch (error) {
    console.error('Payment verification error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Handle OPTIONS for CORS (since React app is on a different domain)
export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*', // In production, replace with your domain
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
