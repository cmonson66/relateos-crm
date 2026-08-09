'use server';

import { createClient } from '@/lib/supabase/server';
import { logActivity } from '@/app/(app)/activities/actions';

export type CallOutcome =
  | 'booked'
  | 'sent_onepager'
  | 'sent_pulse'
  | 'callback'
  | 'no_answer'
  | 'not_interested'
  | 'dnc';

const OUTCOME_LABEL: Record<CallOutcome, string> = {
  booked: 'Call: booked walk-in visit',
  sent_onepager: 'Call: sent one-pager',
  sent_pulse: 'Call: sent Pulse link',
  callback: 'Call: callback requested',
  no_answer: 'Call: no answer',
  not_interested: 'Call: not interested',
  dnc: 'Call: DNC - never contact',
};

export async function logCallOutcome(input: {
  accountId: string;
  contactId: string | null;
  legacyId: string | null;
  outcome: CallOutcome;
  notes: string;
  volume: number | null;
}) {
  const { accountId, contactId, legacyId, outcome, notes, volume } = input;

  // Timeline entry via the existing activity rails (org, audit, revalidate)
  await logActivity({
    type: 'call',
    subject: OUTCOME_LABEL[outcome],
    body: [notes.trim(), volume ? `Self-reported volume: $${volume.toLocaleString()}/mo` : '']
      .filter(Boolean)
      .join('\n'),
    account_id: accountId,
    contact_id: contactId,
  });

  // Lead-side write-back through the security-definer bridge (034):
  // captured volume feeds every future email/card/call; DNC ends contact
  if (legacyId && (volume || outcome === 'dnc')) {
    const supabase = await createClient();
    const { error } = await supabase.rpc('record_call_outcome', {
      p_legacy_id: legacyId,
      p_volume: volume,
      p_dnc: outcome === 'dnc',
    });
    if (error) console.error('record_call_outcome:', error.message);
  }

  return { ok: true };
}
