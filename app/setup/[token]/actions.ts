'use server';

import { createClient } from '@/lib/supabase/server';

/**
 * The merchant ticking a step off, with no login.
 *
 * The token is the only thing accepted - no deal id, no org - because the RPC
 * resolves the deal from it server-side. Anything else here would be a hole
 * that the merchant's own link could be turned into.
 *
 * Returns the full step map so the page reflects what the database actually
 * holds rather than what the button hoped for.
 */
export async function markSetupStep(input: {
  token: string;
  step: 'exchange' | 'account' | 'ready';
  done: boolean;
}): Promise<{ ok: boolean; steps: Record<string, string | null> }> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('mark_setup_step', {
    p_token: input.token,
    p_step: input.step,
    p_done: input.done,
  });

  if (error || data === null) {
    return { ok: false, steps: {} };
  }

  return { ok: true, steps: (data as Record<string, string | null>) ?? {} };
}
