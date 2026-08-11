import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/app/(app)/activities/actions";
import { addDays, phxMorningIso, phxToday } from "@/lib/db/trials";

/**
 * The Ambassador Playbook's post-sale rhythm: day 1, day 7, day 30, then
 * monthly. It was on paper only, which meant it happened when a rep
 * remembered. This puts it on the calendar the moment money lands.
 *
 * Each task carries WHAT THE CALL IS FOR, because "check in with Azul" three
 * weeks from now tells a rep nothing about what to say.
 */
const CADENCE: { day: number; subject: string; body: string }[] = [
  {
    day: 1,
    subject: "Day 1 check-in",
    body: "Did they take a real payment yet? Walk whoever is working the register through one if not. The first live payment is the moment the sale actually lands.",
  },
  {
    day: 7,
    subject: "Day 7 check-in",
    body: "Week one done. Anything not working? Anyone new on staff who needs a walkthrough? If they are happy, this is the moment to ask for the quote and the photo.",
  },
  {
    day: 30,
    subject: "Day 30 check-in",
    body: "A month in. Ask how many crypto sales they have run and what it has saved them. Then ask the referral question: who else do you know who would rather stop paying card fees?",
  },
];

/**
 * Idempotent by design: re-marking an invoice paid must not stack a second
 * set of tasks on the same deal.
 */
export async function schedulePostSaleCadence(input: {
  dealId: string;
  accountId: string;
  contactId: string | null;
  shopName: string;
}) {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("activities")
    .select("id")
    .eq("deal_id", input.dealId)
    .eq("type", "task")
    .ilike("subject", "Day 1 check-in%")
    .limit(1);

  if ((existing ?? []).length > 0) return { ok: true, created: 0 };

  const start = phxToday();
  let created = 0;

  for (const step of CADENCE) {
    await logActivity({
      type: "task",
      subject: `${step.subject}: ${input.shopName}`,
      body: step.body,
      account_id: input.accountId,
      contact_id: input.contactId,
      deal_id: input.dealId,
      scheduled_at: phxMorningIso(addDays(start, step.day)),
    });
    created += 1;
  }

  return { ok: true, created };
}
