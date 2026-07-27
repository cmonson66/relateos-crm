import { verticalColor, verticalLabel } from '@/lib/verticals';
import { cn } from '@/lib/utils';

export function VerticalBadge({ vertical, className }: { vertical: string; className?: string }) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] uppercase tracking-[0.1em] font-medium',
      verticalColor(vertical),
      className
    )}>
      {verticalLabel(vertical)}
    </span>
  );
}
