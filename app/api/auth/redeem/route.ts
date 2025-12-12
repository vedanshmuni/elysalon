import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialize Supabase Admin Client
// We need SERVICE_ROLE_KEY to bypass RLS and generate magic links
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

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const token = requestUrl.searchParams.get('token');

  // 1. Basic Validation
  if (!token) {
    return NextResponse.redirect(new URL('/signin?error=missing_token', request.url));
  }

  try {
    // 2. Redeem Token (Atomic Database Operation)
    const { data: result, error: rpcError } = await supabaseAdmin.rpc('redeem_subscription_token', {
      p_token: token,
    });

    if (rpcError) {
      console.error('Token redemption RPC error:', rpcError);
      return NextResponse.redirect(new URL('/signin?error=redemption_failed', request.url));
    }

    // Check the result from the RPC function
    // The RPC returns an array of rows, we take the first one
    const redemption = Array.isArray(result) ? result[0] : result;

    if (!redemption || !redemption.success) {
      console.error('Token invalid or expired:', redemption?.message);
      return NextResponse.redirect(new URL(`/signin?error=${redemption?.message || 'invalid_token'}`, request.url));
    }

    const { email, plan_code, product_code } = redemption.token_data;

    // 3. Find or Create User
    // We try to find the user by email. If they don't exist, we might want to create them
    // or let the magic link handle the "sign up" part implicitly.
    // However, for a cleaner flow, we'll just generate the link.
    
    // 4. Generate Magic Link
    // This creates a secure, one-time login link for this specific user
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
      options: {
        // Redirect to onboarding after login, passing the plan info
        redirectTo: `${requestUrl.origin}/onboarding?plan=${plan_code}&verified=true`,
      },
    });

    if (linkError) {
      console.error('Magic link generation failed:', linkError);
      return NextResponse.redirect(new URL('/signin?error=login_failed', request.url));
    }

    // 5. Redirect User to the Magic Link
    // This will:
    // a) Verify the email hash
    // b) Set the Supabase Auth cookies
    // c) Redirect to the 'redirectTo' URL (Onboarding)
    return NextResponse.redirect(linkData.properties.action_link);

  } catch (error) {
    console.error('Unexpected error in redemption flow:', error);
    return NextResponse.redirect(new URL('/signin?error=server_error', request.url));
  }
}
