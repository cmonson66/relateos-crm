import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Patch the new user's profile with their invited role/org if metadata says so
        if (user.user_metadata) {
          const meta = user.user_metadata as {
            full_name?: string;
            org_id?: string;
            invited_role?: string;
            invited_manager_id?: string;
          };
          if (meta.invited_role) {
            await supabase.from('profiles').update({
              full_name: meta.full_name || user.email,
              org_id: meta.org_id,
              role: meta.invited_role,
              manager_id: meta.invited_manager_id || null,
            }).eq('id', user.id);
          }
        }

        // If they have not set a password yet, route to /welcome so they can.
        const { data: profile } = await supabase
          .from('profiles')
          .select('password_set_at')
          .eq('id', user.id)
          .single();

        if (!profile?.password_set_at) {
          return NextResponse.redirect(`${origin}/welcome`);
        }
      }

      return NextResponse.redirect(`${origin}${next ?? '/dashboard'}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=callback`);
}
