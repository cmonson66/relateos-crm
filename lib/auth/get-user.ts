import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export type UserRole = 'super_admin' | 'admin' | 'manager' | 'rep';

export type Profile = {
  id: string;
  org_id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  manager_id: string | null;
  is_active: boolean;
  avatar_url: string | null;
};

export async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !profile) {
    redirect('/login');
  }

  return { user, profile: profile as Profile };
}
