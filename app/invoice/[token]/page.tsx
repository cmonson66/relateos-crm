import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Line = {
  name: string;
  sku: string;
  qty: number;
  unit_cents: number;
  billing: "one_time" | "monthly";
  serial: string | null;
};

type Invoice = {
  number: string;
  bill_to_name: string;
  bill_to_address: string | null;
  lines_snapshot: Line[];
  one_time_cents: number;
  monthly_cents: number;
  total_cents: number;
  status: string;
  issued_at: string;
  due_at: string | null;
  paid_at: string | null;
  paid_method: string | null;
  issued_by_name: string | null;
};

const usd = (c: number) =>
  (c / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { dateStyle: "long", timeZone: "America/Phoenix" });

/**
 * One document, two states. Unpaid it is an invoice; paid it is the receipt,
 * at the same address, which is how it works on paper and means a merchant
 * only ever has one link to keep.
 */
export default async function InvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_invoice", { p_token: token });
  const inv = data as Invoice | null;
  if (!inv) notFound();

  const paid = inv.status === "paid";
  const lines = inv.lines_snapshot ?? [];

  return (
    <div className="min-h-screen bg-[#f8f4ea] text-[#0c1a2c]">
      <div className="bg-[#0c1a2c] print:bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 px-6 py-7">
          <div>
            <div className="text-2xl font-extrabold leading-none text-white print:text-[#0c1a2c]">
              Nectar<span className="text-[#f2a71b]">Pay</span>
            </div>
            <div className="mt-1 text-[11px] italic text-white/60 print:text-[#47566b]">
              Sweeten Every Transaction.
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.22em] text-[#f2a71b]">
              {paid ? "Receipt" : "Invoice"}
            </div>
            <div className="text-lg font-extrabold text-white print:text-[#0c1a2c]">
              {inv.number}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-9 print:px-0 print:py-4">
        {paid && (
          <div className="mb-7 rounded-2xl border-2 border-[#1f8a5b] bg-[#1f8a5b]/10 p-4">
            <div className="text-lg font-extrabold text-[#1f8a5b]">
              Paid in full {inv.paid_at ? `on ${day(inv.paid_at)}` : ""}
            </div>
            <div className="text-[13px] text-[#47566b]">
              {inv.paid_method ? `Paid by ${inv.paid_method}. ` : ""}Keep this page. It is your
              receipt.
            </div>
          </div>
        )}

        <div className="mb-7 flex flex-wrap justify-between gap-6">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#47566b]">Billed to</div>
            <div className="mt-1 text-xl font-extrabold">{inv.bill_to_name}</div>
            {inv.bill_to_address && (
              <div className="text-sm text-[#47566b]">{inv.bill_to_address}</div>
            )}
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[12px]">
            <Fact k="Issued" v={day(inv.issued_at)} />
            {!paid && inv.due_at && <Fact k="Due" v={day(inv.due_at)} />}
            {inv.issued_by_name && <Fact k="Sold by" v={inv.issued_by_name} />}
          </dl>
        </div>

        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b-2 border-[#f2a71b] text-left text-[10px] uppercase tracking-[0.15em] text-[#47566b]">
              <th className="pb-1.5">Item</th>
              <th className="pb-1.5 text-center">Qty</th>
              <th className="pb-1.5 text-right">Unit</th>
              <th className="pb-1.5 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={`${l.sku}-${i}`} className="border-b border-[#0c1a2c]/10">
                <td className="py-2.5">
                  <div className="font-bold">{l.name}</div>
                  <div className="text-[11px] text-[#47566b]">
                    {l.billing === "monthly" ? "Membership, billed annually" : "One time"}
                    {l.serial ? ` · serial ${l.serial}` : ""}
                  </div>
                </td>
                <td className="py-2.5 text-center">{l.qty}</td>
                <td className="py-2.5 text-right">{usd(l.unit_cents)}</td>
                <td className="py-2.5 text-right font-bold">
                  {l.billing === "monthly"
                    ? usd(l.unit_cents * l.qty * 12)
                    : usd(l.unit_cents * l.qty)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-5 flex justify-end">
          <dl className="w-full max-w-xs space-y-2 text-[13px]">
            <Row k="Hardware, one time" v={usd(inv.one_time_cents)} />
            <Row k="Membership, 12 months" v={usd(inv.monthly_cents * 12)} />
            <div className="flex items-baseline justify-between border-t-2 border-[#0c1a2c] pt-2">
              <dt className="font-extrabold uppercase tracking-wide">
                {paid ? "Paid" : "Total due"}
              </dt>
              <dd className="text-xl font-extrabold">{usd(inv.total_cents)}</dd>
            </div>
          </dl>
        </div>

        <p className="mt-9 border-t border-[#0c1a2c]/15 pt-4 text-[11px] leading-relaxed text-[#47566b]">
          Membership is billed a year at a time and is what powers the terminal. NectarPay takes no
          percentage of your sales, ever. This page stays available at this address
          {paid ? " as your receipt." : " and becomes your receipt once it is paid."}
        </p>
      </div>
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-[0.14em] text-[#47566b]">{k}</dt>
      <dd className="mt-0.5 font-bold">{v}</dd>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-[#47566b]">{k}</dt>
      <dd className="font-bold">{v}</dd>
    </div>
  );
}
