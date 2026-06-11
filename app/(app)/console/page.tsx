import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/app/page-header';
import { formatRelative } from '@/lib/utils/format';
import { CheckCircle2, AlertCircle, Activity } from 'lucide-react';

export default async function ConsolePage() {
  const { profile } = await getUser();
  if (profile.role !== 'super_admin') redirect('/dashboard');

  const supabase = await createClient();
  const { data: runs } = await supabase
    .from('system_rule_runs')
    .select('*')
    .order('ran_at', { ascending: false })
    .limit(50);

  const list = runs || [];

  // Group by rule for the summary at top
  const byRule = new Map<string, { lastRun: string; ok: boolean; created: number; total: number; failed: number }>();
  list.forEach(r => {
    const existing = byRule.get(r.rule_name);
    if (!existing) {
      byRule.set(r.rule_name, {
        lastRun: r.ran_at, ok: r.ok, created: r.notifications_created || 0,
        total: 1, failed: r.ok ? 0 : 1,
      });
    } else {
      existing.total++;
      if (!r.ok) existing.failed++;
      existing.created += r.notifications_created || 0;
    }
  });

  return (
    <div className="p-4 md:p-8 max-w-[1400px]">
      <PageHeader
        kicker="Super admin console"
        title="System"
        highlight="Health"
        description="Cron job results, rule firings, and system diagnostics."
      />

      {byRule.size === 0 ? (
        <div className="card-lit border border-border/40 rounded-md p-8 text-center text-muted-foreground">
          <Activity className="h-8 w-8 mx-auto mb-3 text-muted-foreground/60" />
          <p className="text-sm">No cron runs yet. The first hourly run should appear within the hour.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mb-8">
            {Array.from(byRule.entries()).map(([name, stats]) => (
              <div key={name} className="card-lit border border-border/40 rounded-md p-4 relative">
                <div className={`h-[3px] rounded-t-md absolute inset-x-0 top-0 ${
                  stats.failed === 0 ? 'bg-emerald-500/80' : 'bg-destructive/80'
                }`} />
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    {name.replace(/_/g, ' ')}
                  </div>
                  {stats.failed === 0
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    : <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                  }
                </div>
                <div className="font-display text-2xl tracking-wider mb-1">
                  {stats.created} <span className="text-xs text-muted-foreground">notif</span>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {stats.total} runs · {stats.failed} failed · last {formatRelative(stats.lastRun)}
                </div>
              </div>
            ))}
          </div>

          <div className="card-lit border border-border/40 rounded-md overflow-hidden">
            <div className="grid grid-cols-[1.5fr_1fr_0.6fr_0.6fr_1fr] items-center gap-4 px-5 py-3 text-[10px] uppercase tracking-[0.15em] text-muted-foreground border-b border-border/40 bg-background/30">
              <div>Rule</div>
              <div>Ran at</div>
              <div className="text-right">Created</div>
              <div className="text-right">Duration</div>
              <div>Status</div>
            </div>
            {list.map(r => (
              <div key={r.id} className="grid grid-cols-[1.5fr_1fr_0.6fr_0.6fr_1fr] items-center gap-4 px-5 py-3 border-b border-border/20 last:border-0 text-sm">
                <div className="font-mono text-xs">{r.rule_name}</div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  {new Date(r.ran_at).toLocaleString('en-US', { timeZone: 'America/Phoenix' })}
                </div>
                <div className="text-right tabular-nums text-xs">
                  {r.notifications_created || 0}
                </div>
                <div className="text-right tabular-nums text-xs text-muted-foreground">
                  {r.duration_ms}ms
                </div>
                <div>
                  {r.ok ? (
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" /> ok
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] text-destructive">
                      <AlertCircle className="h-3 w-3" /> failed
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
