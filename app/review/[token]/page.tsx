import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ReviewClient, type ReviewPayload } from './review-client';

export const dynamic = 'force-dynamic';

// Public, no login. The token in the URL is the credential and the tables stay
// closed behind security-definer RPCs - the same trust model /agreement,
// /setup and /start already use for merchants who will never have an account.
export default async function ReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc('review_load', { p_token: token });
  const payload = data as ReviewPayload | null;

  // A dead, expired or wrong token is a 404 rather than a "bad token" message.
  // Telling a stranger the URL shape was right is free information.
  if (!payload) notFound();

  return <ReviewClient token={token} initial={payload} />;
}
