# Playbook update - v5

Unzip, commit, push. Nothing to hand-edit.

## What is in here

- `app/(app)/playbook/_components/setup-guide.tsx` — the rewritten install guide
- `app/(app)/playbook/_components/qr-codes.tsx` — NEW, the five QR codes
- `app/(app)/playbook/_components/playbook-view.tsx` — setup renders the component,
  XIT21 tab wired in
- `app/(app)/playbook/_components/xit21-guide.tsx` — the XIT21 tab
- `public/xit21-onepager.pdf`

## The QR codes

Back on the page, beside each step - blockchainmint, beekeeper, nectar-pay,
the dashboard, and /pos/pair. The URLs remain tappable links too, so it works
whether a rep is on a laptop setting up the merchant's phone or on their own.

They are baked in as SVG rather than generated, so there is **no new dependency**.
Two things that were wrong on the first attempt and got caught by decoding the
rendered output rather than trusting the generator:

- the modules are a STROKED path, not filled — rendering with `fill` gives a
  blank square that looks fine and scans nothing
- the QUIET ZONE is inside the viewBox, so a code does not rely on whatever
  surrounds it being white

Verified: all five decode to the correct URL, on a grey field, at the size they
actually render.

## After deploying

If you use `nectarpay-crm.vercel.app`, point the alias at the new build:

```
npx vercel alias set <new-deployment-url> nectarpay-crm.vercel.app
```
