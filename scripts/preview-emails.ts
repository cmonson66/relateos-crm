/**
 * Preview the campaign in a real inbox.
 *
 * Renders the full arc for three sample shops through the SAME renderEmail()
 * the cron uses, and mails each one to a single address so the copy can be
 * read the way a merchant reads it.
 *
 *   npx tsx --env-file=.env.local scripts/preview-emails.ts you@example.com
 *   npx tsx scripts/preview-emails.ts you@example.com --dry
 *
 * NO SUPABASE. An earlier version read the sending identity out of
 * campaign_settings, which fails in this repo: .env.local points at the
 * ProtoSeq project and the campaign tables live in the NectarPay one. The
 * settings below are copied from that row instead, so the only thing this
 * needs is RESEND_API_KEY - already in .env.local for the CRM's transactional
 * mail, so there is nothing to set up.
 *
 * --dry needs no key and no env file at all: it prints the emails and sends
 * nothing.
 *
 * TWO THINGS THIS DELIBERATELY DOES NOT DO.
 *
 * It touches no lead rows and records no run. It is a renderer with a stamp
 * on it, not a campaign run.
 *
 * And the sample shops carry a throwaway pulse token, never a real one. A
 * preview that used a live token would write view and intent rows against a
 * real merchant the moment anyone clicked, quietly poisoning the engagement
 * data the arc is tuned on. These links will 404 at the Pulse page. That is
 * correct: check the copy here, check the Pulse page separately.
 */

import {
  renderEmail,
  maxStageFor,
  CLUSTER_MAP,
  type Cluster,
  type Stage,
} from '@/lib/campaigns/templates';

/** Copied from the Phoenix campaign_settings row. */
const FROM_DOMAIN = 'go.nectarpayaz.com';
const FROM_LABEL = 'NectarPay AZ';
const PULSE_BASE = 'https://nectarpayaz.com';
const PHYSICAL_ADDRESS = '2716 W Trapanotto Rd. Phoenix, AZ 85086';

const REP = { first: 'Eric', fromEmail: 'eric@nectarpayaz.com' };
const PREVIEW_TOKEN = 'preview-not-a-real-token';

type Lead = Parameters<typeof renderEmail>[1];

const SAMPLES: { label: string; lead: Lead }[] = [
  {
    label: 'Restaurant',
    lead: {
      name: "Rosita's Kitchen",
      city: 'Peoria',
      vertical: 'food-drink',
      vertical_label: 'Food & drink',
      owner_first_name: 'Marisol',
      pulse_token: PREVIEW_TOKEN,
    },
  },
  {
    label: 'Phone / computer repair',
    lead: {
      name: 'Valley Phone & PC Repair',
      city: 'Mesa',
      vertical: 'phone-repair',
      vertical_label: 'Phone repair',
      owner_first_name: 'Dev',
      pulse_token: PREVIEW_TOKEN,
    },
  },
  {
    label: 'Crypto-native',
    lead: {
      name: 'Desert Bit Trading Post',
      city: 'Tempe',
      vertical: 'crypto-native',
      vertical_label: 'Crypto-native',
      owner_first_name: 'Alan',
      pulse_token: PREVIEW_TOKEN,
    },
  },
];

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const to = args.find((a) => a.includes('@'));

  if (!to) {
    console.error('Usage: npx tsx --env-file=.env.local scripts/preview-emails.ts you@example.com [--dry]');
    return 1;
  }

  const key = process.env.RESEND_API_KEY;
  if (!dry && !key) {
    console.error('RESEND_API_KEY is not set.');
    console.error('Pass --env-file=.env.local, or add --dry to print without sending.');
    return 1;
  }

  const from = `${REP.first} at ${FROM_LABEL} <${REP.fromEmail.split('@')[0]}@${FROM_DOMAIN}>`;
  let sent = 0;
  let failed = 0;

  for (const { label, lead } of SAMPLES) {
    const cluster = (CLUSTER_MAP[lead.vertical] ?? 'math') as Cluster;
    const max = maxStageFor(cluster);
    console.log(`\n${label} - cluster "${cluster}", ${max} emails`);

    for (let stage = 1; stage <= max; stage++) {
      const r = renderEmail(stage as Stage, lead, PULSE_BASE, PHYSICAL_ADDRESS, REP);
      const subject = `[e${stage} - ${lead.name}] ${r.subject}`;

      if (dry) {
        console.log(`\n===== e${stage} =====\nSubject: ${subject}\n\n${r.text}\n`);
        sent++;
        continue;
      }

      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from,
            to,
            reply_to: REP.fromEmail,
            subject,
            html: r.html,
            text: r.text,
          }),
        });

        if (!res.ok) {
          failed++;
          console.log(`  e${stage}  FAILED  ${res.status} ${await res.text()}`);
        } else {
          sent++;
          console.log(`  e${stage}  sent    ${r.subject}`);
        }
      } catch (err) {
        failed++;
        console.log(`  e${stage}  FAILED  ${(err as Error).message}`);
      }

      // Resend's default limit is 2/sec. Stay well under it.
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
  }

  console.log(
    dry
      ? `\nDone. ${sent} rendered, nothing sent.`
      : `\nDone. ${sent} sent, ${failed} failed, to ${to}.`
  );
  if (!dry) console.log('No lead rows were touched and no campaign run was recorded.');
  return failed > 0 ? 1 : 0;
}

// Set the code and let the process end on its own. Calling process.exit() here
// aborts tsx on Windows with a libuv assertion before stdout has drained.
main().then(
  (code) => {
    process.exitCode = code;
  },
  (err) => {
    console.error(err);
    process.exitCode = 1;
  }
);
