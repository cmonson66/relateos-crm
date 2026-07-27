'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { logAudit } from '@/lib/db/audit';
import { VERTICALS, DEFAULT_VERTICAL } from '@/lib/verticals';

export type ImportRow = {
  organization?: string;
  vertical?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  title?: string;
  status?: string;
  sport_focus?: string;
  school_tier?: string;
  legacy_id?: string;
};

export type ImportResult = {
  importId: string;
  successCount: number;
  errorCount: number;
  errors: { row: number; message: string }[];
};

const verticalMap: Record<string, string> = {};
for (const v of VERTICALS) {
  verticalMap[v.value.toLowerCase()] = v.value;
  verticalMap[v.label.toLowerCase()] = v.value;
}
// Legacy aliases apply only when their target vertical exists in this instance
const legacyAliases: Record<string, string> = {
  athletics: 'sports',
  k12: 'education',
  'higher ed': 'education',
  'public safety': 'public_safety',
  publicsafety: 'public_safety',
  fire: 'public_safety',
  police: 'public_safety',
};
for (const [alias, target] of Object.entries(legacyAliases)) {
  if (VERTICALS.some(v => v.value === target)) verticalMap[alias] = target;
}

const lifecycleMap: Record<string, string> = {
  new: 'new',
  working: 'working',
  engaged: 'engaged',
  active: 'engaged',
  customer: 'customer',
  closed: 'customer',
  won: 'customer',
  disqualified: 'disqualified',
  lost: 'disqualified',
  cold: 'disqualified',
};

export async function executeImport(
  rows: ImportRow[],
  filename: string
): Promise<ImportResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single();
  if (!profile) throw new Error('No profile');

  const { data: importRecord, error: importErr } = await supabase
    .from('imports')
    .insert({
      org_id: profile.org_id,
      filename,
      row_count: rows.length,
      imported_by: user.id,
      status: 'processing',
    })
    .select('id')
    .single();
  if (importErr || !importRecord) throw new Error(importErr?.message || 'Failed to create import record');

  const errors: { row: number; message: string }[] = [];
  let successCount = 0;

  // 1. Group rows by organization name to dedupe accounts
  const accountsByName = new Map<string, { vertical: string; tags: Set<string>; rows: number[] }>();
  rows.forEach((row, idx) => {
    const orgName = row.organization?.trim();
    if (!orgName) return;
    if (!accountsByName.has(orgName)) {
      const v = (row.vertical || '').toLowerCase().trim();
      accountsByName.set(orgName, {
        vertical: verticalMap[v] || DEFAULT_VERTICAL,
        tags: new Set(),
        rows: [],
      });
    }
    const entry = accountsByName.get(orgName)!;
    if (row.sport_focus?.trim()) entry.tags.add(row.sport_focus.trim());
    if (row.school_tier?.trim()) entry.tags.add(row.school_tier.trim());
    entry.rows.push(idx);
  });

  // 2. Insert accounts
  const accountIdByName = new Map<string, string>();
  for (const [name, info] of accountsByName.entries()) {
    const { data: existing } = await supabase
      .from('accounts')
      .select('id')
      .eq('org_id', profile.org_id)
      .ilike('name', name)
      .maybeSingle();

    if (existing) {
      accountIdByName.set(name, existing.id);
      continue;
    }

    const { data: created, error } = await supabase
      .from('accounts')
      .insert({
        org_id: profile.org_id,
        name,
        vertical: info.vertical,
        tags: Array.from(info.tags),
        created_by: user.id,
        owner_id: user.id,
      })
      .select('id')
      .single();

    if (error || !created) {
      info.rows.forEach(r => errors.push({ row: r + 1, message: `Account "${name}": ${error?.message || 'unknown error'}` }));
      continue;
    }
    accountIdByName.set(name, created.id);
    await logAudit({ entityType: 'account', entityId: created.id, action: 'imported' });
  }

  // 3. Insert contacts
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.first_name?.trim()) {
      errors.push({ row: i + 1, message: 'Missing first name' });
      continue;
    }

    const accountId = row.organization ? accountIdByName.get(row.organization.trim()) : null;
    const stage = (row.status || '').toLowerCase().trim();
    const lifecycle = lifecycleMap[stage] || 'new';

    const { data: created, error } = await supabase
      .from('contacts')
      .insert({
        org_id: profile.org_id,
        account_id: accountId,
        first_name: row.first_name.trim(),
        last_name: row.last_name?.trim() || null,
        email: row.email?.trim() || null,
        title: row.title?.trim() || null,
        lifecycle_stage: lifecycle,
        legacy_id: row.legacy_id?.trim() || null,
        owner_id: user.id,
        created_by: user.id,
      })
      .select('id')
      .single();

    if (error) {
      errors.push({ row: i + 1, message: error.message });
      continue;
    }
    if (created) {
      successCount++;
      await logAudit({ entityType: 'contact', entityId: created.id, action: 'imported' });
    }
  }

  await supabase
    .from('imports')
    .update({
      status: 'complete',
      success_count: successCount,
      error_count: errors.length,
      errors,
    })
    .eq('id', importRecord.id);

  revalidatePath('/accounts');
  revalidatePath('/contacts');

  return {
    importId: importRecord.id,
    successCount,
    errorCount: errors.length,
    errors,
  };
}
