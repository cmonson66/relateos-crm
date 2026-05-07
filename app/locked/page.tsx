import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { LockKeyhole } from 'lucide-react';
import { signOutFromLocked } from './actions';

export default async function LockedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Not signed in -> /login (not /locked)
  if (!user) redirect('/login');

  // Look up profile + org lock state
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, org_id')
    .eq('id', user.id)
    .single();

  if (!profile) redirect('/login');

  // super_admin should never be on this page
  if (profile.role === 'super_admin') redirect('/dashboard');

  // Check current lock status
  const { data: org } = await supabase
    .from('organizations')
    .select('lock_status, lock_message')
    .eq('id', profile.org_id)
    .single();

  // If org is no longer locked, send user to dashboard
  if (!org || org.lock_status !== 'locked') {
    redirect('/dashboard');
  }

  return (
    <div className="card-lit border border-border/40 rounded-md p-8 md:p-10 max-w-lg w-full relative text-center">
      <div className="h-[3px] bg-destructive rounded-t-md absolute inset-x-0 top-0" />

      <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-destructive/15 text-destructive flex items-center justify-center">
        <LockKeyhole className="h-6 w-6" />
      </div>

      <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-2">
        Workspace suspended
      </div>
      <h1 className="font-display text-3xl md:text-4xl tracking-wider leading-none mb-4">
        ACCESS{' '}
        <span className="text-destructive">PAUSED</span>
      </h1>

      <p className="text-sm text-muted-foreground mb-2 max-w-md mx-auto">
        {org.lock_message ||
          'This workspace has been temporarily suspended pending account resolution. Please contact your administrator.'}
      </p>
      <p className="text-xs text-muted-foreground/70 mb-6 max-w-md mx-auto">
        Your data has been preserved and will be available when access resumes.
      </p>

      <form action={signOutFromLocked}>
        <Button type="submit" variant="outline" className="font-display tracking-wider">
          Sign out
        </Button>
      </form>
    </div>
  );
}
