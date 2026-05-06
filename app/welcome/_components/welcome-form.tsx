'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { setInitialPassword } from '../actions';

export function WelcomeForm({
  email,
  firstName,
  role,
}: {
  email: string;
  firstName: string;
  role: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);

  // Live validation
  const lengthOk = password.length >= 10;
  const matchOk = password.length > 0 && password === confirm;
  const canSubmit = lengthOk && matchOk && !pending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    startTransition(async () => {
      try {
        await setInitialPassword(password);
        toast.success('Password set. Welcome aboard.');
        router.push('/dashboard');
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to set password');
      }
    });
  }

  const roleLabel = role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());

  return (
    <div className="card-lit border border-border/40 rounded-md p-6 md:p-8 max-w-md w-full relative">
      <div className="h-[3px] bg-primary glow-stripe rounded-t-md absolute inset-x-0 top-0" />

      <div className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-2">
          New account · {roleLabel}
        </div>
        <h1 className="font-display text-3xl md:text-4xl tracking-wider leading-none mb-2">
          WELCOME{firstName ? `, ` : ''}
          {firstName && <span className="text-primary text-glow-primary">{firstName.toUpperCase()}</span>}
        </h1>
        <p className="text-sm text-muted-foreground">
          You\'re signed in as <span className="text-foreground font-medium">{email}</span>. Set a password
          so you can log back in next time.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="pw" className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            New password
          </Label>
          <div className="relative">
            <Input
              id="pw"
              type={show ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
              autoComplete="new-password"
              placeholder="At least 10 characters"
              required
            />
            <button
              type="button"
              onClick={() => setShow(s => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
              aria-label={show ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm" className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            Confirm password
          </Label>
          <Input
            id="confirm"
            type={show ? 'text' : 'password'}
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            autoComplete="new-password"
            placeholder="Type it again"
            required
          />
        </div>

        <ul className="space-y-1.5 py-2">
          <Check item="At least 10 characters" ok={lengthOk} />
          <Check item="Passwords match" ok={matchOk} />
        </ul>

        <Button
          type="submit"
          disabled={!canSubmit}
          className="w-full font-display tracking-wider btn-glow"
        >
          {pending ? 'SETTING PASSWORD…' : 'SET PASSWORD & CONTINUE'}
        </Button>

        <p className="text-[11px] text-muted-foreground text-center pt-2">
          Use a password manager. The next time you sign in, you\'ll use {email} and this password.
        </p>
      </form>
    </div>
  );
}

function Check({ item, ok }: { item: string; ok: boolean }) {
  return (
    <li className={`flex items-center gap-2 text-xs ${ok ? 'text-emerald-400' : 'text-muted-foreground'}`}>
      <CheckCircle2 className={`h-3 w-3 ${ok ? '' : 'opacity-30'}`} />
      {item}
    </li>
  );
}
