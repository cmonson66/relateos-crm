import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// The token comes from the path, never the body. review_save re-checks it and
// refuses if the token is dead, expired or read-only, so a forged request
// gains nothing.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const { key, value, note } = await req.json();
  if (typeof key !== 'string' || typeof value !== 'string') {
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('review_save', {
    p_token: token,
    p_key: key,
    p_value: value,
    p_note: typeof note === 'string' ? note : null,
  });

  if (error || !data) return NextResponse.json({ error: 'refused' }, { status: 403 });
  return NextResponse.json(data);
}
