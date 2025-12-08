import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: any) {
          cookiesToSet.forEach(({ name, value, options }: any) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }: any) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const publicPaths = ['/signin', '/signup', '/auth'];
  const isPublicPath = publicPaths.some(path => request.nextUrl.pathname.startsWith(path));
  const isOnboarding = request.nextUrl.pathname.startsWith('/onboarding');
  const isDebug = request.nextUrl.pathname.startsWith('/debug');

  if (!user && !isPublicPath && !isOnboarding && !isDebug) {
    // No user, redirect to login
    const url = request.nextUrl.clone();
    url.pathname = '/signin';
    return NextResponse.redirect(url);
  }

  // If user is authenticated, check if onboarding is complete
  if (user && !isPublicPath && !isOnboarding) {
    // Check if user has completed onboarding
    const { data: profile } = await supabase
      .from('profiles')
      .select('default_tenant_id')
      .eq('id', user.id)
      .single();

    // If no tenant, redirect to onboarding
    if (!profile?.default_tenant_id) {
      const url = request.nextUrl.clone();
      url.pathname = '/onboarding';
      return NextResponse.redirect(url);
    }
  }

  // If user tries to access signin/signup while authenticated with tenant, redirect to dashboard
  if (user && isPublicPath) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('default_tenant_id')
      .eq('id', user.id)
      .single();

    const url = request.nextUrl.clone();
    url.pathname = profile?.default_tenant_id ? '/dashboard' : '/onboarding';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
