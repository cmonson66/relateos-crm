"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addDealItem, removeDealItem } from "../item-actions";

export type Product = {
  id: string;
  sku: string;
  name: string;
  kind: string;
  unit_price_cents: number;
  billing: "one_time" | "monthly";
};

export type DealItem = {
  id: string;
  product_id: string;
  qty: number;
  unit_price_cents: number;
  billing: "one_time" | "monthly";
  serial_number: string | null;
  product_name: string;
  sku: string;
};

const money = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

/**
 * What is actually on this deal. A shop buys one touchscreen terminal and
 * takes a membership, and support tiers differ, so a single value_cents could
 * never describe it - and neither could an agreement built from one.
 */
export function DealItemsPanel({
  dealId,
  items,
  products,
}: {
  dealId: string;
  items: DealItem[];
  products: Product[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [qty, setQty] = useState(1);
  const [serial, setSerial] = useState("");

  const selected = products.find((p) => p.id === productId) ?? null;

  const oneTime = items
    .filter((i) => i.billing === "one_time")
    .reduce((n, i) => n + i.unit_price_cents * i.qty, 0);
  const monthly = items
    .filter((i) => i.billing === "monthly")
    .reduce((n, i) => n + i.unit_price_cents * i.qty, 0);
  const yearOne = oneTime + monthly * 12;

  const run = (fn: () => Promise<unknown>, ok: string) =>
    start(async () => {
      try {
        await fn();
        toast.success(ok);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "That did not save");
      }
    });

  return (
    <div className="card-lit relative mb-6 rounded-md border border-border/40 p-5 md:p-6">
      <div className="absolute inset-x-0 top-0 h-[2px] rounded-t-md bg-primary/50" />
      <h2 className="mb-3 flex items-center gap-2 font-display text-lg tracking-wider">
        <Package className="h-4 w-4 text-primary" /> WHAT THEY ARE GETTING
      </h2>

      {items.length === 0 ? (
        <p className="mb-4 text-sm text-muted-foreground">
          Nothing on this deal yet. Add the terminal and however many scanners the shop needs.
        </p>
      ) : (
        <div className="mb-4 space-y-1.5">
          {items.map((i) => (
            <div
              key={i.id}
              className="flex items-center gap-3 rounded-md border border-border/40 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">
                  {i.qty > 1 ? `${i.qty} × ` : ""}
                  {i.product_name}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {money(i.unit_price_cents)}
                  {i.billing === "monthly" ? " /mo each" : " one-time"}
                  {i.serial_number ? ` · ${i.serial_number}` : ""}
                </div>
              </div>
              <div className="shrink-0 text-sm font-display tracking-wider">
                {money(i.unit_price_cents * i.qty)}
                {i.billing === "monthly" ? <span className="text-[11px]">/mo</span> : null}
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => removeDealItem({ itemId: i.id, dealId }), "Removed")}
                className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:text-destructive"
                title="Remove"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-border/40 bg-background px-2.5 py-2 text-sm [color-scheme:dark]"
        >
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} - {money(p.unit_price_cents)}
              {p.billing === "monthly" ? "/mo" : ""}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          max={50}
          value={qty}
          onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
          className="w-20 rounded-md border border-border/40 bg-background px-2.5 py-2 text-sm"
        />
        {selected?.kind === "hardware" && (
          <input
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            placeholder="Serial (optional)"
            className="w-40 rounded-md border border-border/40 bg-background px-2.5 py-2 font-mono text-sm"
          />
        )}
        <Button
          size="sm"
          disabled={pending || !productId}
          onClick={() =>
            run(async () => {
              await addDealItem({ dealId, productId, qty, serial: serial || null });
              setSerial("");
            }, "Added")
          }
          className="font-display tracking-wider"
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Add
        </Button>
      </div>

      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-4 border-t border-border/30 pt-3">
          <Total k="Up front" v={money(oneTime)} />
          <Total k="Monthly" v={`${money(monthly)}/mo`} />
          <Total k="Year one" v={money(yearOne)} strong />
        </div>
      )}
    </div>
  );
}

function Total({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{k}</div>
      <div
        className={
          strong
            ? "truncate font-display text-lg tracking-wider text-primary"
            : "truncate font-display text-sm tracking-wider"
        }
      >
        {v}
      </div>
    </div>
  );
}
