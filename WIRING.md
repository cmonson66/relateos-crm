# Trials default to 30 days

Three files. Unzip, commit, push. No migration.

- `lib/db/trials.ts` — new `TRIAL_DEFAULT_DAYS = 30`
- `app/(app)/deals/_components/trial-panel.tsx` — uses it
- `app/(app)/deals/[id]/agreement/page.tsx` — uses it

Both places had `?? 14` written inline. It is now one constant, so the two
cannot drift apart again.

## What changes

A trial with no length set opens at **30 days** instead of 14. The 14 / 21 / 30
shortcut buttons and the free-entry box are untouched — length is still the
rep's call.

Everything derived follows automatically: a 30 day trial checks in on **day 15**
and the conversion conversation lands **two days before the end**.

## What does not change

**Trials already running keep their length.** The default only applies where
`trial_days` is null, so nothing in flight moves and no signed agreement is
contradicted.

## Check

```
npx tsc --noEmit
```
