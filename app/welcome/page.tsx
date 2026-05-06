import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { WelcomeForm } from './_components/welcome-form';

export default async function WelcomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Must be authenticated (came in via magic link)
  if (!user) redirect('/login');

  // If they already set a password, they don\'t belong here
  const { data: profile } = await supabase
    .from('profiles')
    .select('password_set_at, full_name, email, role')
    .eq('id', user.id)
    .single();

  if (profile?.password_set_at) {
    redirect('/dashboard');
  }

  const firstName = (profile?.full_name || profile?.email || '').split(' ')[0];

  return (
    <WelcomeForm
      email={profile?.email || user.email || ''}
      firstName={firstName}
      role={profile?.role || 'rep'}
    />
  );
}
