'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

async function authed() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  return supabase;
}

// Move an appointment (drag-and-drop or the edit panel). The label suffix
// in the subject is rewritten so timelines don't show stale times.
export async function rescheduleActivity(id: string, iso: string, label: string) {
  const supabase = await authed();
  const { data: row } = await supabase.from('activities').select('subject').eq('id', id).single();
  const base = (row?.subject ?? '').split(' - ')[0] || 'Appointment';
  const { error } = await supabase
    .from('activities')
    .update({ scheduled_at: iso, subject: `${base} - ${label}` })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/calendar');
}

export async function markActivityDone(id: string) {
  const supabase = await authed();
  const { error } = await supabase
    .from('activities')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/calendar');
}

export async function cancelActivity(id: string) {
  const supabase = await authed();
  const { error } = await supabase.from('activities').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/calendar');
}
