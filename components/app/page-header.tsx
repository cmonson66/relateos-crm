import { cn } from '@/lib/utils';

export function PageHeader({
  kicker,
  title,
  highlight,
  description,
  action,
  className,
}: {
  kicker?: string;
  title: string;
  highlight?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-8 flex items-end justify-between gap-6', className)}>
      <div className="min-w-0">
        {kicker && (
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-3">
            {kicker}
          </div>
        )}
        <h1 className="font-display text-4xl md:text-5xl tracking-wider leading-none">
          {title.toUpperCase()}{' '}
          {highlight && (
            <span className="text-primary text-glow-primary">{highlight.toUpperCase()}</span>
          )}
        </h1>
        {description && (
          <p className="text-muted-foreground mt-3 max-w-2xl text-sm">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
