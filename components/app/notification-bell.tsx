'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Bell, AtSign, CheckSquare, TrendingUp, AlertCircle, Calendar } from 'lucide-react';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { formatRelative } from '@/lib/utils/format';
import { fetchNotifications, markNotificationRead, markAllNotificationsRead } from '@/app/(app)/notifications/actions';

type NotificationType = 'mention' | 'task_assigned' | 'system_alert' | 'activity_reminder' | 'deal_stage_change';

type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
  actor: { id: string; full_name: string | null; email: string } | { id: string; full_name: string | null; email: string }[] | null;
};

const TYPE_ICON: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  mention: AtSign,
  task_assigned: CheckSquare,
  deal_stage_change: TrendingUp,
  system_alert: AlertCircle,
  activity_reminder: Calendar,
};

export function NotificationBell() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Notification[]>([]);
  const [, startTransition] = useTransition();

  async function refresh() {
    const res = await fetchNotifications(15);
    setUnread(res.unread);
    setItems(res.items as unknown as Notification[]);
  }

  useEffect(() => {
    refresh();
  }, [pathname]);

  useEffect(() => {
    const interval = setInterval(refresh, 60_000);
    return () => clearInterval(interval);
  }, []);

  function handleClick(n: Notification) {
    startTransition(async () => {
      if (!n.read_at) {
        await markNotificationRead(n.id);
        setItems(prev => prev.map(x => x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x));
        setUnread(prev => Math.max(0, prev - 1));
      }
      setOpen(false);
      if (n.entity_type && n.entity_id) {
        const path =
          n.entity_type === 'account' ? `/accounts/${n.entity_id}` :
          n.entity_type === 'contact' ? `/contacts/${n.entity_id}` :
          n.entity_type === 'deal'    ? `/deals/${n.entity_id}` :
          n.entity_type === 'task'    ? `/activities` :
          '/dashboard';
        router.push(path);
      }
    });
  }

  function handleMarkAll() {
    startTransition(async () => {
      await markAllNotificationsRead();
      setItems(prev => prev.map(x => ({ ...x, read_at: x.read_at || new Date().toISOString() })));
      setUnread(0);
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="Notifications"
        suppressHydrationWarning
        className="relative h-10 w-10 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors focus:outline-none focus:ring-2 focus:ring-ring/60"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 bg-primary rounded-full hud-pulse text-[9px] font-bold text-primary-foreground flex items-center justify-center tabular-nums">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
          <h3 className="font-display text-sm tracking-wider">NOTIFICATIONS</h3>
          {unread > 0 && (
            <button
              onClick={handleMarkAll}
              className="text-[10px] uppercase tracking-[0.15em] text-primary hover:text-primary/80"
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground italic">
              You\'re all caught up.
            </div>
          ) : items.map(n => {
            const Icon = TYPE_ICON[n.type] || Bell;
            const isUnread = !n.read_at;
            const actor = Array.isArray(n.actor) ? n.actor[0] : n.actor;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => handleClick(n)}
                className={cn(
                  'w-full flex items-start gap-3 px-4 py-3 border-b border-border/20 last:border-0 transition-colors text-left min-h-[60px]',
                  isUnread ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/30'
                )}
              >
                <div className={cn(
                  'w-8 h-8 rounded-md flex items-center justify-center shrink-0 mt-0.5',
                  isUnread ? 'bg-primary/15 text-primary' : 'bg-muted/40 text-muted-foreground'
                )}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium leading-tight">{n.title}</div>
                  {n.body && (
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.body}</div>
                  )}
                  <div className="text-[10px] text-muted-foreground/70 mt-1.5 tabular-nums">
                    {formatRelative(n.created_at)}
                  </div>
                </div>
                {isUnread && (
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-2" />
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
