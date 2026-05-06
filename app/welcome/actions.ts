'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function setInitialPassword(newPassword: string) {
  if (!newPassword || newPassword.length < 10) {
    throw new Error('Password must be at least 10 characters');
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Set the auth password
  const { error: pwError } = await supabase.auth.updateUser({ password: newPassword });
  if (pwError) throw new Error(pwError.message);

  // Mark profile as having set a password
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ password_set_at: new Date().toISOString() })
    .eq('id', user.id);

  if (profileError) throw new Error(profileError.message);

  revalidatePath('/');
}
