# Call outcome: "Talked to someone"

Two files. Unzip, commit, push. No migration.

## What happens

Tap **Talked to someone** and a field opens: **who answered?** Type a name and
tap Log, or press Enter.

- With a name: the timeline reads **"Call: talked to Maria, not the owner"**,
  and the follow-up task reads **"Call back: ask for the owner (Maria answered)"**
- Without one: **"Call: talked to someone, not the owner"** — the name is
  optional, so a rep who did not catch it is not blocked

Either way a callback task lands on **the next business day**. Friday and
Saturday both roll to Monday.

## Why the name matters

It is most of what a first dial produces. "Ask for Maria" on the second call
is a different conversation from starting cold again — and without somewhere to
put it, that detail lives in a notes box nobody reads, or nowhere.

## Note

If you got a specific time, use **Callback later** instead — that opens the
slot picker and puts a real appointment on the calendar.

## Check

```
npx tsc --noEmit
```
