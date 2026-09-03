/**
 * What a new rep does in their first five days.
 *
 * Written from what actually went wrong on the first real walk-in: the rep
 * knew the product but had not said it out loud to anyone, so the shop got a
 * hesitant version. The order below fixes that - talk before you sell, and
 * get the paperwork wrong somewhere safe first.
 */

const DAYS: { day: string; title: string; items: string[] }[] = [
  {
    day: "Day 1",
    title: "Learn the thing you are selling",
    items: [
      "Read The script end to end, then say the 30-second version out loud until it stops sounding memorized.",
      "Open a shop in your book and tap Start call. Work the stepper with nobody on the phone.",
      "Print one kit for a shop you plan to visit so you know what the packet feels like.",
      "Check your own email alias works: open Send on any shop and send yourself the owner-absent template.",
    ],
  },
  {
    day: "Day 2",
    title: "Walk in somewhere that does not matter",
    items: [
      "Pick three shops off the map that are not your best prospects. Buy something, ask one question, leave.",
      "You are practicing the opener, not selling. If the owner is out, leave a one-pager and log it.",
      "Log every stop in the app the same day. Doors worked only counts what you record.",
    ],
  },
  {
    day: "Day 3",
    title: "Run the numbers in front of someone",
    items: [
      "Open Call Mode on a real prospect and slide their monthly volume while they watch.",
      "Say the sentence plainly: no percentage comes out of a crypto sale, and the money is in your wallet before they leave.",
      "If they want to think, send the Talked, no decision template before you get back in the truck.",
    ],
  },
  {
    day: "Day 4",
    title: "Practice the paperwork on a fake shop",
    items: [
      "Create a test shop and put a deal on it. Add the terminal and the membership under What they are getting.",
      "Sign a trial agreement on your own phone. Watch the email arrive and open the copy link.",
      "Then do the purchase side: sign, create the invoice, send it, mark it paid. Confirm the deal lands in LIVE.",
      "Delete the test deal when you are done. Getting this wrong on a real merchant is the one mistake that costs you trust.",
    ],
  },
  {
    day: "Day 5",
    title: "Work your book like it is week ten",
    items: [
      "Five new conversations, three follow-ups, one demo. That is the weekly rhythm from here on.",
      "Book your next week before you finish this one. An empty calendar on Monday is a slow week.",
      "Check Earnings. Sales one to five pay no bonus, so the sixth is where the week starts paying.",
    ],
  },
];

const TRUTHS: string[] = [
  "A shop that says no today is a shop you call in three months, not a shop you delete.",
  "The owner is the only person who can say yes. Everyone else can only say no.",
  "Never promise a CryptoPop listing. It is in development, and the terminal pays for itself on fees either way.",
  "\"No percentage\" means no cut of the sale. It does not mean free to reach a bank - an off-ramp runs about a percent. Say it before they find it.",
  "If you do not know an answer, say so and find out. Guessing at a merchant is how a deal dies quietly.",
  "Log it the same day. A perfect memory of Tuesday is worth nothing to anyone else.",
];

export function FirstWeek() {
  return (
    <div id="playbook" className="mx-auto max-w-3xl">
      <p className="mb-6 text-[15px] leading-relaxed text-muted-foreground">
        Five days to go from knowing nothing to working a book properly. Do them in order. The
        point of the early days is to get the awkward version out of your system somewhere it
        does not cost you a sale.
      </p>

      <div className="space-y-4">
        {DAYS.map((d) => (
          <div key={d.day} className="rounded-md border border-border/40 p-5">
            <div className="mb-1 flex items-baseline gap-3">
              <span className="font-display text-sm tracking-[0.15em] text-primary">{d.day}</span>
              <h3 className="font-display text-lg tracking-wider">{d.title}</h3>
            </div>
            <ul className="mt-3 space-y-2.5">
              {d.items.map((i) => (
                <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed">
                  <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                  <span>{i}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-md border border-amber-500/35 bg-amber-500/[0.06] p-5">
        <h3 className="mb-3 font-display text-lg tracking-wider">Five things that stay true</h3>
        <ul className="space-y-2.5">
          {TRUTHS.map((t) => (
            <li key={t} className="flex gap-2.5 text-[14px] leading-relaxed">
              <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-6 text-[13px] text-muted-foreground">
        The <span className="font-bold">?</span> in the top bar explains whatever page you are on,
        including the rules that are easy to trip over. Use it rather than guessing.
      </p>
    </div>
  );
}
