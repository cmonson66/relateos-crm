import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const since = new URL(req.url).searchParams.get('since');

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('review_since', {
    p_token: token,
    p_since: since ?? new Date(0).toISOString(),
  });

  if (error || !data) return NextResponse.json({ error: 'refused' }, { status: 403 });
  return NextResponse.json(data);
}
