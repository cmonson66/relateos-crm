import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type Block = { key: string; label: string; section: string; original: string; value: string; edited: boolean; updated_by: string | null; updated_at: string | null };

/**
 * Only the blocks that actually differ, keyed the same way lib/call-scripts.ts
 * is structured, so porting an edit back is a lookup rather than a hunt.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('review_load', { p_token: token });
  if (error || !data) return NextResponse.json({ error: 'refused' }, { status: 403 });

  const blocks = (data.blocks as Block[]).filter((b) => b.edited);
  const body = JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      changed: blocks.length,
      blocks: blocks.map((b) => ({
        key: b.key,
        section: b.section,
        label: b.label,
        was: b.original,
        now: b.value,
        by: b.updated_by,
        at: b.updated_at,
      })),
    },
    null,
    2
  );

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="call-script-changes.json"',
    },
  });
}
