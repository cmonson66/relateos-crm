'use server';

import { createClient } from '@/lib/supabase/server';
import { logActivity } from '@/app/(app)/activities/actions';
import { advanceDealTo } from '@/app/(app)/deals/automation';
import { completePlanItem } from '@/lib/planner/complete';
import { DEFAULT_TZ, type TimeZone } from '@/lib/db/tz';

export type CallOutcome =
  | 'booked'
  | 'sent_onepager'
  | 'sent_pulse'
  | 'callback'
  | 'no_answer'
  | 'voicemail'
  | 'not_interested'
  | 'dnc';

const OUTCOME_LABEL: Record<CallOutcome, string> = {
  booked: 'Call: booked walk-in visit',
  sent_onepager: 'Call: sent one-pager',
  sent_pulse: 'Call: sent Pulse link',
  callback: 'Call: callback requested',
  no_answer: 'Call: no answer',
  voicemail: 'Call: left a voicemail',
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

  // A voicemail is a promise you made to yourself. Two business days is the
  // window where calling back still reads as following up rather than
  // pestering, and where they might still remember the message.
  if (outcome === 'voicemail') {
    const followUp = new Date(Date.now() + 2 * 86400000);
    // Saturday and Sunday are not call days.
    while (followUp.getUTCDay() === 0 || followUp.getUTCDay() === 6) {
      followUp.setUTCDate(followUp.getUTCDate() + 1);
    }
    followUp.setUTCHours(16, 0, 0, 0); // ~9 AM Phoenix
    await logActivity({
      type: 'task',
      subject: 'Call back: left a voicemail',
      body: notes.trim() || null,
      account_id: accountId,
      contact_id: contactId,
      scheduled_at: followUp.toISOString(),
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

  // The plan tracks itself. A rep who ran the call should never also have to
  // go tick it off - and a "sent" outcome closes the send item too, since
  // Call Mode's send row is how that send usually happens.
  {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles').select('region_id').eq('id', user.id).maybeSingle();
      let tz: TimeZone = DEFAULT_TZ;
      if (profile?.region_id) {
        const { data: r } = await supabase
          .from('regions').select('timezone').eq('id', profile.region_id).maybeSingle();
        if (r?.timezone) tz = r.timezone as TimeZone;
      }
      await completePlanItem(supabase, {
        profileId: user.id, accountId, kind: 'call', outcome: OUTCOME_LABEL[outcome], tz,
      });
      if (outcome === 'sent_onepager' || outcome === 'sent_pulse') {
        await completePlanItem(supabase, {
          profileId: user.id, accountId, kind: 'send', outcome: OUTCOME_LABEL[outcome], tz,
        });
      }
    }
  }

  return { ok: true };
}
