'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

type EntityType = 'account' | 'contact' | 'deal' | 'activity' | 'task';

export async function postComment(params: {
  entityType: EntityType;
  entityId: string;
  body: string;
  mentions: string[];
  parentId?: string | null;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  const { data: profile } = await supabase
    .from('profiles').select('org_id').eq('id', user.id).single();
  if (!profile) throw new Error('No profile');

  if (!params.body.trim()) throw new Error('Comment body required');

  const { error } = await supabase.from('comments').insert({
    org_id: profile.org_id,
    entity_type: params.entityType,
    entity_id: params.entityId,
    parent_id: params.parentId || null,
    author_id: user.id,
    body: params.body.trim(),
    mentions: params.mentions || [],
  });
  if (error) throw new Error(error.message);

  if (params.entityType === 'account')  revalidatePath(`/accounts/${params.entityId}`);
  if (params.entityType === 'contact')  revalidatePath(`/contacts/${params.entityId}`);
  if (params.entityType === 'deal')     revalidatePath(`/deals/${params.entityId}`);
}

export async function deleteComment(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('comments').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
