# Crypto density — CRM install

Verified against the real repo: `tsc --noEmit` clean, `next build` passes,
`eslint` introduces no new errors (the 3 pre-existing ones in
accounts-table.tsx are untouched).

## Files

| File | Status |
|---|---|
| `app/(app)/map/page.tsx` | rewritten — fetches `crypto_signals` |
| `app/(app)/map/_components/map-view.tsx` | rewritten — toggle, segment, density memo |
| `app/(app)/map/_components/leaflet-map.tsx` | rewritten — heat, kiosk pins, legend, popup row |
| `app/(app)/map/_components/crypto-heat.tsx` | new — heat layer + click fix |
| `app/(app)/accounts/_components/accounts-table.tsx` | rewritten — Crypto column, chip, sort |
| `components/app/crypto-score-badge.tsx` | new |
| `lib/crypto/density.ts` | new |
| `lib/db/types.ts` | rewritten — 5 crypto fields on Account |
| `types/leaflet-heat.d.ts`, `types/leaflet-heat-module.d.ts` | new |
| `sql/018_crypto_signals_rls.sql` | read policy (already run) |
| `sql/019_crypto_accounts_sync.sql` | new — carries scores onto accounts |

`app/(app)/accounts/page.tsx` needs no change: it already does `select('*')`,
so the new columns arrive on their own.

## Install

```powershell
cd C:\Users\cmons\dev\protoseq-crm
Expand-Archive -Path "$HOME\Downloads\crypto-heat-crm.zip" -DestinationPath . -Force
npm run build
git add "app/(app)/map" "app/(app)/accounts" components/app lib types sql
git commit -m "accounts: crypto density column, filter and sort"
git push
```

## Order

1. `node crypto\score.js` in the scraper repo — writes `nectarpay_leads.crypto_score`
2. `sql\019_crypto_accounts_sync.sql` in Supabase — adds the columns and backfills
3. Reload `/accounts`

Step 2 prints three NOTICE lines. If "accounts updated" is 0, the join key is
wrong — stop and check that `contacts.legacy_id` actually holds Places
place_ids.

From then on `crypto/score.js` calls `sync_crypto_to_accounts()` itself at the
end of every run, so the CRM stays current without a manual step.

## What you get

- **Crypto column** on the accounts table (desktop) and on each mobile card
- **`Crypto 70+` chip** alongside the vertical and Going-cold chips
- **Recent / Density sort toggle** next to the search box

All three only appear once at least one account has a score, so the page looks
exactly as it does today until step 2 runs.

Sorting puts unscored accounts last rather than treating them as zero — an
account nobody has scored is not the same as an account with no kiosks nearby.
