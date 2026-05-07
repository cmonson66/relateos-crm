'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { CheckCircle2, EyeOff, LockKeyhole, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRelative } from '@/lib/utils/format';
import { setLockStatus } from '../actions';

type Org = {
  id: string;
  name: string;
  lock_status: 'active' | 'read_only' | 'locked';
  lock_message: string | null;
  locked_at: string | null;
  locked_by: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  read_only: 'Read-only',
  locked: 'Locked',
};

const DEFAULT_LOCK_MESSAGE =
  'This workspace has been temporarily suspended pending account resolution. Please contact your administrator.';

export function LockControl({
  org,
  counts,
}: {
  org: Org;
  counts: {
    totalUsers: number;
    activeUsers: number;
    accounts: number;
    contacts: number;
    deals: number;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState<'active' | 'read_only' | 'locked'>(org.lock_status);
  const [message, setMessage] = useState(org.lock_message || DEFAULT_LOCK_MESSAGE);
  const [confirmText, setConfirmText] = useState('');

  const dirty = target !== org.lock_status || (target !== 'active' && message !== (org.lock_message || ''));
  const escalating = (org.lock_status === 'active' && target !== 'active') ||
                     (org.lock_status === 'read_only' && target === 'locked');
  const requireConfirm = escalating;
  const confirmOk = !requireConfirm || confirmText.trim().toUpperCase() === 'CONFIRM';

  function apply() {
    startTransition(async () => {
      try {
        await setLockStatus({
          status: target,
          message: target === 'active' ? undefined : message,
        });
        const verb = target === 'active' ? 'restored' : target === 'read_only' ? 'set to read-only' : 'locked';
        toast.success(`Workspace ${verb}.`);
        setConfirmText('');
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed');
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-md p-3 text-xs text-amber-100/80">
        <strong className="text-amber-100">Heads up:</strong> changing this field updates the database column but does NOT enforce anything yet. Lock-mode UI enforcement ships in the next step. For now, this lets you preview the state without affecting users.
      </div>

      <div className={cn(
        'card-lit border rounded-md p-5 md:p-6 relative',
        org.lock_status === 'active' && 'border-emerald-500/30',
        org.lock_status === 'read_only' && 'border-amber-500/30',
        org.lock_status === 'locked' && 'border-destructive/30'
      )}>
        <div className={cn(
          'h-[3px] rounded-t-md absolute inset-x-0 top-0',
          org.lock_status === 'active' && 'bg-emerald-500/80',
          org.lock_status === 'read_only' && 'bg-amber-500/80',
          org.lock_status === 'locked' && 'bg-destructive/80'
        )} />
        <div className="flex items-start gap-4">
          <div className={cn(
            'w-10 h-10 rounded-md flex items-center justify-center shrink-0',
            org.lock_status === 'active' && 'bg-emerald-500/15 text-emerald-400',
            org.lock_status === 'read_only' && 'bg-amber-500/15 text-amber-400',
            org.lock_status === 'locked' && 'bg-destructive/15 text-destructive'
          )}>
            {org.lock_status === 'active' && <CheckCircle2 className="h-5 w-5" />}
            {org.lock_status === 'read_only' && <EyeOff className="h-5 w-5" />}
            {org.lock_status === 'locked' && <LockKeyhole className="h-5 w-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">Current status</div>
            <h2 className="font-display text-2xl md:text-3xl tracking-wider mb-2">
              {STATUS_LABEL[org.lock_status].toUpperCase()}
            </h2>
            {org.lock_status !== 'active' ? (
              <>
                <p className="text-sm text-muted-foreground mb-1">{org.lock_message || 'No message set.'}</p>
                <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70">
                  Set {formatRelative(org.locked_at)}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">All users have full access.</p>
            )}
          </div>
        </div>
      </div>

      <div className="card-lit border border-border/40 rounded-md p-5 md:p-6 relative">
        <div className="h-[2px] bg-card-foreground/10 rounded-t-md absolute inset-x-0 top-0" />
        <h3 className="font-display text-sm tracking-wider mb-3">WHAT GETS AFFECTED</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
          <Stat label="Active users" value={counts.activeUsers} />
          <Stat label="All users" value={counts.totalUsers} />
          <Stat label="Accounts" value={counts.accounts} />
          <Stat label="Contacts" value={counts.contacts} />
          <Stat label="Deals" value={counts.deals} />
        </div>
        <p className="text-xs text-muted-foreground mt-4">You (super_admin) retain full access regardless of lock status.</p>
      </div>

      <div className="card-lit border border-border/40 rounded-md p-5 md:p-6 relative">
        <div className="h-[2px] bg-card-foreground/10 rounded-t-md absolute inset-x-0 top-0" />
        <h3 className="font-display text-sm tracking-wider mb-4">CHANGE STATUS</h3>

        <div className="space-y-2 mb-5">
          <StatusOption
            id="active" current={target} onSelect={setTarget}
            title="Active"
            description="Normal operation. All users have full access."
            tone="emerald"
          />
          <StatusOption
            id="read_only" current={target} onSelect={setTarget}
            title="Read-only"
            description="(UI enforcement ships in next step.) For now, just sets the DB flag."
            tone="amber"
          />
          <StatusOption
            id="locked" current={target} onSelect={setTarget}
            title="Locked"
            description="(UI enforcement ships in next step.) For now, just sets the DB flag."
            tone="red"
          />
        </div>

        {target !== 'active' && (
          <div className="space-y-2 mb-5">
            <Label htmlFor="lock-message" className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              Message (will display once enforcement is shipped)
            </Label>
            <Textarea
              id="lock-message" value={message} onChange={e => setMessage(e.target.value)}
              rows={3} placeholder={DEFAULT_LOCK_MESSAGE}
            />
          </div>
        )}

        {requireConfirm && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-3 mb-5 flex gap-3 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-2 flex-1">
              <div className="text-muted-foreground">
                Type <strong className="text-foreground font-mono">CONFIRM</strong> to proceed.
              </div>
              <input
                value={confirmText} onChange={e => setConfirmText(e.target.value)}
                placeholder="CONFIRM" autoComplete="off"
                className="w-full px-2 py-1 rounded-md border border-border/40 bg-input/50 text-sm focus:outline-none focus:ring-2 focus:ring-ring/60"
              />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline"
            onClick={() => { setTarget(org.lock_status); setConfirmText(''); }}
            disabled={!dirty || pending}
          >Reset</Button>
          <Button type="button" onClick={apply}
            disabled={!dirty || !confirmOk || pending}
            className="font-display tracking-wider btn-glow"
            variant={target === 'locked' ? 'destructive' : 'default'}
          >
            {pending ? 'APPLYING…' : target === 'active' ? 'RESTORE ACCESS' : `APPLY ${STATUS_LABEL[target].toUpperCase()}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-1">{label}</div>
      <div className="font-display text-xl md:text-2xl tracking-wider tabular-nums">{value}</div>
    </div>
  );
}

function StatusOption({
  id, current, onSelect, title, description, tone,
}: {
  id: 'active' | 'read_only' | 'locked';
  current: 'active' | 'read_only' | 'locked';
  onSelect: (v: 'active' | 'read_only' | 'locked') => void;
  title: string;
  description: string;
  tone: 'emerald' | 'amber' | 'red';
}) {
  const selected = current === id;
  return (
    <button type="button" onClick={() => onSelect(id)}
      className={cn(
        'w-full text-left p-3 rounded-md border transition-colors',
        selected
          ? tone === 'emerald' ? 'border-emerald-500/50 bg-emerald-500/5'
            : tone === 'amber' ? 'border-amber-500/50 bg-amber-500/5'
            : 'border-destructive/50 bg-destructive/5'
          : 'border-border/40 bg-background/30 hover:border-border/70'
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          'w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center',
          selected
            ? tone === 'emerald' ? 'border-emerald-400'
              : tone === 'amber' ? 'border-amber-400'
              : 'border-destructive'
            : 'border-muted-foreground/40'
        )}>
          {selected && (
            <div className={cn(
              'w-2 h-2 rounded-full',
              tone === 'emerald' && 'bg-emerald-400',
              tone === 'amber' && 'bg-amber-400',
              tone === 'red' && 'bg-destructive'
            )} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm">{title}</div>
          <div className="text-xs text-muted-foreground mt-1">{description}</div>
        </div>
      </div>
    </button>
  );
}
