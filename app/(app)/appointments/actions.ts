'use server';

import { logActivity } from '@/app/(app)/activities/actions';

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
