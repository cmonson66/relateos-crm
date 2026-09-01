/**
 * Reviewer preview: the whole arc, for red-penning.
 *
 *   # 28 emails - one test shop per cluster, full copy coverage (default)
 *   npx tsx scripts/review-emails.ts tim@blockchainmint.com you@example.com
 *
 * Pass as many addresses as you like. They go on one message, so everyone
 * gets 28 emails rather than 28 each, and the recipients can see each other
 * in the To line. Run it once per address if that matters.
 *
 *   # 142 emails - one test shop per vertical, mostly duplicates
 *   npx tsx scripts/review-emails.ts tim@blockchainmint.com --per-vertical
 *
 *   # write a single annotated HTML file instead of sending
 *   npx tsx scripts/review-emails.ts --html review.html
 *
 *   # print to the terminal, sends nothing, needs no key
 *   npx tsx scripts/review-emails.ts --dry
 *
 * WHY PER-CLUSTER IS THE DEFAULT. renderEmail() branches on CLUSTER, not on
 * vertical. Two shops in the same cluster get byte-identical copy apart from
 * the shop name and city, and vertical_label is never rendered at all. So the
 * 24 verticals collapse to 5 distinct arcs and 28 distinct emails. Sending all
 * 142 puts 114 duplicates in the reviewer's inbox and buries the 28 things he
 * is actually meant to read.
 *
 * Every send carries a header naming the cluster and listing the verticals it
 * covers, so per-cluster still shows complete coverage.
 *
 * Touches no lead rows, records no run, and the shops are invented - the pulse
 * token is a throwaway, so a click can never write engagement rows against a
 * real merchant.
 */

import { writeFileSync } from 'node:fs';
import {
  renderEmail,
  maxStageFor,
  CLUSTER_MAP,
  type Cluster,
  type Stage,
} from '@/lib/campaigns/templates';

const FROM_DOMAIN = 'go.nectarpayaz.com';
const FROM_LABEL = 'NectarPay AZ';
const PULSE_BASE = 'https://nectarpayaz.com';
const PHYSICAL_ADDRESS = '2716 W Trapanotto Rd. Phoenix, AZ 85086';
const REP = { first: 'Eric', fromEmail: 'eric@nectarpayaz.com' };
const PREVIEW_TOKEN = 'preview-not-a-real-token';

type Lead = Parameters<typeof renderEmail>[1];

/** An invented shop for each vertical. None of these exist. */
const SHOPS: Record<string, { name: string; city: string; owner: string }> = {
  'food-drink':     { name: "Rosita's Kitchen",          city: 'Peoria',     owner: 'Marisol' },
  'barber':         { name: 'Ironline Barbers',          city: 'Glendale',   owner: 'Terrence' },
  'nail-beauty':    { name: 'Lotus Nail Studio',         city: 'Chandler',   owner: 'Kim' },
  'tattoo':         { name: 'Saguaro Ink',               city: 'Tempe',      owner: 'Rae' },
  'sneaker-street': { name: 'Grail Room Sneakers',       city: 'Phoenix',    owner: 'Andre' },
  'collectibles':   { name: 'Copper Cactus Collectibles', city: 'Mesa',      owner: 'Doug' },
  'gaming':         { name: 'Respawn Game Exchange',     city: 'Gilbert',    owner: 'Priya' },
  'thrift-vintage': { name: 'Second Sun Vintage',        city: 'Phoenix',    owner: 'Nadia' },
  'jewelry-gold':   { name: 'Verde Fine Jewelers',       city: 'Scottsdale', owner: 'Elena' },
  'auto':           { name: 'Ironwood Auto Works',       city: 'Chandler',   owner: 'Rick' },
  'powersports':    { name: 'Dune Line Powersports',     city: 'Surprise',   owner: 'Wes' },
  'med-spa':        { name: 'Aurelia Med Spa',           city: 'Scottsdale', owner: 'Dr. Ruiz' },
  'pool-landscape': { name: 'Bluewater Pool & Yard',     city: 'Goodyear',   owner: 'Manny' },
  'liquor':         { name: 'Roadrunner Fine Wine',      city: 'Phoenix',    owner: 'Sal' },
  'bike':           { name: 'South Rim Bicycles',        city: 'Tempe',      owner: 'Josie' },
  'phone-repair':   { name: 'Valley Phone & PC Repair',  city: 'Mesa',       owner: 'Dev' },
  'gym-supps':      { name: 'Foundry Strength & Supps',  city: 'Gilbert',    owner: 'Coach Ellis' },
  'smoke-vape':     { name: 'Cactus Smoke Shop',         city: 'Phoenix',    owner: 'Omar' },
  'kava-kratom':    { name: 'Root & Kava Lounge',        city: 'Tempe',      owner: 'Bex' },
  'cigar-hookah':   { name: 'Ember Cigar Lounge',        city: 'Scottsdale', owner: 'Victor' },
  'firearms':       { name: 'Copper State Firearms',     city: 'Glendale',   owner: 'Dale' },
  'adult-retail':   { name: 'Midnight Boutique',         city: 'Phoenix',    owner: 'Cass' },
  'pawn':           { name: 'Sonoran Gold & Loan',       city: 'Phoenix',    owner: 'Hector' },
  'crypto-native':  { name: 'Desert Bit Trading Post',   city: 'Tempe',      owner: 'Alan' },
};

/** One representative vertical per cluster, for the default mode. */
const CLUSTER_PICK: Record<Cluster, string> = {
  crowd: 'food-drink',
  math: 'auto',
  simple: 'phone-repair',
  control: 'firearms',
  native: 'crypto-native',
};

const verticalsIn = (c: Cluster) =>
  Object.keys(CLUSTER_MAP).filter((v) => CLUSTER_MAP[v] === c);

const leadFor = (vertical: string): Lead => {
  const s = SHOPS[vertical];
  return {
    name: s.name,
    city: s.city,
    vertical,
    vertical_label: vertical,
    owner_first_name: s.owner,
    pulse_token: PREVIEW_TOKEN,
  };
};

/** A short banner above the copy so a reviewer knows what he is looking at. */
function banner(cluster: Cluster, vertical: string, stage: number, max: number, perVertical: boolean) {
  const covers = perVertical ? vertical : verticalsIn(cluster).join(', ');
  const lineOne = `PREVIEW - email ${stage} of ${max}, "${cluster}" cluster`;
  const lineTwo = perVertical ? `Vertical: ${covers}` : `Identical copy for: ${covers}`;
  const lineThree = 'Invented shop. Links go nowhere. Nothing was sent to a real merchant.';
  return {
    html:
      `<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#47566B;background:#F5F6F8;border-left:3px solid #C9820A;padding:10px 12px;margin:0 0 18px;max-width:560px">` +
      `<b>${lineOne}</b><br>${lineTwo}<br>${lineThree}</div>`,
    text: `${lineOne}\n${lineTwo}\n${lineThree}\n\n${'-'.repeat(60)}\n\n`,
  };
}

type Item = { cluster: Cluster; vertical: string; stage: number; max: number; subject: string; html: string; text: string };

function build(perVertical: boolean): Item[] {
  const verticals = perVertical
    ? Object.keys(CLUSTER_MAP)
    : (Object.keys(CLUSTER_PICK) as Cluster[]).map((c) => CLUSTER_PICK[c]);

  const items: Item[] = [];
  for (const vertical of verticals) {
    const cluster = (CLUSTER_MAP[vertical] ?? 'math') as Cluster;
    const max = maxStageFor(cluster);
    const lead = leadFor(vertical);
    for (let stage = 1; stage <= max; stage++) {
      const r = renderEmail(stage as Stage, lead, PULSE_BASE, PHYSICAL_ADDRESS, REP);
      const b = banner(cluster, vertical, stage, max, perVertical);
      items.push({
        cluster,
        vertical,
        stage,
        max,
        subject: `[${cluster} e${stage}/${max}] ${r.subject}`,
        html: b.html + r.html,
        text: b.text + r.text,
      });
    }
  }
  return items;
}

function writeHtml(items: Item[], path: string) {
  const parts = items.map(
    (i, n) =>
      `<section style="page-break-after:always;border-bottom:2px solid #ddd;padding:28px 0">` +
      `<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#8a94a3;margin-bottom:6px">#${n + 1} of ${items.length}</div>` +
      `<div style="font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:700;color:#0C1A2C;margin-bottom:14px">Subject: ${i.subject}</div>` +
      i.html +
      `</section>`
  );
  writeFileSync(
    path,
    `<!doctype html><meta charset="utf-8"><title>NectarPay campaign copy for review</title>` +
      `<div style="max-width:680px;margin:0 auto;padding:24px">` +
      `<h1 style="font-family:Arial,Helvetica,sans-serif;font-size:22px;color:#0C1A2C">NectarPay campaign copy</h1>` +
      `<p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#47566B">${items.length} emails. Print to PDF to mark up.</p>` +
      parts.join('') +
      `</div>`,
    'utf8'
  );
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const perVertical = args.includes('--per-vertical');
  const htmlAt = args.indexOf('--html');
  const htmlPath = htmlAt >= 0 ? args[htmlAt + 1] : null;
  const to = args.filter((a) => a.includes('@') && !a.startsWith('--'));

  const items = build(perVertical);
  console.log(`${items.length} emails, ${perVertical ? 'one shop per vertical' : 'one shop per cluster'}.`);

  if (htmlPath) {
    writeHtml(items, htmlPath);
    console.log(`Wrote ${htmlPath}. Open it in a browser, print to PDF to mark up.`);
    return 0;
  }

  if (dry) {
    for (const i of items) console.log(`\n===== ${i.subject} =====\n\n${i.text}`);
    console.log(`\nDone. ${items.length} rendered, nothing sent.`);
    return 0;
  }

  if (to.length === 0) {
    console.error('Usage: npx tsx scripts/review-emails.ts someone@example.com [more@example.com ...] [--per-vertical]');
    console.error('   or: npx tsx scripts/review-emails.ts --html review.html');
    console.error('   or: npx tsx scripts/review-emails.ts --dry');
    return 1;
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error('RESEND_API_KEY is not set. Use $env:RESEND_API_KEY = "re_..." first,');
    console.error('or use --html / --dry, which need no key.');
    return 1;
  }

  const from = `${REP.first} at ${FROM_LABEL} <${REP.fromEmail.split('@')[0]}@${FROM_DOMAIN}>`;
  console.log(`Sending to: ${to.join(', ')}`);
  let sent = 0;
  let failed = 0;

  for (const i of items) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to,
          reply_to: REP.fromEmail,
          subject: i.subject,
          html: i.html,
          text: i.text,
        }),
      });
      if (!res.ok) {
        failed++;
        console.log(`  FAILED ${res.status}  ${i.subject}  ${await res.text()}`);
      } else {
        sent++;
        console.log(`  sent   ${i.subject}`);
      }
    } catch (err) {
      failed++;
      console.log(`  FAILED ${(err as Error).message}  ${i.subject}`);
    }
    await new Promise((r) => setTimeout(r, 700));
  }

  console.log(`\nDone. ${sent} sent, ${failed} failed, to ${to.join(', ')}.`);
  return failed > 0 ? 1 : 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (err) => {
    console.error(err);
    process.exitCode = 1;
  }
);
