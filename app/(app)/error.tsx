'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8">
      <div className="card-lit border border-destructive/30 rounded-md p-8 max-w-md text-center relative">
        <div className="h-[3px] bg-destructive rounded-t-md absolute inset-x-0 top-0" />
        <div className="w-12 h-12 rounded-full bg-destructive/15 text-destructive flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="font-display text-2xl tracking-wider mb-2">SOMETHING BROKE</h2>
        <p className="text-sm text-muted-foreground mb-2">
          {error.message || 'An unexpected error occurred.'}
        </p>
        {error.digest && (
          <p className="text-[10px] text-muted-foreground/60 font-mono mb-5">ref · {error.digest}</p>
        )}
        <div className="flex items-center justify-center gap-2">
          <Button onClick={reset} className="font-display tracking-wider btn-glow">
            TRY AGAIN
          </Button>
          <Button onClick={() => window.location.href = '/dashboard'} variant="outline" className="font-display tracking-wider">
            GO HOME
          </Button>
        </div>
      </div>
    </div>
  );
}
