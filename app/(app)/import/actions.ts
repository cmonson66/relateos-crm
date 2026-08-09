'use server';

// NectarPay import: CSVs are shop lists more often than people lists, so a
// row is valid with EITHER an organization or a first name. Accounts carry
// city/state/phone/website (city matters - the Places bridge matches on
// "name, city AZ"). Contact-less business rows get the standard 'Business'
// placeholder contact when they carry a phone/email worth keeping.

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { logAudit } from '@/lib/db/audit';
import { VERTICALS, DEFAULT_VERTICAL } from '@/lib/verticals';

export type ImportRow = {
  organization?: string;
  vertical?: string;
  city?: string;
  state?: string;
  phone?: string;
  website?: string;
  notes?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  title?: string;
  status?: string;
  legacy_id?: string;
  rep?: string; // per-row owner: first name or email, matched to a profile
};

export type ImportResult = {
  importId: string;
  successCount: number;      // contacts created
  accountsCreated: number;
  createdAccountIds: string[]; // fuel for the post-import bulk sync
  skippedCount: number;      // dupes we refused to double-import
  errorCount: number;
  errors: { row: number; message: string }[];
};

const verticalMap: Record<string, string> = {};
for (const v of VERTICALS) {
  verticalMap[v.value.toLowerCase()] = v.value;
  verticalMap[v.label.toLowerCase()] = v.value;
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

export type ImportOptions = {
  // Everything in the file goes to this rep unless a row names its own.
  // (Without this, an import silently belonged to whoever ran it - and
  // under owner-scoping that makes it invisible to the rep who needs it.)
  defaultOwnerId?: string;
  // Unrecognized CSV vertical values -> known vertical, decided in preview
  verticalOverrides?: Record<string, string>;
};

export async function executeImport(
  rows: ImportRow[],
  filename: string,
  options: ImportOptions = {}
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

  // Resolve rep names/emails to profiles for per-row assignment
  const { data: people } = await supabase
    .from('profiles').select('id, full_name, email').eq('is_active', true);
  const ownerByKey = new Map<string, string>();
  for (const p of people ?? []) {
    if (p.email) ownerByKey.set(p.email.toLowerCase(), p.id);
    const first = (p.full_name ?? '').split(' ')[0].toLowerCase();
    if (first) ownerByKey.set(first, p.id);
    if (p.full_name) ownerByKey.set(p.full_name.toLowerCase(), p.id);
  }
  const fileOwner = options.defaultOwnerId || user.id;
  const ownerFor = (row: ImportRow): string => {
    const key = row.rep?.trim().toLowerCase();
    return (key && ownerByKey.get(key)) || fileOwner;
  };

  const errors: { row: number; message: string }[] = [];
  let successCount = 0;
  let skippedCount = 0;
  const createdAccountIds: string[] = [];

  // 1. Group rows by organization; account-level fields come from the
  //    first row that carries them
  type AcctInfo = {
    vertical: string; city: string | null; state: string | null;
    website: string | null; notes: string | null; rows: number[]; ownerId: string;
  };
  const accountsByName = new Map<string, AcctInfo>();
  rows.forEach((row, idx) => {
    const orgName = row.organization?.trim();
    if (!orgName) return;
    if (!accountsByName.has(orgName)) {
      const v = (row.vertical || '').toLowerCase().trim();
      accountsByName.set(orgName, {
        vertical: verticalMap[v] || options.verticalOverrides?.[v] || DEFAULT_VERTICAL,
        city: null, state: null, website: null, notes: null,
        rows: [], ownerId: ownerFor(row),
      });
    }
    const entry = accountsByName.get(orgName)!;
    if (!entry.city && row.city?.trim()) entry.city = row.city.trim();
    if (!entry.state && row.state?.trim()) entry.state = row.state.trim();
    if (!entry.website && row.website?.trim()) entry.website = row.website.trim();
    if (!entry.notes && row.notes?.trim()) entry.notes = row.notes.trim();
    entry.rows.push(idx);
  });

  // 2. Accounts: match existing by name (case-insensitive), else create
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
        city: info.city,
        state: info.state ?? 'AZ',
        website: info.website,
        notes: info.notes,
        tags: [],
        created_by: user.id,
        owner_id: info.ownerId,
      })
      .select('id')
      .single();

    if (error || !created) {
      info.rows.forEach(r => errors.push({ row: r + 1, message: `Account "${name}": ${error?.message || 'unknown error'}` }));
      continue;
    }
    accountIdByName.set(name, created.id);
    createdAccountIds.push(created.id);
    await logAudit({ entityType: 'account', entityId: created.id, action: 'imported' });
  }

  // 3. Contacts. A row without a first name still yields a 'Business'
  //    placeholder contact when it carries a phone or email (Call Mode and
  //    the Places bridge both want a contact to hang data on).
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const orgName = row.organization?.trim();
    const accountId = orgName ? accountIdByName.get(orgName) ?? null : null;
    const hasPerson = !!row.first_name?.trim();
    const hasReachInfo = !!(row.email?.trim() || row.phone?.trim());

    if (!hasPerson && !orgName) {
      errors.push({ row: i + 1, message: 'Needs an organization or a first name' });
      continue;
    }
    if (!hasPerson && !hasReachInfo) continue; // account-only row - fine, nothing more to add

    // Dedupe: same email in this org, or same legacy id, means we've got them
    if (row.email?.trim()) {
      const { data: dupe } = await supabase
        .from('contacts')
        .select('id')
        .eq('org_id', profile.org_id)
        .ilike('email', row.email.trim())
        .maybeSingle();
      if (dupe) { skippedCount++; continue; }
    }
    if (row.legacy_id?.trim()) {
      const { data: dupe } = await supabase
        .from('contacts')
        .select('id')
        .eq('legacy_id', row.legacy_id.trim())
        .maybeSingle();
      if (dupe) { skippedCount++; continue; }
    }

    const stage = (row.status || '').toLowerCase().trim();
    const { data: created, error } = await supabase
      .from('contacts')
      .insert({
        org_id: profile.org_id,
        account_id: accountId,
        first_name: hasPerson ? row.first_name!.trim() : (orgName ?? 'Business'),
        last_name: hasPerson ? row.last_name?.trim() || null : null,
        title: hasPerson ? row.title?.trim() || null : 'Business',
        email: row.email?.trim() || null,
        phone: row.phone?.trim() || null,
        lifecycle_stage: lifecycleMap[stage] || 'new',
        legacy_id: row.legacy_id?.trim() || null,
        owner_id: ownerFor(row),
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
    accountsCreated: createdAccountIds.length,
    createdAccountIds,
    skippedCount,
    errorCount: errors.length,
    errors,
  };
}


// ---------------------------------------------------------------------
// Preflight: what WOULD happen, checked before anything is written.
// Surfaces duplicates and unrecognized verticals while they can still be
// fixed, instead of reporting them in the summary afterward.
// ---------------------------------------------------------------------
export type Preflight = {
  accountsNew: number;
  accountsExisting: { name: string; owner: string | null }[];
  contactsDuplicate: { email: string; name: string }[];
  unknownVerticals: { raw: string; count: number }[];
  knownVerticals: { value: string; label: string }[];
  people: { id: string; name: string }[];
};

export async function preflightImport(rows: ImportRow[]): Promise<Preflight> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single();
  if (!profile) throw new Error('No profile');

  const names = Array.from(new Set(rows.map(r => r.organization?.trim()).filter(Boolean))) as string[];
  const emails = Array.from(new Set(rows.map(r => r.email?.trim().toLowerCase()).filter(Boolean))) as string[];

  const accountsExisting: { name: string; owner: string | null }[] = [];
  for (let i = 0; i < names.length; i += 40) {
    const batch = names.slice(i, i + 40);
    const { data } = await supabase
      .from('accounts')
      .select('name, owner:profiles!accounts_owner_id_fkey(full_name)')
      .eq('org_id', profile.org_id)
      .in('name', batch);
    for (const a of data ?? []) {
      const own = Array.isArray(a.owner) ? a.owner[0] : a.owner;
      accountsExisting.push({ name: a.name, owner: own?.full_name ?? null });
    }
  }

  const contactsDuplicate: { email: string; name: string }[] = [];
  for (let i = 0; i < emails.length; i += 40) {
    const batch = emails.slice(i, i + 40);
    const { data } = await supabase
      .from('contacts')
      .select('email, first_name, last_name')
      .eq('org_id', profile.org_id)
      .in('email', batch);
    for (const c of data ?? []) {
      if (!c.email) continue;
      contactsDuplicate.push({ email: c.email, name: [c.first_name, c.last_name].filter(Boolean).join(' ') });
    }
  }

  // Vertical values we do not recognize: they would silently become the
  // default vertical, so they get raised here instead
  const counts = new Map<string, number>();
  for (const r of rows) {
    const v = (r.vertical || '').toLowerCase().trim();
    if (!v || verticalMap[v]) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }

  const { data: people } = await supabase
    .from('profiles').select('id, full_name, email, role')
    .eq('is_active', true)
    .in('role', ['super_admin', 'admin', 'manager', 'rep'])
    .order('full_name');

  return {
    accountsNew: names.length - accountsExisting.length,
    accountsExisting,
    contactsDuplicate,
    unknownVerticals: Array.from(counts.entries()).map(([raw, count]) => ({ raw, count })),
    knownVerticals: VERTICALS.map(v => ({ value: v.value, label: v.label })),
    people: (people ?? []).map(p => ({ id: p.id, name: p.full_name || p.email || 'Rep' })),
  };
}
