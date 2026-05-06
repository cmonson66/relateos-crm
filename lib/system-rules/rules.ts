import type { SupabaseClient } from '@supabase/supabase-js';

const STUCK_DAYS = 14;
const COLD_DAYS = 14;
const COLD_DEBOUNCE_DAYS = 7;
const STUCK_DEBOUNCE_DAYS = 7;

// ──────────────────────────────────────────────────────────────────────────
// Rule 1: Deal stuck more than 14 days in stage (excluding Won/Lost)
// ──────────────────────────────────────────────────────────────────────────
export async function ruleDealStuck(supabase: SupabaseClient): Promise<number> {
  const stuckCutoff = new Date(Date.now() - STUCK_DAYS * 86400000).toISOString();
  const debounceCutoff = new Date(Date.now() - STUCK_DEBOUNCE_DAYS * 86400000).toISOString();

  // Pull deals stuck > 14d in stage with an owner who is active, not in Won/Lost
  const { data: deals } = await supabase
    .from('deals_with_stage')
    .select('id, name, org_id, owner_id, stage_name, stage_is_won, stage_is_lost, stage_entered_at, last_stuck_alert_at')
    .eq('stage_is_won', false)
    .eq('stage_is_lost', false)
    .lt('stage_entered_at', stuckCutoff)
    .not('owner_id', 'is', null)
    .or(`last_stuck_alert_at.is.null,last_stuck_alert_at.lt.${debounceCutoff}`);

  if (!deals || deals.length === 0) return 0;

  let created = 0;
  for (const d of deals) {
    const daysIn = Math.floor((Date.now() - new Date(d.stage_entered_at).getTime()) / 86400000);

    const { error } = await supabase.from('notifications').insert({
      org_id: d.org_id,
      recipient_id: d.owner_id,
      actor_id: null,
      type: 'system_alert',
      title: `Deal stuck ${daysIn}d in ${d.stage_name}`,
      body: d.name,
      entity_type: 'deal',
      entity_id: d.id,
    });

    if (!error) {
      await supabase.from('deals').update({ last_stuck_alert_at: new Date().toISOString() }).eq('id', d.id);
      created++;
    }
  }
  return created;
}

// ──────────────────────────────────────────────────────────────────────────
// Rule 2: Lead/contact untouched > 14 days (in working/engaged lifecycle)
// ──────────────────────────────────────────────────────────────────────────
export async function ruleLeadCold(supabase: SupabaseClient): Promise<number> {
  const coldCutoff = new Date(Date.now() - COLD_DAYS * 86400000).toISOString();
  const debounceCutoff = new Date(Date.now() - COLD_DEBOUNCE_DAYS * 86400000).toISOString();

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, org_id, owner_id, lifecycle_stage, last_activity_at, created_at, last_cold_alert_at')
    .in('lifecycle_stage', ['working', 'engaged'])
    .not('owner_id', 'is', null)
    .or(`last_cold_alert_at.is.null,last_cold_alert_at.lt.${debounceCutoff}`);

  if (!contacts) return 0;

  let created = 0;
  for (const c of contacts) {
    const lastTouch = c.last_activity_at || c.created_at;
    if (!lastTouch || lastTouch >= coldCutoff) continue;

    const days = Math.floor((Date.now() - new Date(lastTouch).getTime()) / 86400000);
    const fullName = `${c.first_name} ${c.last_name || ''}`.trim();

    const { error } = await supabase.from('notifications').insert({
      org_id: c.org_id,
      recipient_id: c.owner_id,
      type: 'system_alert',
      title: `${fullName} is going cold`,
      body: `No activity in ${days} days. They\'re still in ${c.lifecycle_stage} — time to reach out.`,
      entity_type: 'contact',
      entity_id: c.id,
    });

    if (!error) {
      await supabase.from('contacts').update({ last_cold_alert_at: new Date().toISOString() }).eq('id', c.id);
      created++;
    }
  }
  return created;
}

// ──────────────────────────────────────────────────────────────────────────
// Rule 3: Task overdue (scheduled_at in past, not complete)
// Only fires once per task — uses reminder_sent_at as overdue marker too
// Run daily — only alert if scheduled_at < today and assignee hasn't been
// alerted in last 24h
// ──────────────────────────────────────────────────────────────────────────
export async function ruleTaskOverdue(supabase: SupabaseClient): Promise<number> {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 86400000).toISOString();

  const { data: tasks } = await supabase
    .from('activities')
    .select('id, subject, body, org_id, owner_id, assigned_to, scheduled_at, completed_at, reminder_sent_at')
    .eq('type', 'task')
    .is('completed_at', null)
    .lt('scheduled_at', now.toISOString())
    .or(`reminder_sent_at.is.null,reminder_sent_at.lt.${twentyFourHoursAgo}`);

  if (!tasks) return 0;

  let created = 0;
  for (const t of tasks) {
    const recipient = t.assigned_to || t.owner_id;
    if (!recipient) continue;

    const overdueBy = Math.floor((now.getTime() - new Date(t.scheduled_at!).getTime()) / 86400000);
    const overdueLabel =
      overdueBy === 0 ? 'due today'
      : overdueBy === 1 ? '1 day overdue'
      : `${overdueBy} days overdue`;

    const { error } = await supabase.from('notifications').insert({
      org_id: t.org_id,
      recipient_id: recipient,
      type: 'system_alert',
      title: `Task ${overdueLabel}`,
      body: t.subject || t.body?.slice(0, 200) || 'Untitled task',
      entity_type: 'task',
      entity_id: t.id,
    });

    if (!error) {
      await supabase.from('activities').update({ reminder_sent_at: now.toISOString() }).eq('id', t.id);
      created++;
    }
  }
  return created;
}

// ──────────────────────────────────────────────────────────────────────────
// Rule 4: New lead assigned (contact created/assigned in last hour)
// The DB trigger handles individual task assignments. This rule catches
// contacts that were imported or created with an owner_id but no logged
// touch yet — fires once per contact via last_cold_alert_at as the marker.
//
// Actually — the task assignment trigger we built on Day 3 covers
// "task_assigned" which is the relevant case. New lead assigned via direct
// contact assignment is just a contact ownership change. We\'ll use this
// rule to alert on contacts assigned to someone but with no activity yet,
// 1+ hour after creation. Avoids fighting the existing trigger.
// ──────────────────────────────────────────────────────────────────────────
export async function ruleNewLeadAssigned(supabase: SupabaseClient): Promise<number> {
  // For now this rule is a no-op — task assignment notifications are
  // handled by the DB trigger fan_out_task_assignment, and contact
  // ownership changes are rare. Reserved for v2 — when we add a
  // "lead handoff" workflow this will become relevant.
  void supabase;
  return 0;
}

// ──────────────────────────────────────────────────────────────────────────
// Rule 5: Scheduled activity reminder (30 minutes before scheduled_at)
// ──────────────────────────────────────────────────────────────────────────
export async function ruleScheduledReminder(supabase: SupabaseClient): Promise<number> {
  const now = new Date();
  const windowStart = new Date(now.getTime() + 25 * 60_000).toISOString();
  const windowEnd = new Date(now.getTime() + 65 * 60_000).toISOString();
  // Window is 25-65 minutes ahead so we catch ~30min reminders given hourly cron

  const { data: activities } = await supabase
    .from('activities')
    .select('id, type, subject, body, org_id, owner_id, assigned_to, scheduled_at, reminder_sent_at')
    .in('type', ['call', 'email', 'meeting', 'task'])
    .is('completed_at', null)
    .is('reminder_sent_at', null)
    .gte('scheduled_at', windowStart)
    .lte('scheduled_at', windowEnd);

  if (!activities) return 0;

  let created = 0;
  for (const a of activities) {
    const recipient = a.assigned_to || a.owner_id;
    if (!recipient) continue;

    const minutesUntil = Math.round((new Date(a.scheduled_at!).getTime() - now.getTime()) / 60000);

    const { error } = await supabase.from('notifications').insert({
      org_id: a.org_id,
      recipient_id: recipient,
      type: 'activity_reminder',
      title: `${a.type[0].toUpperCase() + a.type.slice(1)} in ${minutesUntil}m`,
      body: a.subject || a.body?.slice(0, 200) || 'Scheduled activity',
      entity_type: a.type === 'task' ? 'task' : 'activity',
      entity_id: a.id,
    });

    if (!error) {
      await supabase.from('activities').update({ reminder_sent_at: now.toISOString() }).eq('id', a.id);
      created++;
    }
  }
  return created;
}
