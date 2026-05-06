'use client';

import { useState, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Phone, Mail, Calendar, FileText, CheckSquare, Check } from 'lucide-react';
import { FilterChips, type FilterChip } from '@/components/app/filter-chips';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatRelative } from '@/lib/utils/format';
import { completeActivity } from '../actions';
import { toast } from 'sonner';

const ICONS = { call: Phone, email: Mail, meeting: Calendar, note: FileText, task: CheckSquare };

type ActivityRow = {
  id: string;
  type: 'call' | 'email' | 'meeting' | 'note' | 'task';
  subject: string | null;
  body: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  created_at: string;
  owner_id: string;
  assigned_to: string | null;
  owner: { id: string; full_name: string | null; email: string } | null;
  assignee: { id: string; full_name: string | null; email: string } | null;
  account: { id: string; name: string } | null;
  contact: { id: string; first_name: string; last_name: string | null } | null;
  deal: { id: string; name: string } | null;
};

export function ActivitiesList({
  activities,
  currentUserId,
}: {
  activities: ActivityRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    let list = activities;
    if (filter === 'mine') {
      list = list.filter(a => a.owner_id === currentUserId || a.assigned_to === currentUserId);
    } else if (filter === 'open_tasks') {
      list = list.filter(a => a.type === 'task' && !a.completed_at);
    } else if (filter === 'upcoming') {
      list = list.filter(a => a.scheduled_at && !a.completed_at);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        a.subject?.toLowerCase().includes(q) ||
        a.body?.toLowerCase().includes(q) ||
        a.account?.name.toLowerCase().includes(q) ||
        a.deal?.name.toLowerCase().includes(q)
      );
    }
    return list;
  }, [activities, filter, search, currentUserId]);

  const chips: FilterChip[] = [
    { id: 'all', label: 'All', count: activities.length },
    { id: 'mine', label: 'Mine', count: activities.filter(a => a.owner_id === currentUserId || a.assigned_to === currentUserId).length },
    { id: 'open_tasks', label: 'Open tasks', count: activities.filter(a => a.type === 'task' && !a.completed_at).length },
    { id: 'upcoming', label: 'Upcoming', count: activities.filter(a => a.scheduled_at && !a.completed_at).length },
  ];

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
      <div className="flex items-center justify-between gap-4 mb-5">
        <FilterChips chips={chips} activeId={filter} onChange={setFilter} />
        <Input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
      </div>

      <div className="card-lit border border-border/40 rounded-md overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            No activities match these filters.
          </div>
        ) : filtered.map(a => {
          const Icon = ICONS[a.type];
          const actorName = a.owner?.full_name || a.owner?.email?.split('@')[0] || 'Someone';
          const isOpenTask = a.type === 'task' && !a.completed_at;
          const upcoming = a.scheduled_at && !a.completed_at;
          const timestamp = a.completed_at || a.scheduled_at || a.created_at;

          return (
            <div
              key={a.id}
              className={cn(
                'flex items-start gap-4 px-5 py-4 border-b border-border/20 last:border-0',
                upcoming && 'bg-primary/5',
                isOpenTask && 'border-l-2 border-l-primary'
              )}
            >
              <div className={cn(
                'w-9 h-9 rounded-md flex items-center justify-center shrink-0 mt-0.5',
                upcoming ? 'bg-primary/15 text-primary' : 'bg-muted/40 text-muted-foreground'
              )}>
                <Icon className="h-4 w-4" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <div className="text-xs">
                    <span className="font-medium">{actorName}</span>
                    <span className="text-muted-foreground"> · {a.type}</span>
                    {a.assignee && a.assigned_to !== a.owner_id && (
                      <>
                        <span className="text-muted-foreground"> → </span>
                        <span className="font-medium">{a.assignee.full_name || a.assignee.email.split('@')[0]}</span>
                      </>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                    {formatRelative(timestamp)}
                  </span>
                </div>

                {a.subject && <div className="text-sm font-medium mb-0.5">{a.subject}</div>}
                {a.body && <div className="text-sm text-muted-foreground line-clamp-2">{a.body}</div>}

                <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground/80">
                  {a.account && (
                    <Link href={`/accounts/${a.account.id}`} className="hover:text-primary">
                      {a.account.name}
                    </Link>
                  )}
                  {a.contact && (
                    <Link href={`/contacts/${a.contact.id}`} className="hover:text-primary">
                      {a.contact.first_name} {a.contact.last_name || ''}
                    </Link>
                  )}
                  {a.deal && (
                    <Link href={`/deals/${a.deal.id}`} className="hover:text-primary">
                      {a.deal.name}
                    </Link>
                  )}
                </div>
              </div>

              {isOpenTask && (
                <button
                  type="button"
                  onClick={() => handleComplete(a.id)}
                  className="shrink-0 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.15em] text-primary hover:text-primary/80 transition-colors mt-1"
                >
                  <Check className="h-3 w-3" /> Done
                </button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
