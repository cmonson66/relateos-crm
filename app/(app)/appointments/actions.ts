'use server';

import { logActivity } from '@/app/(app)/activities/actions';
import { advanceDealTo } from '@/app/(app)/deals/automation';

export type ApptKind = 'demo' | 'install' | 'followup' | 'callback';

const KIND_META: Record<ApptKind, { type: 'meeting' | 'task'; label: string }> = {
  demo: { type: 'meeting', label: 'Demo visit' },
  install: { type: 'meeting', label: 'Install' },
  followup: { type: 'meeting', label: 'Follow-up visit' },
  callback: { type: 'task', label: 'Callback' },
};

export async function createAppointment(input: {
  accountId: string;
  contactId: string | null;
  kind: ApptKind;
  scheduledAt: string;
  scheduleLabel: string;
  note: string;
}) {
  const meta = KIND_META[input.kind];
  // Pipeline automation: demo appointments -> Demo booked, installs -> Install scheduled
  if (input.kind === 'demo') await advanceDealTo(input.accountId, 'demo-booked');
  if (input.kind === 'install') await advanceDealTo(input.accountId, 'install-scheduled');
  await logActivity({
    type: meta.type,
    subject: `${meta.label} - ${input.scheduleLabel}`,
    body: input.note.trim() || null,
    account_id: input.accountId,
    contact_id: input.contactId,
    scheduled_at: input.scheduledAt,
  });
  return { ok: true };
}

// Calendar-first booking: find the account by name
export async function searchAccounts(q: string) {
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  if (!q || q.trim().length < 2) return [];
  const { data } = await supabase
    .from('accounts')
    .select('id, name, city')
    .ilike('name', `%${q.trim()}%`)
    .order('name')
    .limit(8);
  return data ?? [];
}

// A customer wandered in and the visit already happened - log it done, now
export async function logWalkIn(input: { accountId: string; contactId: string | null; note: string }) {
  await logActivity({
    type: 'meeting',
    subject: 'Walk-in visit',
    body: input.note.trim() || null,
    account_id: input.accountId,
    contact_id: input.contactId,
    completed_at: new Date().toISOString(),
  });
  return { ok: true };
}
