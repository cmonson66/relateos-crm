import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PitchClient, type Deck } from './pitch-client';

export const dynamic = 'force-dynamic';

/**
 * A rep's pitch, on a link.
 *
 * Public and token-gated, same trust model as /agreement, /setup and /start:
 * the merchant will never have a CRM login, and a deck is meant to be left
 * behind and forwarded to a business partner. Nothing here is confidential to
 * NectarPay - it is what the rep just showed them on a phone.
 */
export default async function PitchPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc('pitch_load', { p_token: token });
  if (!data) notFound();
  return <PitchClient deck={data as Deck} />;
}
