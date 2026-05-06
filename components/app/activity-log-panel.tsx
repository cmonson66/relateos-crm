'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, Mail, Calendar, FileText, CheckSquare, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { logActivity } from '@/app/(app)/activities/actions';

type ActivityType = 'call' | 'email' | 'meeting' | 'note' | 'task';

const TYPE_OPTIONS: { id: ActivityType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'call',    label: 'Call',    icon: Phone },
  { id: 'email',   label: 'Email',   icon: Mail },
  { id: 'meeting', label: 'Meeting', icon: Calendar },
  { id: 'note',    label: 'Note',    icon: FileText },
  { id: 'task',    label: 'Task',    icon: CheckSquare },
];

export function ActivityLogPanel({
  scope,
  profiles,
}: {
  scope: {
    accountId?: string | null;
    contactId?: string | null;
    dealId?: string | null;
  };
  profiles: { id: string; full_name: string | null; email: string }[];
}) {
  const router = useRouter();
  const [type, setType] = useState<ActivityType>('note');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [scheduleLater, setScheduleLater] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [pending, startTransition] = useTransition();

  function reset() {
    setSubject('');
    setBody('');
    setScheduleLater(false);
    setScheduledAt('');
    setAssignedTo('');
  }

  const assignedToLabel = (() => {
    if (!assignedTo) return '— Me —';
    const p = profiles.find(x => x.id === assignedTo);
    return p ? (p.full_name || p.email) : '— Me —';
  })();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() && !subject.trim()) {
      toast.error('Add a note or subject');
      return;
    }
    if (scheduleLater && !scheduledAt) {
      toast.error('Pick a date/time to schedule');
      return;
    }

    startTransition(async () => {
      try {
        await logActivity({
          type,
          subject: subject.trim() || null,
          body: body.trim() || null,
          account_id: scope.accountId || null,
          contact_id: scope.contactId || null,
          deal_id: scope.dealId || null,
          scheduled_at: scheduleLater ? new Date(scheduledAt).toISOString() : null,
          assigned_to: type === 'task' && assignedTo ? assignedTo : null,
        });
        toast.success(scheduleLater ? 'Scheduled' : 'Logged');
        reset();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to save');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card-lit border border-border/40 rounded-md p-5 relative">
      <div className="h-[3px] bg-primary glow-stripe rounded-t-md absolute inset-x-0 top-0" />

      <div className="flex items-center gap-1.5 mb-4 overflow-x-auto">
        {TYPE_OPTIONS.map(opt => {
          const Icon = opt.icon;
          const active = type === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setType(opt.id)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs uppercase tracking-[0.12em] transition-all',
                active
                  ? 'bg-primary text-primary-foreground border-primary glow-stripe-soft font-medium'
                  : 'bg-card/50 text-muted-foreground border-border/40 hover:bg-card hover:text-foreground'
              )}
            >
              <Icon className="h-3 w-3" />
              {opt.label}
            </button>
          );
        })}
      </div>

      <Input
        value={subject}
        onChange={e => setSubject(e.target.value)}
        placeholder="Subject (optional)"
        className="mb-2"
      />
      <Textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder={
          type === 'note' ? 'What did you want to remember?' :
          type === 'call' ? 'What was discussed?' :
          type === 'email' ? 'Email summary or content...' :
          type === 'meeting' ? 'Meeting notes...' :
          'Task description...'
        }
        rows={3}
        className="mb-3"
      />

      {type === 'task' && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground shrink-0">Assign to</span>
          <Select value={assignedTo || 'me'} onValueChange={v => setAssignedTo(v === 'me' ? '' : v)}>
            <SelectTrigger className="h-8">
              <span>{assignedToLabel}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="me">— Me —</SelectItem>
              {profiles.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setScheduleLater(!scheduleLater)}
          className={cn(
            'inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] transition-colors',
            scheduleLater ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Clock className="h-3 w-3" />
          {scheduleLater ? 'Scheduling for later' : 'Log now'}
        </button>

        <div className="flex items-center gap-2">
          {scheduleLater && (
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
              className="h-9 w-auto text-xs"
            />
          )}
          <Button type="submit" disabled={pending} className="font-display tracking-wider btn-glow h-9">
            {pending ? '...' : scheduleLater ? 'SCHEDULE' : 'LOG'}
          </Button>
        </div>
      </div>
    </form>
  );
}
