import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-background">
      <div className="card-lit border border-border/40 rounded-md p-10 max-w-md text-center relative">
        <div className="h-[3px] bg-primary glow-stripe rounded-t-md absolute inset-x-0 top-0" />
        <div className="font-display text-7xl tracking-wider text-primary text-glow-primary mb-3">404</div>
        <h2 className="font-display text-2xl tracking-wider mb-3">NOT FOUND</h2>
        <p className="text-sm text-muted-foreground mb-6">
          The page you\'re looking for doesn\'t exist or has been moved.
        </p>
        <Link href="/dashboard">
          <Button className="font-display tracking-wider btn-glow">GO TO DASHBOARD</Button>
        </Link>
      </div>
    </div>
  );
}
