# Call outcome: "Talked to someone"

Two files. Unzip, commit, push. No migration.

- `app/(app)/call/actions.ts` — new `gatekeeper` outcome, its timeline label,
  and a follow-up task
- `app/(app)/call/[accountId]/_components/call-mode.tsx` — the button

## What it does

Logs **"Call: talked to someone, not the owner"** to the timeline and
schedules a callback task for **the next business day** — sooner than the
voicemail rule's two days, because a gatekeeper usually knows the owner's
rhythm and the rep just heard it. Friday and Saturday both roll to Monday.

The notes placeholder now prompts for what the gatekeeper actually said —
the owner's name and when they are in — since that is the thing worth keeping
from this kind of call.

## Note

If the gatekeeper gave a specific time, **use "Callback later"** instead: that
opens the slot picker and puts the real time on the calendar. "Talked to someone"
is for when you learned who and roughly when, but not a firm slot.

## Check

```
npx tsc --noEmit
```
