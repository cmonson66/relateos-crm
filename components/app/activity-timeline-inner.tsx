'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, Mail, Calendar, FileText, CheckSquare, Check, GitCommit } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRelative } from '@/lib/utils/format';
import { completeActivity } from '@/app/(app)/activities/actions';
import type { ActivityWithRefs } from '@/lib/db/activities';
import { toast } from 'sonner';

const ICONS = {
  call:    Phone,
  email:   Mail,
  meeting: Calendar,
  note:    FileText,
  task:    CheckSquare,
};

type AuditEntry = {
  id: string;
  action: string;
  changes: Record<string, unknown> | null;
  created_at: string;
  actor: { id: string; full_name: string | null; email: string } | { id: string; full_name: string | null; email: string }[] | null;
};

type TimelineItem =
  | { kind: 'activity'; data: ActivityWithRefs; ts: string }
  | { kind: 'audit'; data: AuditEntry; ts: string };

export function ActivityTimelineInner({
  activities,
  auditEntries = [],
}: {
  activities: ActivityWithRefs[];
  auditEntries?: AuditEntry[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!activities.length && !auditEntries.length) {
    return <p className="text-sm text-muted-foreground italic py-2">No activity yet. Log a call, note, or schedule a task above.</p>;
  }

  const upcoming = activities.filter(a => a.scheduled_at && !a.completed_at);
  const completedActivities = activities.filter(a => !a.scheduled_at || a.completed_at);
  const items: TimelineItem[] = [
    ...completedActivities.map<TimelineItem>(a => ({
      kind: 'activity', data: a, ts: a.completed_at || a.created_at,
    })),
    ...auditEntries.map<TimelineItem>(e => ({
      kind: 'audit', data: e, ts: e.created_at,
    })),
  ].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  function handleComplete(id: string) {
    startTransition(async () => {
      try {
        await completeActivity(id);
        toast.success('Marked complete');
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed');
      }
    });
  }

  return (
    <>
      {upcoming.length > 0 && (
        <>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">
            Upcoming · {upcoming.length}
          </div>
          <div className="space-y-3 mb-6">
            {upcoming.map(a => (
              <ActivityRow
                key={a.id}
                activity={a}
                onComplete={() => handleComplete(a.id)}
                pending={pending}
                upcoming
              />
            ))}
          </div>
          <div className="border-t border-border/30 my-5" />
        </>
      )}

      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">
        History · {items.length}
      </div>
      <div className="space-y-3">
        {items.map(item =>
          item.kind === 'activity' ? (
            <ActivityRow
              key={`a-${item.data.id}`}
              activity={item.data}
              onComplete={() => handleComplete(item.data.id)}
              pending={pending}
            />
          ) : (
            <AuditRow key={`e-${item.data.id}`} entry={item.data} />
          )
        )}
      </div>
    </>
  );
}

function ActivityRow({
  activity, onComplete, pending, upcoming,
}: {
  activity: ActivityWithRefs;
  onComplete: () => void;
  pending: boolean;
  upcoming?: boolean;
}) {
  const Icon = ICONS[activity.type];
  const actor = activity.owner;
  const actorName = actor?.full_name || actor?.email?.split('@')[0] || 'Someone';
  const verb = {
    call: 'logged a call',
    email: 'sent an email',
    meeting: 'had a meeting',
    note: 'added a note',
    task: activity.assigned_to && activity.assigned_to !== activity.owner_id ? 'assigned a task' : 'created a task',
  }[activity.type];

  const timestamp = activity.completed_at || activity.scheduled_at || activity.created_at;
  const isTaskAssignedToOther = activity.type === 'task' && activity.assigned_to && activity.assigned_to !== activity.owner_id;

  return (
    <div className={cn(
      'flex items-start gap-3 p-3 rounded-md border transition-colors',
      upcoming ? 'border-primary/30 bg-primary/5' : 'border-border/30 bg-background/30 hover:bg-background/50'
    )}>
      <div className={cn(
        'w-8 h-8 rounded-md flex items-center justify-center shrink-0',
        upcoming ? 'bg-primary/15 text-primary' : 'bg-muted/40 text-muted-foreground'
      )}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-3 mb-1">
          <div className="text-xs">
            <span className="font-medium text-foreground">{actorName}</span>
            <span className="text-muted-foreground"> {verb}</span>
            {isTaskAssignedToOther && activity.assignee && (
              <>
                <span className="text-muted-foreground"> to </span>
                <span className="font-medium text-foreground">
                  {activity.assignee.full_name || activity.assignee.email.split('@')[0]}
                </span>
              </>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
            {formatRelative(timestamp)}
          </span>
        </div>
        {activity.subject && <div className="text-sm font-medium mb-0.5">{activity.subject}</div>}
        {activity.body && <div className="text-sm text-muted-foreground whitespace-pre-wrap">{activity.body}</div>}
        {upcoming && (
          <button type="button" onClick={onComplete} disabled={pending}
            className="mt-2 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] text-primary hover:text-primary/80 transition-colors min-h-[28px]"
          >
            <Check className="h-3 w-3" /> Mark complete
          </button>
        )}
      </div>
    </div>
  );
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const actor = Array.isArray(entry.actor) ? entry.actor[0] : entry.actor;
  const actorName = actor?.full_name || actor?.email?.split('@')[0] || 'System';
  let description: React.ReactNode;
  switch (entry.action) {
    case 'created':       description = 'created this record'; break;
    case 'updated':       description = 'updated this record'; break;
    case 'imported':      description = 'imported this record'; break;
    case 'stage_changed': {
      const c = entry.changes as { stage?: { from: string; to: string } } | null;
      const stage = c?.stage;
      description = stage ? (
        <>moved stage from <span className="text-foreground/80">{stage.from}</span> to <span className="text-foreground/80">{stage.to}</span></>
      ) : 'changed stage';
      break;
    }
    case 'assigned':      description = 'changed assignment'; break;
    case 'deleted':       description = 'deleted this record'; break;
    default:              description = entry.action;
  }
  return (
    <div className="flex items-start gap-3 px-3 py-2 text-xs text-muted-foreground/70">
      <div className="w-8 h-8 flex items-center justify-center shrink-0">
        <GitCommit className="h-3 w-3" />
      </div>
      <div className="flex-1 min-w-0 pt-1.5">
        <span className="font-medium text-foreground/70">{actorName}</span>
        <span> {description}</span>
        <span className="ml-2 text-muted-foreground/60 tabular-nums">{formatRelative(entry.created_at)}</span>
      </div>
    </div>
  );
}
