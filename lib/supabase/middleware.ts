import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getSession reads cookies (no auth-server roundtrip) — safe in middleware
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const path = request.nextUrl.pathname;

  const isPublic =
    path.startsWith('/login') ||
    path.startsWith('/auth') ||
    // Signed trial agreements: the merchant has no login and never will.
    // The token in the URL is the credential; the row is served through a
    // security-definer RPC so the table itself stays closed.
    path.startsWith('/agreement/') ||
    path.startsWith('/start/') ||
    path.startsWith('/invoice/') ||
    path.startsWith('/cryptopop') ||
    path.startsWith('/one-pager/') ||
    // The merchant's pre-visit checklist. Same rule as /agreement: no login
    // exists for them, the token is the credential, and every read and write
    // goes through a security-definer RPC.
    path.startsWith('/setup/') ||
    // Call-script review. Same rule again: the reviewer is outside the company,
    // has no CRM account, and the token is the credential.
    path.startsWith('/review/') ||
    // A rep's pitch deck, left behind with a merchant who has no account.
    path.startsWith('/pitch/') ||
    path === '/locked';

  // Not signed in + private path -> /login
  if (!session && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Signed in on /login -> /dashboard
  if (session && path === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  // Lock-mode check — only when signed in and on a private path
  // System page itself is exempt so super_admin can always reach it
  if (session && !isPublic && path !== '/system' && !path.startsWith('/system/')) {
    try {
      // Step 1: get role (separate query, no join)
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, org_id')
        .eq('id', session.user.id)
        .single();

      // super_admin always bypasses
      if (profile && profile.role !== 'super_admin' && profile.org_id) {
        // Step 2: get lock status (separate query, no join)
        const { data: org } = await supabase
          .from('organizations')
          .select('lock_status')
          .eq('id', profile.org_id)
          .single();

        if (org?.lock_status === 'locked') {
          const url = request.nextUrl.clone();
          url.pathname = '/locked';
          return NextResponse.redirect(url);
        }
      }
    } catch {
      // FAIL-OPEN: if any of the lock-check queries error, let the request through.
      // We never want a query failure to lock everyone out.
    }
  }

  return supabaseResponse;
}
