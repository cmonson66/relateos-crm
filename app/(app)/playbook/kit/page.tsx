import { createClient } from '@/lib/supabase/server';
import { buildScript } from '@/lib/call-scripts';
import { KitView, type KitSheet } from '../_components/kit-view';

export const dynamic = 'force-dynamic';

// The whole packet for a day of visits: one walk-in sheet per shop, each
// followed by a one-pager to leave behind. ?ids=a,b,c picks the shops.
export default async function KitPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const { ids } = await searchParams;
  const accountIds = (ids ?? '').split(',').map(s => s.trim()).filter(Boolean);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user!.id).single();
  const repFirst = (profile?.full_name ?? 'your rep').split(' ')[0];
  const { data: repRow } = await supabase
    .from('reps').select('first_name, cell, from_email').eq('profile_id', user!.id).maybeSingle();
  const rep = {
    first: repRow?.first_name ?? repFirst,
    cell: repRow?.cell ?? '',
    email: repRow?.from_email ?? '',
  };

  const sheets: KitSheet[] = [];
  for (const accountId of accountIds) {
    const { data: account } = await supabase
      .from('accounts')
      .select('id, name, vertical, city, state, tags, crypto_native')
      .eq('id', accountId)
      .maybeSingle();
    if (!account) continue;

    const { data: contact } = await supabase
      .from('contacts')
      .select('first_name, title, phone, legacy_id')
      .eq('account_id', accountId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    let intel: { owner_first_name?: string | null; monthly_volume?: number | null; email_stage?: number; band?: string; pulse_token?: string | null } = {};
    let pulseUrl: string | null = null;
    if (contact?.legacy_id) {
      const { data } = await supabase.rpc('get_call_intel', { p_legacy_id: contact.legacy_id });
      intel = data ?? {};
      if (intel.pulse_token) {
        const { data: base } = await supabase.rpc('get_pulse_base');
        if (base) pulseUrl = `${String(base).replace(/\/$/, '')}/s/${intel.pulse_token}`;
      }
    }
    const owner = intel.owner_first_name ?? (contact && contact.title !== 'Business' ? contact.first_name : null);

    sheets.push({
      account: {
        id: account.id,
        name: account.name,
        city: [account.city, account.state].filter(Boolean).join(', '),
        band: account.tags?.find((t: string) => ['HOT', 'WARM', 'COOL'].includes(t)) ?? intel.band ?? '',
        cryptoNative: !!account.crypto_native,
      },
      owner,
      phone: contact?.phone ?? null,
      emailStage: intel.email_stage ?? 0,
      volume: intel.monthly_volume ?? null,
      pulseUrl,
      script: buildScript(account.vertical, !!account.crypto_native, {
        owner,
        shop: account.name,
        city: account.city ?? 'the Valley',
        rep: rep.first,
      }),
    });
  }

  return <KitView sheets={sheets} rep={rep} />;
}
