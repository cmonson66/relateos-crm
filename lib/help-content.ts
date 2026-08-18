/**
 * In-app help, one entry per surface.
 *
 * Written for a rep in a parking lot, not for a manual: what this page is for,
 * the things people actually get wrong, and one thing to do when stuck. The
 * "gotchas" are the point - most of them exist because the app enforces a rule
 * that is not obvious from the screen (LIVE means paid, FIELD means the sender
 * skips it, a text is a touch not a door).
 *
 * Matching is longest-prefix, so /deals/[id] falls back to /deals.
 */
export type HelpTopic = {
  /** Route prefix this covers. */
  path: string;
  title: string;
  /** One or two sentences. What is this screen for. */
  what: string;
  /** The steps, in the order a rep would do them. */
  steps?: string[];
  /** The rules that are enforced but not visible. */
  gotchas?: string[];
  /** One concrete thing to do when stuck. */
  stuck?: string;
};

export const HELP: HelpTopic[] = [
  {
    path: "/dashboard",
    title: "Dashboard",
    what: "Today in one screen: what is on your calendar, what needs attention, and how the week is going.",
    steps: [
      "Work the TODAY list top down. Overdue items sit first on purpose.",
      "Check NEEDS ATTENTION before you leave the house - a signed agreement with no invoice is money you have agreed on and never asked for.",
      "Each row has a Sheet and a Send button so you can prep or follow up without opening the account.",
    ],
    gotchas: [
      "Everything is Phoenix time. An evening booking belongs to today, not tomorrow.",
      "Trials running counts terminals physically sitting in shops, not deals in progress.",
    ],
    stuck: "If a shop is missing from today, check the calendar - it may be booked on another day.",
  },
  {
    path: "/accounts",
    title: "Accounts",
    what: "Every shop in your book. The chips stack: pick a city, a band, and an owner and the counts update together.",
    steps: [
      "Filter down to what you are working, then use the header checkbox and Select all matching to act on the whole set.",
      "Open a shop to see where it sits in the email sequence, its Pulse page, and any signed agreements.",
      "Hit 🔗 Sync on a shop you added by hand so it picks up its map pin, band and crypto score.",
    ],
    gotchas: [
      "A shop added by hand is FIELD, which means the sender skips it. The CAMPAIGN panel on the account has a button to put it in the campaign if it is a genuinely cold lead.",
      "Bulk assign moves the shop AND its contacts. That is what the campaign reads when it decides whose name an email sends under.",
      "A red HOLD pill means the vertical is on compliance hold. Do not work it.",
    ],
    stuck: "If a shop has no map pin or band, it has never been synced. That is the 🔗 button.",
  },
  {
    path: "/call",
    title: "Call Mode",
    what: "The script for the shop in front of you, with their own numbers already in it.",
    steps: [
      "Work the stepper left to right: opener, hook, discovery, math, close.",
      "Drag the slider to their real monthly volume - the savings figure moves with it.",
      "Log what happened before you leave. The disposition writes the call and books the follow-up in one step.",
    ],
    gotchas: [
      "The objection drawer has the six you will actually hear. Open it rather than improvising.",
      "Booked visit and Callback both open a picker and schedule the thing properly.",
    ],
    stuck: "The 📄 Sheet button prints this shop's page if you would rather have it on paper.",
  },
  {
    path: "/send",
    title: "Send a message",
    what: "Ten written messages for the situations that do not end in a sale, prefilled with the shop, the owner and your own signature.",
    steps: [
      "Pick the situation on the left, then Email, Text or Copy.",
      "Edit the draft. It is a starting point, not a script.",
      "Send as your own address sends it from the CRM and logs exactly what went out.",
    ],
    gotchas: [
      "Opening Gmail instead only records that you opened it, not that you sent it.",
      "Texts log as a touch, not a door knocked - that keeps the doors number honest.",
      "If the shop has no Pulse page, the line offering one is left out automatically.",
    ],
    stuck: "No sending address yet means your name@nectarpayaz.com alias has not been created.",
  },
  {
    path: "/deals",
    title: "Deals",
    what: "Every shop that is going somewhere, from first interest to paid and live.",
    steps: [
      "Add what they are getting - the terminal, the membership - and the deal value fills itself in.",
      "Trial: sign the trial agreement, and the check-in tasks appear on your calendar.",
      "Buying: sign the purchase agreement, create the invoice, send it, then mark it paid.",
    ],
    gotchas: [
      "A deal only reaches LIVE when its invoice is PAID. You cannot drag it there.",
      "Signing is not selling. Your bonus counts the week the money lands.",
      "The deal value comes from the line items. There is nothing to type.",
      "Put the terminal serial on the line item and inventory records where that unit went.",
    ],
    stuck: "Stuck at signed with nothing happening? You still need to create and send the invoice.",
  },
  {
    path: "/terminals",
    title: "Inventory",
    what: "Every piece of equipment, where it is, and how long it has been there.",
    steps: [
      "Paste the serials from a shipment into Receive stock.",
      "Assign a unit to whoever is carrying it.",
      "When a trial unit comes back, mark it Came back so it returns to stock.",
    ],
    gotchas: [
      "Units go to a shop automatically when a serial is typed on a deal line item.",
      "Damaged and Lost do not return to stock, on purpose.",
      "Tick the boxes to remove units you typed wrong. A unit sitting in a shop cannot be removed until you mark it came back, damaged or lost.",
    ],
    stuck: "A serial you never received still records itself when it is used on a deal.",
  },
  {
    path: "/earnings",
    title: "Earnings",
    what: "What you have sold this week and what it pays.",
    steps: [
      "The bar shows where the week stands against the bonus brackets.",
      "The line underneath tells you what your next sale is worth right now.",
    ],
    gotchas: [
      "The ladder resets Monday and is not retroactive - each sale pays the bracket it lands in.",
      "Sales 1 to 5 pay no bonus. Base covers you until then.",
      "A sale counts the week its invoice is PAID, not the week it was signed.",
    ],
  },
  {
    path: "/calendar",
    title: "Calendar",
    what: "Visits, callbacks, installs and tasks in one place, all Phoenix time.",
    steps: [
      "Tap an event to reschedule it, mark it done, or cancel.",
      "Every event links straight to the shop.",
    ],
    gotchas: [
      "On a computer you can drag events between days. On a phone use the pencil.",
      "Merchants get their own reminder the morning of a booked visit, so cancel rather than ignore.",
    ],
  },
  {
    path: "/playbook",
    title: "Playbook",
    what: "The script, the one-pager, and printable kits for the shops you are visiting.",
    steps: [
      "Print a kit before you go out. Each shop gets its sheet and a one-pager.",
      "The blank kit is three one-pagers for cold walking.",
      "Setting them up walks the whole install: the coin, the wallet, the merchant account, which coins they take.",
    ],
    gotchas: [
      "The one-pager carries your own name, cell and email, so print your own.",
      "On an install: the coin IS the money. Lose it and the backup and nobody can recover the funds. Say that out loud before you start, not after.",
      "Wallets and Chains saves ONE coin at a time. Toggle, save, repeat - it does not save them together.",
    ],
  },
  {
    path: "/campaigns",
    title: "Campaign",
    what: "The cold email engine: who it emails, how many a day, and what has gone out.",
    steps: [
      "Preview today before you change anything - it shows exactly who would be emailed.",
      "Who gets emailed controls the pool. Assigned accounts only is the safe default.",
    ],
    gotchas: [
      "The daily cap is for the whole team, not per rep. It is split evenly across reps.",
      "The cap ramps up slowly on purpose. Rushing it lands the whole domain in spam.",
      "Shops on compliance hold are never emailed, whatever else is set.",
    ],
    stuck: "A shop that will not send is usually FIELD status or has no email address.",
  },
  {
    path: "/import",
    title: "Import",
    what: "Bring a list of shops in from a spreadsheet.",
    steps: [
      "Download the template if you are unsure of the columns.",
      "Check the preview - it tells you what already exists and will not be duplicated.",
      "Run the sync at the end so the shops pick up their pins and scores.",
    ],
    gotchas: [
      "An imported list is field work by default and is not emailed unless you tick the campaign box.",
      "Everything you import is owned by you.",
    ],
  },
  {
    path: "/map",
    title: "Map",
    what: "Your territory as a picture, with crypto density underneath.",
    steps: [
      "Near me puts a blue dot where you are standing and keeps it updated while you drive. Once you allow it the first time, the map opens on your 3 mile view from then on.",
      "With the dot showing, tap 1, 3 or 10 miles to cut the map down to what is actually reachable.",
      "Tap the same distance again to go back to your whole book.",
    ],
    gotchas: [
      "The heat layer is where crypto is already being spent, not where your shops are.",
      "Distances are straight line, not driving miles - close enough to pick the next stop, not a route.",
      "If you block the location prompt it stays blocked. Turn it back on in your browser settings for this site.",
    ],
  },
];

export function helpFor(pathname: string): HelpTopic | null {
  const matches = HELP.filter((h) => pathname.startsWith(h.path));
  if (matches.length === 0) return null;
  // longest prefix wins, so /deals/[id] still resolves to /deals
  return matches.sort((a, b) => b.path.length - a.path.length)[0];
}
