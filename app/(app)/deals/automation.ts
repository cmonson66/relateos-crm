'use server';

// Pipeline automation: the workflow maintains the kanban, not the reps.
// advanceDealTo(account, slug): finds the account's open deal and moves it
// to the named stage - or creates one there if the account has no open
// deal yet. Only ever moves FORWARD (position-wise); never demotes a deal
// a rep advanced by hand. Fails silent by design: automation must never
// break the calling workflow.

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function advanceDealTo(accountId: string, stageSlug: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles').select('org_id').eq('id', user.id).single();
    if (!profile) return;

    const { data: target } = await supabase
      .from('pipeline_stages')
      .select('id, position')
      .eq('slug', stageSlug)
      .maybeSingle();
    if (!target) return; // stage taxonomy not installed - no-op

    const { data: account } = await supabase
      .from('accounts').select('name').eq('id', accountId).maybeSingle();

    // Open deal = not in a won/lost stage
    const { data: openDeal } = await supabase
      .from('deals')
      .select('id, stage_id, stage:pipeline_stages(position, is_won, is_lost)')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(5);

    const live = (openDeal ?? []).find((d) => {
      const st = Array.isArray(d.stage) ? d.stage[0] : d.stage;
      return st && !st.is_won && !st.is_lost;
    });

    if (live) {
      const st = Array.isArray(live.stage) ? live.stage[0] : live.stage;
      if ((st?.position ?? 0) >= target.position) return; // never demote
      await supabase.from('deals').update({ stage_id: target.id }).eq('id', live.id);
    } else {
      await supabase.from('deals').insert({
        name: `${account?.name ?? 'Terminal'} - terminal`,
        account_id: accountId,
        stage_id: target.id,
        value_cents: 72700, // year one, all in
        org_id: profile.org_id,
        created_by: user.id,
        owner_id: user.id,
      });
    }
    revalidatePath('/deals');
  } catch (e) {
    console.error('advanceDealTo:', e);
  }
}
