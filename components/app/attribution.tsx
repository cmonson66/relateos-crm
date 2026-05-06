import { formatRelative } from '@/lib/utils/format';
import { cn } from '@/lib/utils';

export function Attribution({
  actorName,
  action,
  timestamp,
  className,
}: {
  actorName: string | null | undefined;
  action: string;
  timestamp: string | Date | null;
  className?: string;
}) {
  return (
    <span className={cn('text-xs text-muted-foreground', className)}>
      <span className="text-foreground/80 font-medium">{actorName || 'Someone'}</span>
      {' '}{action}{' · '}
      <span>{formatRelative(timestamp)}</span>
    </span>
  );
}
