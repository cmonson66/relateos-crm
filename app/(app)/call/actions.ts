'use server';

import { createClient } from '@/lib/supabase/server';
import { logActivity } from '@/app/(app)/activities/actions';
import { advanceDealTo } from '@/app/(app)/deals/automation';

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
  scheduledAt?: string | null;   // ISO - booked visit / callback time
  scheduleLabel?: string | null; // human label for the timeline
}) {
  const { accountId, contactId, legacyId, outcome, notes, volume, scheduledAt, scheduleLabel } = input;

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

  // A booked demo puts the account in the pipeline at Demo booked
  if (outcome === 'booked') {
    await advanceDealTo(accountId, 'demo-booked');
  }

  // Booked visit / callback become CALENDAR entries: scheduled activities
  if (scheduledAt && (outcome === 'booked' || outcome === 'callback')) {
    await logActivity({
      type: outcome === 'booked' ? 'meeting' : 'task',
      subject: (outcome === 'booked' ? 'Demo visit' : 'Callback') + (scheduleLabel ? ' - ' + scheduleLabel : ''),
      body: notes.trim() || null,
      account_id: accountId,
      contact_id: contactId,
      scheduled_at: scheduledAt,
    });
  }

  // Anything sent gets a follow-up task in 3 days - nothing sent goes unfollowed
  if (outcome === 'sent_onepager' || outcome === 'sent_pulse') {
    const followUp = new Date(Date.now() + 3 * 86400000);
    followUp.setUTCHours(16, 0, 0, 0); // ~9 AM Phoenix
    await logActivity({
      type: 'task',
      subject: 'Follow up: did they look at the ' + (outcome === 'sent_onepager' ? 'one-pager' : 'Pulse card') + '?',
      account_id: accountId,
      contact_id: contactId,
      scheduled_at: followUp.toISOString(),
    });
  }

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
