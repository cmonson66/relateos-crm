'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

export function RecordTabs({
  activityNode,
  commentsNode,
  commentsCount,
}: {
  activityNode: React.ReactNode;
  commentsNode: React.ReactNode;
  commentsCount: number;
}) {
  const [tab, setTab] = useState<'activity' | 'comments'>('activity');

  return (
    <div className="card-lit border border-border/40 rounded-md relative">
      <div className="h-[2px] bg-card-foreground/10 rounded-t-md absolute inset-x-0 top-0" />
      <div className="flex border-b border-border/30">
        <TabButton active={tab === 'activity'} onClick={() => setTab('activity')}>
          Activity
        </TabButton>
        <TabButton active={tab === 'comments'} onClick={() => setTab('comments')}>
          Comments
          {commentsCount > 0 && (
            <span className={cn(
              'ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-mono tabular-nums',
              tab === 'comments' ? 'bg-primary text-primary-foreground' : 'bg-muted/40 text-muted-foreground'
            )}>
              {commentsCount}
            </span>
          )}
        </TabButton>
      </div>
      <div className="p-5 md:p-6">
        {tab === 'activity' ? activityNode : commentsNode}
      </div>
    </div>
  );
}

function TabButton({
  active, onClick, children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-5 md:px-6 py-3.5 font-display tracking-wider text-sm uppercase transition-colors relative inline-flex items-center min-h-[44px]',
        active
          ? 'text-foreground'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {children}
      {active && (
        <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary glow-stripe-soft" />
      )}
    </button>
  );
}
