'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'working' | 'error'>('working');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const supabase = createClient();

    async function run() {
      try {
        // ─────────────────────────────────────────────────────────────────
        // Path A: implicit / hash flow ("#access_token=...&refresh_token=...")
        // This is what generateLink({type:\'invite\'}) emits.
        // ─────────────────────────────────────────────────────────────────
        if (typeof window !== 'undefined' && window.location.hash) {
          const hash = window.location.hash.slice(1);
          const params = new URLSearchParams(hash);
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');
          const errorDescription = params.get('error_description');

          if (errorDescription) {
            throw new Error(errorDescription);
          }

          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });
            if (error) throw error;

            // Clear hash from URL so refresh doesn\'t re-process
            history.replaceState(null, '', window.location.pathname);

            await afterSignIn(supabase, router);
            return;
          }
        }

        // ─────────────────────────────────────────────────────────────────
        // Path B: PKCE / code flow ("?code=...")
        // Used by signInWithOAuth and OTP-via-email when configured for PKCE.
        // ─────────────────────────────────────────────────────────────────
        const code = searchParams.get('code');
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          await afterSignIn(supabase, router);
          return;
        }

        // Neither path produced a session
        throw new Error('No auth tokens found in URL');
      } catch (err) {
        console.error('Auth callback error:', err);
        setErrorMessage(err instanceof Error ? err.message : 'Authentication failed');
        setStatus('error');
      }
    }

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-background">
        <div className="card-lit border border-destructive/30 rounded-md p-8 max-w-md text-center relative">
          <div className="h-[3px] bg-destructive rounded-t-md absolute inset-x-0 top-0" />
          <h2 className="font-display text-2xl tracking-wider mb-3">SIGN-IN FAILED</h2>
          <p className="text-sm text-muted-foreground mb-5">
            {errorMessage || 'Your invite link may have expired or already been used.'}
          </p>
          <button
            onClick={() => router.push('/login')}
            className="font-display tracking-wider text-sm text-primary hover:text-primary/80 underline"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-background">
      <div className="card-lit border border-border/40 rounded-md p-8 max-w-md text-center relative">
        <div className="h-[3px] bg-primary glow-stripe rounded-t-md absolute inset-x-0 top-0" />
        <div className="flex items-center justify-center gap-3 mb-3">
          <span className="inline-block w-2 h-2 bg-primary rounded-full hud-pulse" />
          <h2 className="font-display text-xl tracking-wider">SIGNING YOU IN...</h2>
        </div>
        <p className="text-xs text-muted-foreground">One moment.</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// After session is established, patch invited-user metadata into profile
// and decide where to redirect (welcome vs dashboard)
// ─────────────────────────────────────────────────────────────────────────
async function afterSignIn(
  supabase: ReturnType<typeof createClient>,
  router: ReturnType<typeof useRouter>
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    router.push('/login?error=no_user');
    return;
  }

  // Patch invited metadata into profile
  if (user.user_metadata) {
    const meta = user.user_metadata as {
      full_name?: string;
      org_id?: string;
      invited_role?: string;
      invited_manager_id?: string;
    };
    if (meta.invited_role && meta.org_id) {
      await supabase.from('profiles').update({
        full_name: meta.full_name || user.email,
        org_id: meta.org_id,
        role: meta.invited_role,
        manager_id: meta.invited_manager_id || null,
      }).eq('id', user.id);
    }
  }

  // Check if password has been set
  const { data: profile } = await supabase
    .from('profiles')
    .select('password_set_at')
    .eq('id', user.id)
    .single();

  if (!profile?.password_set_at) {
    router.push('/welcome');
    router.refresh();
  } else {
    router.push('/dashboard');
    router.refresh();
  }
}
