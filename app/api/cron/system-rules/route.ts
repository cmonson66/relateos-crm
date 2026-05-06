import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  ruleDealStuck,
  ruleLeadCold,
  ruleTaskOverdue,
  ruleNewLeadAssigned,
  ruleScheduledReminder,
} from '@/lib/system-rules/rules';

// Use service-role client — cron runs without a user context
function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !serviceKey) throw new Error('Missing Supabase env vars');
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(req: NextRequest) {
  // Vercel Cron sends a special header. Reject anyone else.
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  const rules = [
    { name: 'deal_stuck',          fn: ruleDealStuck },
    { name: 'lead_cold',           fn: ruleLeadCold },
    { name: 'task_overdue',        fn: ruleTaskOverdue },
    { name: 'new_lead_assigned',   fn: ruleNewLeadAssigned },
    { name: 'scheduled_reminder',  fn: ruleScheduledReminder },
  ];

  const results: Record<string, { ok: boolean; created: number; durationMs: number; error?: string }> = {};

  for (const rule of rules) {
    const start = Date.now();
    try {
      const created = await rule.fn(supabase);
      const durationMs = Date.now() - start;
      results[rule.name] = { ok: true, created, durationMs };
      await supabase.from('system_rule_runs').insert({
        rule_name: rule.name,
        duration_ms: durationMs,
        notifications_created: created,
        ok: true,
      });
    } catch (err) {
      const durationMs = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      results[rule.name] = { ok: false, created: 0, durationMs, error: message };
      await supabase.from('system_rule_runs').insert({
        rule_name: rule.name,
        duration_ms: durationMs,
        notifications_created: 0,
        ok: false,
        errors: { message },
      });
    }
  }

  return NextResponse.json({ ok: true, ranAt: new Date().toISOString(), results });
}
