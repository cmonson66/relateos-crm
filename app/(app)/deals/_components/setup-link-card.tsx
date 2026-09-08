// app/(app)/deals/[id]/_components/setup-link-card.tsx

"use client";

import { useState } from "react";
import { Copy, Mail, Phone, CheckCircle2 } from "lucide-react";

interface SetupLinkCardProps {
  dealId: string;
  setupToken: string | null;
  setupStatus: number; // 0-5
  merchantEmail?: string | null;
  merchantPhone?: string | null;
}

export function SetupLinkCard({
  dealId,
  setupToken,
  setupStatus,
  merchantEmail,
  merchantPhone,
}: SetupLinkCardProps) {
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://nectarpayaz.com";
  const setupUrl = setupToken ? `${baseUrl}/setup/${setupToken}` : null;

  const copyToClipboard = () => {
    if (setupUrl) {
      navigator.clipboard.writeText(setupUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const sendViaEmail = async () => {
    if (!merchantEmail || !setupUrl) return;
    setSending(true);
    try {
      await fetch(`/api/deals/${dealId}/send-setup-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: merchantEmail,
          setupUrl,
          method: "email",
        }),
      });
    } catch (err) {
      console.error("Error sending email:", err);
    } finally {
      setSending(false);
    }
  };

  const stepLabels = [
    "Open Coin",
    "Create Account",
    "Link Wallet",
    "Install App",
    "Test Payment",
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-900">Terminal Setup</h3>
          <p className="text-sm text-slate-600">
            {setupStatus === 5
              ? "Setup complete ✓"
              : `Step ${setupStatus} of 5: ${stepLabels[setupStatus]}`}
          </p>
        </div>
        {setupStatus === 5 && (
          <CheckCircle2 className="w-6 h-6 text-green-600" />
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all"
          style={{ width: `${(setupStatus / 5) * 100}%` }}
        />
      </div>

      {setupUrl ? (
        <>
          {/* Setup link */}
          <div className="bg-slate-50 border border-slate-200 rounded p-3">
            <p className="text-xs text-slate-600 mb-2">Setup Link:</p>
            <div className="flex gap-2">
              <code className="text-xs font-mono text-slate-700 break-all flex-1">
                {setupUrl}
              </code>
              <button
                onClick={copyToClipboard}
                className="flex-shrink-0 p-1.5 hover:bg-slate-200 rounded transition-colors"
                title="Copy to clipboard"
              >
                <Copy className="w-4 h-4 text-slate-600" />
                {copied && (
                  <span className="text-xs text-green-600 ml-1">Copied!</span>
                )}
              </button>
            </div>
          </div>

          {/* Send buttons */}
          {setupStatus < 5 && (
            <div className="flex gap-2 pt-2">
              {merchantEmail && (
                <button
                  onClick={sendViaEmail}
                  disabled={sending}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  Email Link
                </button>
              )}
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-2 px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-900 text-sm font-medium rounded transition-colors"
              >
                <Copy className="w-4 h-4" />
                Copy
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-slate-600">
          Setup link will be generated when you save the deal.
        </p>
      )}
    </div>
  );
}
