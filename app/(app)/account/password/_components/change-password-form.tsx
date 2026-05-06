'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { changePassword } from '../actions';

export function ChangePasswordForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);

  const lengthOk = password.length >= 10;
  const matchOk = password.length > 0 && password === confirm;
  const canSubmit = lengthOk && matchOk && !pending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    startTransition(async () => {
      try {
        await changePassword(password);
        toast.success('Password updated');
        setPassword('');
        setConfirm('');
        router.push('/dashboard');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card-lit border border-border/40 rounded-md p-6 space-y-5 relative">
      <div className="h-[3px] bg-primary glow-stripe rounded-t-md absolute inset-x-0 top-0" />

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

      <ul className="space-y-1.5">
        <li className={`flex items-center gap-2 text-xs ${lengthOk ? 'text-emerald-400' : 'text-muted-foreground'}`}>
          <CheckCircle2 className={`h-3 w-3 ${lengthOk ? '' : 'opacity-30'}`} />
          At least 10 characters
        </li>
        <li className={`flex items-center gap-2 text-xs ${matchOk ? 'text-emerald-400' : 'text-muted-foreground'}`}>
          <CheckCircle2 className={`h-3 w-3 ${matchOk ? '' : 'opacity-30'}`} />
          Passwords match
        </li>
      </ul>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={!canSubmit} className="font-display tracking-wider btn-glow">
          {pending ? 'UPDATING…' : 'UPDATE PASSWORD'}
        </Button>
      </div>
    </form>
  );
}
