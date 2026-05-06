import { createClient } from '@/lib/supabase/server';

type EntityType = 'account' | 'contact' | 'deal' | 'activity' | 'task';
type AuditAction = 'created' | 'updated' | 'deleted' | 'stage_changed' | 'assigned' | 'imported';

export async function logAudit(params: {
  entityType: EntityType;
  entityId: string;
  action: AuditAction;
  changes?: Record<string, { from: unknown; to: unknown }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single();
  if (!profile) return;
  await supabase.from('audit_log').insert({
    org_id: profile.org_id,
    actor_id: user.id,
    entity_type: params.entityType,
    entity_id: params.entityId,
    action: params.action,
    changes: params.changes ?? null,
  });
}
