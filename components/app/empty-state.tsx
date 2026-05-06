import { cn } from '@/lib/utils';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(
      'card-lit text-card-foreground rounded-md border border-border/40 relative px-8 py-16 text-center',
      className
    )}>
      <div className="h-[3px] bg-card-foreground/10 rounded-t-md absolute inset-x-0 top-0" />
      {Icon && (
        <Icon className="h-10 w-10 mx-auto mb-4 text-muted-foreground/60" />
      )}
      <h3 className="font-display text-2xl tracking-wider mb-2">{title.toUpperCase()}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">{description}</p>
      )}
      {action}
    </div>
  );
}
