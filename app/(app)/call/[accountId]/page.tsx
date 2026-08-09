import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { buildScript } from '@/lib/call-scripts';
import { CallMode } from './_components/call-mode';

export const dynamic = 'force-dynamic';

type Intel = {
  band?: string;
  score?: number;
  status?: string;
  email_stage?: number;
  monthly_volume?: number | null;
  pulse_token?: string | null;
  crypto_volume?: number | null;
  crypto_native?: boolean;
  owner_first_name?: string | null;
  emails?: number;
};

export default async function CallPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  // RLS scopes this: reps can only open Call Mode on accounts they own
  const { data: account } = await supabase
    .from('accounts')
    .select('id, name, vertical, city, state, tags, crypto_native, crypto_score, crypto_atm_count')
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

  const { data: recent } = await supabase
    .from('activities')
    .select('type, subject, created_at')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(8);

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single();
  const repFirst = (profile?.full_name ?? 'your rep').split(' ')[0];

  // Lead-side intel through the security-definer bridge (034)
  let intel: Intel = {};
  if (contact?.legacy_id) {
    const { data } = await supabase.rpc('get_call_intel', {
      p_legacy_id: contact.legacy_id,
    });
    intel = (data ?? {}) as Intel;
  }

  const ownerName =
    intel.owner_first_name ??
    (contact && contact.title !== 'Business' ? contact.first_name : null);

  // The rep needs the actual URL mid-call, not just a "sent it" button.
  // Base URL comes from campaign settings via a security-definer RPC
  // (campaign_settings itself is admin-only - the key lives there).
  let pulseUrl: string | null = null;
  if (intel.pulse_token) {
    const { data: base } = await supabase.rpc('get_pulse_base');
    if (base) pulseUrl = `${String(base).replace(/\/$/, '')}/s/${intel.pulse_token}`;
  }

  const band =
    account.tags?.find((t: string) => t === 'HOT' || t === 'WARM' || t === 'COOL') ??
    intel.band ??
    'COOL';

  const script = buildScript(account.vertical, !!account.crypto_native, {
    owner: ownerName,
    shop: account.name,
    city: account.city ?? 'the Valley',
    rep: repFirst,
  });

  return (
    <CallMode
      account={{
        id: account.id,
        name: account.name,
        vertical: account.vertical,
        city: account.city,
        band,
        cryptoNative: !!account.crypto_native,
        cryptoScore: account.crypto_score ?? null,
        atmCount: account.crypto_atm_count ?? null,
      }}
      contact={
        contact
          ? {
              id: contact.id,
              name: ownerName,
              phone: contact.phone,
              legacyId: contact.legacy_id,
            }
          : null
      }
      intel={{
        score: intel.score ?? null,
        emailStage: intel.email_stage ?? 0,
        monthlyVolume: intel.monthly_volume ?? null,
        pulseUrl,
        status: intel.status ?? null,
        emailable: (intel.emails ?? 0) > 0,
      }}
      recent={(recent ?? []).map((r) => ({
        type: r.type,
        subject: r.subject ?? '',
        at: r.created_at,
      }))}
      script={script}
    />
  );
}
