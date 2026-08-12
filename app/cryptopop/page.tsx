import { CryptoPopPreview } from "@/components/marketing/cryptopop-preview";

export const metadata = {
  title: "CryptoPop preview - NectarPay",
  description:
    "A preview of CryptoPop, the map where people paying in crypto find the businesses that accept it.",
};

/**
 * Public and link-shareable so a rep can text it to a shop that has not bought
 * yet. No token, because there is nothing merchant-specific on it.
 */
export default function CryptoPopPage() {
  return (
    <div className="min-h-screen bg-[#0c1a2c]">
      <div className="mx-auto max-w-5xl px-5 py-9">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-2xl font-extrabold leading-none text-white">
              Nectar<span className="text-[#f2a71b]">Pay</span>
            </div>
            <div className="mt-1 text-[11px] italic text-white/50">Sweeten Every Transaction.</div>
          </div>
          <div className="rounded-full border border-[#f2a71b]/45 bg-[#f2a71b]/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#f2a71b]">
            CryptoPop · preview
          </div>
        </div>

        <CryptoPopPreview />
      </div>
    </div>
  );
}
