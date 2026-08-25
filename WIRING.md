# Adding the XIT21 tab to the Playbook

One new file, three small edits to `app/(app)/playbook/_components/playbook-view.tsx`.
The tab id is `xit21`, matching the existing `home` / `script` / `setup` / `onepager` / `kit`.

---

## 1. The import

Find the other component imports near the top and add:

```tsx
import { Xit21Guide } from './xit21-guide';
```

The icon is already available from lucide-react. Add `MapPin` to the existing
lucide import if it is not there:

```tsx
import { ..., MapPin } from 'lucide-react';
```

---

## 2. The menu entry

Find the menu array - the one containing this line:

```tsx
['setup', 'Setting them up', 'The install, start to finish. Wallet, merchant account, coins, share link.', Wrench],
```

Add directly beneath it:

```tsx
            ['xit21', 'XIT21', 'Get them on the crypto map, and the register on their terminal.', MapPin],
```

---

## 3. The panel

Find where the other tabs render, e.g.:

```tsx
{tab === 'setup' && ( ... )}
```

Add alongside them:

```tsx
      {tab === 'xit21' && <Xit21Guide />}
```

---

## Print

The guide carries `id="xit21"` on its root, which is what the Playbook's print
support keys on - the same fix that was needed for the setup and First Week
tabs. Nothing further to do.

## Check

`npx tsc --noEmit`, then open the Playbook and confirm the tab appears, renders,
and prints.
