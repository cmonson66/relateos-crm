'use server';

import { createClient } from '@/lib/supabase/server';

export async function changePassword(newPassword: string) {
  if (!newPassword || newPassword.length < 10) {
    throw new Error('Password must be at least 10 characters');
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);

  // Make sure the marker is set (it should already be from the welcome flow,
  // but if the user originally signed up with a password we set it now)
  await supabase
    .from('profiles')
    .update({ password_set_at: new Date().toISOString() })
    .eq('id', user.id);
}
