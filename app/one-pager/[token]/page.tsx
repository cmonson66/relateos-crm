import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import { OnePager } from '@/app/(app)/playbook/_components/one-pager';

export const dynamic = 'force-dynamic';

// The merchant-facing one-pager. Same component the rep prints, so the sheet
// left on the counter and the link in their texts can never drift apart.
//
// Keyed on the lead's existing pulse_token. get_one_pager (066) returns null
// for an unknown token and for a shop on compliance hold, which is why a dead
// link renders notFound rather than an empty sheet.

type OnePagerData = {
  shop: string | null;
  city: string | null;
  rep: { first: string; cell: string; email: string };
};

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await load(token);
  return {
    title: data ? `NectarPay for ${data.shop ?? 'your shop'}` : 'NectarPay',
    description: 'Accept crypto with zero processing fees.',
    robots: { index: false, follow: false },
  };
}

async function load(token: string): Promise<OnePagerData | null> {
  // Anon key on purpose: this page is opened by a merchant with no login.
  // The RPC is security definer and returns only what the sheet prints.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  const { data } = await supabase.rpc('get_one_pager', { p_token: token });
  return (data as OnePagerData | null) ?? null;
}

export default async function PublicOnePagerPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await load(token);
  if (!data) notFound();

  return (
    <main className="min-h-screen bg-neutral-100 px-3 py-6 print:bg-white print:p-0">
      <div className="mx-auto max-w-3xl">
        <OnePager rep={data.rep} />

        <div className="mt-5 text-center print:hidden">
          <p className="text-sm text-neutral-600">
            Questions? {data.rep.first} answers their own phone.
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {data.rep.cell && (
              // The visible text is a LABEL, never the raw number. iOS
              // rewrites a bare phone number into its own tel: link and
              // hijacks the tap.
              <a
                href={`tel:${data.rep.cell.replace(/[^\d+]/g, '')}`}
                className="rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white"
              >
                Call {data.rep.first}
              </a>
            )}
            {data.rep.email && (
              <a
                href={`mailto:${data.rep.email}`}
                className="rounded-md border border-neutral-400 px-4 py-2.5 text-sm text-neutral-800"
              >
                Email instead
              </a>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
