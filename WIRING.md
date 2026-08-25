# Playbook update

Unzip and commit. No hand-editing.

## Files

- `app/(app)/playbook/_components/playbook-view.tsx` — the setup tab now renders
  a component instead of ~150 lines of inline markup, and the XIT21 tab is wired in
- `app/(app)/playbook/_components/setup-guide.tsx` — NEW, the rewritten install guide
- `app/(app)/playbook/_components/xit21-guide.tsx` — the XIT21 tab
- `public/xit21-onepager.pdf` — the XIT21 sheet

## What is new in the install guide

- **Before you knock** checklist, including creating an empty wallet in the wallet
  app *in the car* — the import will not work otherwise
- The **hot wallet trap** as the first thing in step 1, before the coin is touched
- **Step 6, pairing the terminal**: /pos/pair on the device FIRST, then generate the
  code, because it expires in five minutes. Then Add to Home screen.
- Revoking a device is a bin icon, not a support call — the answer to
  "what if a phone walks off"
- A **when it goes wrong** table with eight real failures
- Traps sit BEFORE the step they ruin rather than after it
- Sites are tappable links here rather than QR codes; the printable sheet has the QRs

## Check

```
npx tsc --noEmit
git add -A
git commit -m "Rewrite the merchant install guide; XIT21 tab"
git push
```

Open the Playbook, then "Setting them up". The Print button still works — the
component keeps `id="playbook"` and the `print-pad` wrapper.
