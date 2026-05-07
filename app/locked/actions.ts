'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function signOutFromLocked() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
