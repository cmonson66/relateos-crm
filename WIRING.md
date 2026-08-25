# XIT21 in the Playbook

Everything is in the zip - no hand-editing this time.

Unzipping overwrites `playbook-view.tsx` with the same file you sent me plus
the XIT21 tab wired in, and adds:

- `app/(app)/playbook/_components/xit21-guide.tsx` — the tab
- `public/xit21-onepager.pdf` — the printable sheet, at `/xit21-onepager.pdf`

## What changed in playbook-view.tsx

1. `import { Xit21Guide } from './xit21-guide';`
2. `Signpost` added to the lucide import
3. `'xit21'` added to the tab union type
4. Menu entry between "Setting them up" and "Print a kit"
5. Heading case: GET THEM ON **THE MAP**
6. `{tab === 'xit21' && <Xit21Guide />}`
7. The Print button is hidden on this tab, the same way it is on the kit tab —
   its printable version is the PDF it links to, and printing the dark
   on-screen cards would burn a cartridge for a worse sheet.

Nothing else was touched. Everything else in the file is byte-identical to
what you sent.

## Then

```
npx tsc --noEmit
git add -A
git commit -m "XIT21 tab in the Playbook"
git push
```

Open the Playbook: XIT21 sits fifth in the menu, opens with a
"Print the one-pager" button, and the PDF link works.
