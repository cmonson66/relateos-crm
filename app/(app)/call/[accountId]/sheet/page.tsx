import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { buildScript } from '@/lib/call-scripts';
import { WalkInSheet } from '../_components/walk-in-sheet';

export const dynamic = 'force-dynamic';

// A printable walk-in sheet for ONE shop: their name, their numbers, the
// story their emails already told them, and the objections their industry
// actually raises. Print-optimized - one page, black on white.
export default async function SheetPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: account } = await supabase
    .from('accounts')
    .select('id, name, vertical, city, state, tags, crypto_native, crypto_score')
    .eq('id', accountId)
    .maybeSingle();
  if (!account) notFound();

  const { data: contact } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, title, phone, legacy_id')
    .eq('account_id', accountId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: profile } = await supabase
    .from('profiles').select('full_name').eq('id', user.id).single();
  const repFirst = (profile?.full_name ?? 'your rep').split(' ')[0];

  let intel: {
    band?: string; email_stage?: number; monthly_volume?: number | null;
    owner_first_name?: string | null; pulse_token?: string | null;
  } = {};
  let pulseUrl: string | null = null;
  if (contact?.legacy_id) {
    const { data } = await supabase.rpc('get_call_intel', { p_legacy_id: contact.legacy_id });
    intel = data ?? {};
    if (intel.pulse_token) {
      const { data: base } = await supabase.rpc('get_pulse_base');
      if (base) pulseUrl = `${String(base).replace(/\/$/, '')}/s/${intel.pulse_token}`;
    }
  }

  const ownerName =
    intel.owner_first_name ??
    (contact && contact.title !== 'Business' ? contact.first_name : null);

  const script = buildScript(account.vertical, !!account.crypto_native, {
    owner: ownerName,
    shop: account.name,
    city: account.city ?? 'the Valley',
    rep: repFirst,
  });

  const { data: reps } = await supabase
    .from('reps').select('first_name, cell, from_email').eq('profile_id', user.id).maybeSingle()
    .then(r => ({ data: r.data ? [r.data] : [] }));
  const me = reps?.[0] ?? { first_name: repFirst, cell: '', from_email: '' };

  return (
    <WalkInSheet
      account={{
        id: account.id,
        name: account.name,
        city: [account.city, account.state].filter(Boolean).join(', '),
        band: account.tags?.find((t: string) => ['HOT', 'WARM', 'COOL'].includes(t)) ?? intel.band ?? '',
        cryptoNative: !!account.crypto_native,
      }}
      owner={ownerName}
      phone={contact?.phone ?? null}
      emailStage={intel.email_stage ?? 0}
      volume={intel.monthly_volume ?? null}
      pulseUrl={pulseUrl}
      script={script}
      rep={{ first: me.first_name, cell: me.cell ?? '', email: me.from_email ?? '' }}
    />
  );
}
