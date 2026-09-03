-- ===========================================================================
-- Call-script review surface.
--
-- Two tables and three security-definer RPCs. Same trust model the rest of
-- this app already uses for merchant-facing pages (/agreement, /setup,
-- /start): the token in the URL is the credential, the tables themselves stay
-- closed, and every read and write goes through a function.
--
-- BE CLEAR ABOUT WHAT THIS IS. A capability link is not authentication.
-- Anyone holding the URL is in, so the protections that matter here are that
-- the tokens are long and random, each one is bound to a named person, each
-- can be switched off on its own, and every edit records which token made it.
-- If the link leaks, flip `active` to false and the link is dead.
-- ===========================================================================

create table if not exists script_review_tokens (
  token       text primary key,
  label       text not null,
  can_edit    boolean not null default true,
  active      boolean not null default true,
  expires_at  timestamptz,
  created_at  timestamptz not null default now(),
  last_seen_at timestamptz
);

create table if not exists script_review_blocks (
  id          uuid primary key default gen_random_uuid(),
  block_key   text unique not null,
  section     text not null,
  cluster     text,
  label       text not null,
  help        text not null default '',
  original    text not null,
  value       text,
  note        text,
  sort_index  int not null default 0,
  updated_at  timestamptz,
  updated_by  text
);

-- The activity feed. Lets the other person see what changed and when without
-- diffing the whole document.
create table if not exists script_review_log (
  id         bigserial primary key,
  block_key  text not null,
  label      text not null,
  who        text not null,
  at         timestamptz not null default now()
);

create index if not exists script_review_log_at_idx on script_review_log (at desc);

alter table script_review_tokens enable row level security;
alter table script_review_blocks enable row level security;
alter table script_review_log    enable row level security;
-- No policies on purpose. Nothing reaches these tables except the service role
-- and the security-definer functions below.

-- --------------------------------------------------------------------------
-- Resolve a token, or null. Also stamps last_seen_at so you can tell whether
-- Tim has actually opened it.
-- --------------------------------------------------------------------------
create or replace function review_viewer(p_token text)
returns script_review_tokens
language plpgsql security definer set search_path = public as $$
declare v script_review_tokens;
begin
  select * into v from script_review_tokens
  where token = p_token and active
    and (expires_at is null or expires_at > now());
  if not found then return null; end if;

  update script_review_tokens set last_seen_at = now() where token = p_token;
  return v;
end $$;

-- --------------------------------------------------------------------------
-- Everything the page needs in one call.
-- --------------------------------------------------------------------------
create or replace function review_load(p_token text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v script_review_tokens; result jsonb;
begin
  v := review_viewer(p_token);
  if v.token is null then return null; end if;

  select jsonb_build_object(
    'viewer',   v.label,
    'can_edit', v.can_edit,
    'blocks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', block_key, 'section', section, 'cluster', cluster,
        'label', label, 'help', help, 'original', original,
        'value', coalesce(value, original), 'note', note,
        'edited', value is not null and value is distinct from original,
        'updated_at', updated_at, 'updated_by', updated_by
      ) order by sort_index)
      from script_review_blocks
    ), '[]'::jsonb),
    'log', coalesce((
      select jsonb_agg(jsonb_build_object('label', label, 'who', who, 'at', at) order by at desc)
      from (select * from script_review_log order by at desc limit 40) t
    ), '[]'::jsonb)
  ) into result;

  return result;
end $$;

-- --------------------------------------------------------------------------
-- Save one block. Returns the row so the client can confirm.
--
-- Writing the value back to exactly the original clears the override rather
-- than storing a redundant copy, which is what makes "revert" honest and keeps
-- the edited-block count meaningful.
-- --------------------------------------------------------------------------
create or replace function review_save(p_token text, p_key text, p_value text, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v script_review_tokens; b script_review_blocks;
begin
  v := review_viewer(p_token);
  if v.token is null or not v.can_edit then return null; end if;

  select * into b from script_review_blocks where block_key = p_key;
  if not found then return null; end if;

  update script_review_blocks
  set value      = case when p_value = original then null else p_value end,
      note       = coalesce(p_note, note),
      updated_at = now(),
      updated_by = v.label
  where block_key = p_key
  returning * into b;

  insert into script_review_log (block_key, label, who) values (b.block_key, b.label, v.label);

  return jsonb_build_object(
    'key', b.block_key,
    'value', coalesce(b.value, b.original),
    'edited', b.value is not null and b.value is distinct from b.original,
    'updated_at', b.updated_at,
    'updated_by', b.updated_by
  );
end $$;

-- --------------------------------------------------------------------------
-- Poll: only what changed since the client last looked.
-- --------------------------------------------------------------------------
create or replace function review_since(p_token text, p_since timestamptz)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v script_review_tokens;
begin
  v := review_viewer(p_token);
  if v.token is null then return null; end if;

  return jsonb_build_object(
    'now', now(),
    'blocks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', block_key, 'value', coalesce(value, original),
        'edited', value is not null and value is distinct from original,
        'updated_at', updated_at, 'updated_by', updated_by))
      from script_review_blocks
      where updated_at is not null and updated_at > p_since
    ), '[]'::jsonb),
    'log', coalesce((
      select jsonb_agg(jsonb_build_object('label', label, 'who', who, 'at', at) order by at desc)
      from script_review_log where at > p_since
    ), '[]'::jsonb)
  );
end $$;

revoke all on function review_viewer(text) from public, anon, authenticated;
grant execute on function review_load(text)                        to anon, authenticated;
grant execute on function review_save(text, text, text, text)      to anon, authenticated;
grant execute on function review_since(text, timestamptz)          to anon, authenticated;

-- --------------------------------------------------------------------------
-- The two links. Revoke either one on its own:
--   update script_review_tokens set active = false where label = 'Tim';
-- --------------------------------------------------------------------------
insert into script_review_tokens (token, label, can_edit, expires_at) values
  ('n4URjA5Rvy5EJHyIq52legz7_OXJA_dq', 'Tim',  true, now() + interval '30 days'),
  ('ps1e2OryN4PtSNOZmb8v5vkDa3AbGFT-', 'Chad', true, now() + interval '30 days')
on conflict (token) do nothing;

insert into script_review_blocks (block_key, section, cluster, label, help, original, sort_index)
values
  ('arc.phone.0.goal', 'Phone arc', null, 'Opener', 'What this step has to achieve.', 'Ten seconds. Earn the next thirty.', 0),
  ('arc.phone.1.goal', 'Phone arc', null, 'Hook', 'What this step has to achieve.', 'One reason to keep listening, matched to their shop.', 1),
  ('arc.phone.2.goal', 'Phone arc', null, 'Discovery', 'What this step has to achieve.', 'Their numbers, in their words. Write them down.', 2),
  ('arc.phone.3.goal', 'Phone arc', null, 'The math', 'What this step has to achieve.', 'Say it out loud with their number, not yours.', 3),
  ('arc.phone.4.goal', 'Phone arc', null, 'Close', 'What this step has to achieve.', 'One clear ask. Trial beats everything.', 4),
  ('arc.door.0.goal', 'Door arc', null, 'Be a customer', 'What this step has to achieve.', 'Buy something first. Off-peak, never mid-rush.', 5),
  ('arc.door.1.goal', 'Door arc', null, 'Open warmly', 'What this step has to achieve.', 'A neighbor, not a pitch. No product yet.', 6),
  ('arc.door.2.goal', 'Door arc', null, 'Discover', 'What this step has to achieve.', 'How do they take payments today? Let them describe it.', 7),
  ('arc.door.3.goal', 'Door arc', null, 'Listen back', 'What this step has to achieve.', 'Talk under half the time. Repeat their words to them.', 8),
  ('arc.door.4.goal', 'Door arc', null, 'Diagnose', 'What this step has to achieve.', 'Name what the status quo costs. Let it land.', 9),
  ('arc.door.5.goal', 'Door arc', null, 'Show, then ask', 'What this step has to achieve.', 'Now demo. One small next step before you leave.', 10),
  ('shared.opener', 'Opener', null, 'Phone opener', 'First ten seconds. Same for every cluster.', '"Hey, is this {owner}? ... {owner}, my name''s {rep}, I''m here in the Valley - I work with shops around {city} and I''ll keep this to thirty seconds. Is now terrible?"', 11),
  ('shared.openerHint.0', 'Opener', null, 'Opener note 1', 'Coaching note under the opener, never spoken.', 'If "who is this?" - "{rep} with NectarPay. There''s a customer walking into shops like yours who can''t pay the way they want. Thirty seconds and you can hang up on me."', 12),
  ('shared.openerHint.1', 'Opener', null, 'Opener note 2', 'Coaching note under the opener, never spoken.', 'Why "is now terrible": "no" is easier to say than "yes" - let them say no and keep the floor.', 13),
  ('shared.discovery.0.q', 'Discovery', null, 'Question 1', 'Answer box hint: yes / no / weekly', '"Anybody ever ask to pay with crypto at the register?"', 14),
  ('shared.discovery.1.q', 'Discovery', null, 'Question 2', 'Answer box hint: pays cash / leaves', '"When they do, what happens - do they pay another way, or do they leave?"', 15),
  ('shared.discovery.2.q', 'Discovery', null, 'Question 3', 'Answer box hint: $12,000', '"Roughly what''s going through the card reader a month?"', 16),
  ('shared.discovery.3.q', 'Discovery', null, 'Question 4', 'Answer box hint: Square', '"Who''s your processor now - Square, Clover... ?"', 17),
  ('shared.close.0.title', 'Closes', null, 'Close 1 - title', 'Shown as the card heading.', '① The walk-in (best)', 18),
  ('shared.close.0.script', 'Closes', null, 'Close 1 - script', 'What the rep says.', '"I''m working {city} this week - ten minutes at your shop, I''ll run a live payment and you watch it settle. Morning or afternoon better?"', 19),
  ('shared.close.1.title', 'Closes', null, 'Close 2 - title', 'Shown as the card heading.', '② The one-pager text', 20),
  ('shared.close.1.script', 'Closes', null, 'Close 2 - script', 'What the rep says.', '"Let me text you the one-page version - everything including pricing. What''s the best cell?"', 21),
  ('shared.close.1.note', 'Closes', null, 'Close 2 - note', 'Coaching note, not spoken.', 'Then send the PNG + their Pulse link.', 22),
  ('shared.close.2.title', 'Closes', null, 'Close 3 - title', 'Shown as the card heading.', '③ The card link', 23),
  ('shared.close.2.script', 'Closes', null, 'Close 3 - script', 'What the rep says.', '"I''ll text you a page I set up for {shop} specifically - slide your own numbers, takes thirty seconds."', 24),
  ('shared.close.3.title', 'Closes', null, 'Close 4 - title', 'Shown as the card heading.', '④ The trial', 25),
  ('shared.close.3.script', 'Closes', null, 'Close 4 - script', 'What the rep says.', '"Here''s what I''d rather do. Let me put one in for a trial - costs you nothing while it runs, no $499, no monthly. Take real payments on it. If it earns its place you keep it, if it doesn''t I come get it. Fair?"', 26),
  ('shared.close.3.note', 'Closes', null, 'Close 4 - note', 'Coaching note, not spoken.', 'Trial length is your call. A signed agreement goes in before the terminal does.', 27),
  ('shared.close.4.title', 'Closes', null, 'Close 5 - title', 'Shown as the card heading.', '⑤ The clean no', 28),
  ('shared.close.4.script', 'Closes', null, 'Close 5 - script', 'What the rep says.', '"No hard feelings - if the fees ever start stinging, you''ve got my number."', 29),
  ('shared.close.4.note', 'Closes', null, 'Close 5 - note', 'Coaching note, not spoken.', 'If they say never contact: mark DNC. We never call again.', 30),
  ('shared.objection.0.q', 'Objections', null, 'Objection 1 - what they say', 'Written the way an owner says it.', '"Yeah, we''re fine - everybody just uses their card."', 31),
  ('shared.objection.0.a', 'Objections', null, 'Objection 1 - the answer', 'What the rep says back.', '"And they''ll keep doing that - nothing about your card setup changes. Same reader, same flow. This adds a lane on the side, and every sale that uses it is a sale with no fee on it."', 32),
  ('shared.objection.1.q', 'Objections', null, 'Objection 2 - what they say', 'Written the way an owner says it.', '"I don''t know anything about crypto."', 33),
  ('shared.objection.1.a', 'Objections', null, 'Objection 2 - the answer', 'What the rep says back.', '"You don''t need to. Staff types the amount, customer scans, ten seconds, money''s in your wallet. You never touch an exchange, never hold anything you don''t want to. It''s a register that can''t be charged back."', 34),
  ('shared.objection.2.q', 'Objections', null, 'Objection 3 - what they say', 'Written the way an owner says it.', '"Crypto goes up and down - I''m not gambling with my money."', 35),
  ('shared.objection.2.a', 'Objections', null, 'Objection 3 - the answer', 'What the rep says back.', '"You pick what it lands in. Want dollars? Set it to a dollar-pegged coin - a dollar in is a dollar out, and you''re never holding anything that moves. Want to keep bitcoin? That''s your call too. It''s your wallet and your choice, not ours."', 36),
  ('shared.objection.3.q', 'Objections', null, 'Objection 4 - what they say', 'Written the way an owner says it.', '"How do I turn it into actual dollars?"', 37),
  ('shared.objection.3.a', 'Objections', null, 'Objection 4 - the answer', 'What the rep says back.', '"Same as moving money out of any account. Most owners set it to land in a dollar-pegged coin so there''s nothing to convert, then move it to their bank on whatever schedule they like - some sweep it Friday, some let it sit. It''s your money and your timing."', 38),
  ('shared.objection.4.q', 'Objections', null, 'Objection 5 - what they say', 'Written the way an owner says it.', '"What if you guys go out of business?"', 39),
  ('shared.objection.4.a', 'Objections', null, 'Objection 5 - the answer', 'What the rep says back.', '"Nothing happens to your money, and that''s the part worth hearing. We never hold it. It goes straight from your customer into a wallet you own, and that wallet is yours whether we exist or not. Worst case you lose the software and keep every dollar."', 40),
  ('shared.objection.5.q', 'Objections', null, 'Objection 6 - what they say', 'Written the way an owner says it.', '"What if my cashier rings up the wrong amount?"', 41),
  ('shared.objection.5.a', 'Objections', null, 'Objection 6 - the answer', 'What the rep says back.', '"Then you refund them out of your wallet, same as handing back cash. I''d rather say that now than have you find out at the register - crypto is final in both directions. Nobody can charge you back, and you can''t pull one back either. For most shops that''s the good side of the trade, but you should hear both halves from me."', 42),
  ('shared.objection.6.q', 'Objections', null, 'Objection 7 - what they say', 'Written the way an owner says it.', '"What do I tell my bookkeeper?"', 43),
  ('shared.objection.6.a', 'Objections', null, 'Objection 7 - the answer', 'What the rep says back.', '"It''s revenue, recorded like a card sale - the terminal keeps the record, date, amount, what came in, and your bookkeeper treats it like any other deposit. I''m not a tax guy and I won''t pretend to be, so if they want the fine print, that''s a question for your CPA."', 44),
  ('shared.objection.7.q', 'Objections', null, 'Objection 8 - what they say', 'Written the way an owner says it.', '"Is that even legal?"', 45),
  ('shared.objection.7.a', 'Objections', null, 'Objection 8 - the answer', 'What the rep says back.', '"Completely - it''s a payment method, same as cash or card. Sales get recorded on the terminal like any register, and your accountant treats it like revenue because it is revenue."', 46),
  ('shared.objection.8.q', 'Objections', null, 'Objection 9 - what they say', 'Written the way an owner says it.', '"What''s this gonna run me?"', 47),
  ('shared.objection.8.a', 'Objections', null, 'Objection 9 - the answer', 'What the rep says back.', '"$499 once for the terminal, then $24.99 a month for the membership, paid annually. Never a percentage of your sales - that''s the whole point. And it doesn''t take much to be worth it: about $2,220 a month in crypto sales covers year one, and about $830 a month every year after that. You don''t have to decide today either - I can put one in on a trial first and it costs you nothing while it runs."', 48),
  ('shared.objection.9.q', 'Objections', null, 'Objection 10 - what they say', 'Written the way an owner says it.', '"How much of my business is even going to use this?"', 49),
  ('shared.objection.9.a', 'Objections', null, 'Objection 10 - the answer', 'What the rep says back.', '"Fair question, and here''s the honest floor rather than a sales number. About $2,220 a month in crypto sales pays for year one. After that it''s about $830 a month - that''s a handful of customers a week. Everything past that is margin you keep, and you never pay a percentage on any of it."', 50),
  ('shared.objection.10.q', 'Objections', null, 'Objection 11 - what they say', 'Written the way an owner says it.', '"Sounds complicated."', 51),
  ('shared.objection.10.a', 'Objections', null, 'Objection 11 - the answer', 'What the rep says back.', '"It''s simpler than the card terminal you already use - type the amount, they scan, done. And if you''d rather not have another box at all, the NectarPay app runs right on your phone. You''d just be giving up the receipt printer and the rugged handheld."', 52),
  ('shared.objection.11.q', 'Objections', null, 'Objection 12 - what they say', 'Written the way an owner says it.', '"What if it breaks?"', 53),
  ('shared.objection.11.a', 'Objections', null, 'Objection 12 - the answer', 'What the rep says back.', '"One-year warranty. If it quits on its own, we replace it, full stop. If it gets thrown across the shop, that one''s on you - fair is fair. Thermal paper is the only thing you''d ever buy, and that''s a few dollars anywhere."', 54),
  ('shared.objection.12.q', 'Objections', null, 'Objection 13 - what they say', 'Written the way an owner says it.', '"What if something goes wrong and I need somebody?"', 55),
  ('shared.objection.12.a', 'Objections', null, 'Objection 13 - the answer', 'What the rep says back.', '"Standard membership is $24.99 and you''ve got me. If you want NectarPay picking up the phone directly, white-glove is $99 a month. Most shops start standard - you can move up any time."', 56),
  ('shared.objection.13.q', 'Objections', null, 'Objection 14 - what they say', 'Written the way an owner says it.', '"Can I try it first?"', 57),
  ('shared.objection.13.a', 'Objections', null, 'Objection 14 - the answer', 'What the rep says back.', '"Yes, and I''d rather you did. I can put a terminal in for a trial and it costs you nothing while it runs - no $499, no monthly, nothing. You take real payments on it. If it earns its place you keep it, and if it doesn''t I come get it and we shake hands. That''s the whole risk."', 58),
  ('shared.objection.14.q', 'Objections', null, 'Objection 15 - what they say', 'Written the way an owner says it.', '"How does this integrate with my POS?"', 59),
  ('shared.objection.14.a', 'Objections', null, 'Objection 15 - the answer', 'What the rep says back.', '"It doesn''t, and that''s on purpose. It''s a separate lane that sits beside your POS - we never touch your system, which is exactly why nothing about your current setup has to change. You ring the sale on your own POS under a payment type you set up once, same as you already do for a delivery app or a gift certificate. Ticket closes, inventory drops, the server gets credit, and it shows in your end-of-day report like any other sale. Two minutes to set up and I''ll do it with you at install."', 60),
  ('shared.objection.15.q', 'Objections', null, 'Objection 16 - what they say', 'Written the way an owner says it.', '"So how do I reconcile it at close-out?"', 61),
  ('shared.objection.15.a', 'Objections', null, 'Objection 16 - the answer', 'What the rep says back.', '"Same way you reconcile a delivery app. That payment type totals separately in your report, and it should match what came into your wallet that day. Every payment is timestamped and permanent, so there''s a record whether anybody looks or not. For what it''s worth on the books: crypto you take in is income at its dollar value the moment it lands, not when you cash out - but that one''s a question for your CPA, not me."', 62),
  ('shared.objection.16.q', 'Objections', null, 'Objection 17 - what they say', 'Written the way an owner says it.', '"Let me think about it."', 63),
  ('shared.objection.16.a', 'Objections', null, 'Objection 17 - the answer', 'What the rep says back.', '"Totally fair. Here''s what I''d rather do than have you think about it cold: let me put one in on a trial. Costs you nothing while it runs, you take real payments on it, and if it doesn''t earn its place I pick it up. That way you''re deciding on what actually happened instead of on my say-so."', 64),
  ('cluster.control.label', 'Control cluster', 'control', 'Cluster name', 'Shown at the top of Call Mode.', 'Processor-pain story (control)', 65),
  ('cluster.control.hook.0', 'Control cluster', 'control', 'Hook line 1', 'Spoken in order, right after the opener.', '"You''ve had customers who couldn''t pay you the way they wanted - because Square or Stripe decided your industry was too risky and set the rules on your behalf. Some of those people are holding crypto and would hand it over at the register."', 66),
  ('cluster.control.hook.1', 'Control cluster', 'control', 'Hook line 2', 'Spoken in order, right after the opener.', '"A small terminal opens that lane, and the money goes into a wallet you own the second they pay. Not a processor''s account. Yours. Nobody can freeze it, reverse it, or fire you from it."', 67),
  ('cluster.control.hook.2', 'Control cluster', 'control', 'Hook line 3', 'Spoken in order, right after the opener.', '"Your card reader keeps doing its job. This sits beside it."', 68),
  ('cluster.control.hookHint', 'Control cluster', 'control', 'Hook coaching note', 'Guidance for the rep, never spoken.', 'Open on the customer they couldn''t serve, then sovereignty. Fees are the third beat, never the first.', 69),
  ('cluster.control.mathLine', 'Control cluster', 'control', 'The math line', '{vol} and {loss} fill in live from discovery.', '"So at {vol} a month, cards are taking about {loss} a year off your top line - and that''s before a processor ever gets twitchy about your industry. If even part of that moves to the no-fee lane, the terminal pays for itself the first month."', 70),
  ('cluster.math.label', 'Math cluster', 'math', 'Cluster name', 'Shown at the top of Call Mode.', 'Napkin-math story', 71),
  ('cluster.math.hook.0', 'Math cluster', 'math', 'Hook line 1', 'Spoken in order, right after the opener.', '"On tickets your size there''s a buyer holding crypto who''d rather spend it directly than move it into a bank first and wait. Today that person either pays another way or drives to a shop that takes it."', 72),
  ('cluster.math.hook.1', 'Math cluster', 'math', 'Hook line 2', 'Spoken in order, right after the opener.', '"A small terminal by the register opens that lane, and the money lands in a wallet you own within seconds with nothing taken out of it."', 73),
  ('cluster.math.hook.2', 'Math cluster', 'math', 'Hook line 3', 'Spoken in order, right after the opener.', '"$499 for the terminal, then $24.99 a month. Never a percentage."', 74),
  ('cluster.math.hookHint', 'Math cluster', 'math', 'Hook coaching note', 'Guidance for the rep, never spoken.', 'Open on the sale they''re losing, not on the 3%. This cluster still buys on arithmetic - get to Discovery fast and let the numbers close it.', 75),
  ('cluster.math.mathLine', 'Math cluster', 'math', 'The math line', '{vol} and {loss} fill in live from discovery.', '"So at {vol} a month, that''s about {loss} a year going to the card networks. Our whole first year costs $799. That''s the entire pitch - you can do that math without me."', 76),
  ('cluster.crowd.label', 'Crowd cluster', 'crowd', 'Cluster name', 'Shown at the top of Call Mode.', 'Young-crowd story', 77),
  ('cluster.crowd.hook.0', 'Crowd cluster', 'crowd', 'Hook line 1', 'Spoken in order, right after the opener.', '"Somebody''s already asked at your register and whoever was working said no. Your crowd skews young, and that''s exactly who''s holding crypto and looking for somewhere to spend it."', 78),
  ('cluster.crowd.hook.1', 'Crowd cluster', 'crowd', 'Hook line 2', 'Spoken in order, right after the opener.', '"Those customers pick the shops that take it, and they tell each other which ones do. Right now on your block that''s nobody."', 79),
  ('cluster.crowd.hook.2', 'Crowd cluster', 'crowd', 'Hook line 3', 'Spoken in order, right after the opener.', '"Small terminal by the register, about ten seconds a sale, and the money''s in a wallet you own before they reach the door. Cards keep working exactly like today."', 80),
  ('cluster.crowd.hookHint', 'Crowd cluster', 'crowd', 'Hook coaching note', 'Guidance for the rep, never spoken.', 'Lead with the customer who got told no. Fees are a bonus here, never the opener - this cluster buys relevance.', 81),
  ('cluster.crowd.mathLine', 'Crowd cluster', 'crowd', 'The math line', '{vol} and {loss} fill in live from discovery.', '"And the fee side isn''t nothing either - at {vol} a month, cards take about {loss} a year. The crowd angle gets you customers, the zero-fee side keeps more of what they spend."', 82),
  ('cluster.simple.label', 'Simple cluster', 'simple', 'Cluster name', 'Shown at the top of Call Mode.', 'Final-payment story', 83),
  ('cluster.simple.hook.0', 'Simple cluster', 'simple', 'Hook line 1', 'Spoken in order, right after the opener.', '"There''s a customer who''d rather pay you out of what they''re already holding than move money into a bank first - and right now you''ve got no way to take it."', 84),
  ('cluster.simple.hook.1', 'Simple cluster', 'simple', 'Hook line 2', 'Spoken in order, right after the opener.', '"A terminal by the register opens that lane, and the money settles into a wallet you own in seconds."', 85),
  ('cluster.simple.hook.2', 'Simple cluster', 'simple', 'Hook line 3', 'Spoken in order, right after the opener.', '"And once it settles it''s final. No dispute window, no clawbacks. You know the worst invoice in this business - the one that comes back weeks later with a fee stacked on top. Not on this lane. Work done means paid."', 86),
  ('cluster.simple.hookHint', 'Simple cluster', 'simple', 'Hook coaching note', 'Guidance for the rep, never spoken.', 'Open on the customer, land on the clawback. Chargebacks are the wound here - press gently and let them tell you a story.', 87),
  ('cluster.simple.mathLine', 'Simple cluster', 'simple', 'The math line', '{vol} and {loss} fill in live from discovery.', '"On the fee side, at {vol} a month you''re giving the networks about {loss} a year - and every reversed job on top of that. This lane closes both doors."', 88),
  ('cluster.native.label', 'Crypto-native cluster', 'native', 'Cluster name', 'Shown at the top of Call Mode.', 'Third-option story (already takes crypto)', 89),
  ('cluster.native.hook.0', 'Crypto-native cluster', 'native', 'Hook line 1', 'Spoken in order, right after the opener.', '"So you already take crypto - which tells me you did the homework years before your neighbors. Respect. I''m not calling to explain bitcoin to you."', 90),
  ('cluster.native.hook.1', 'Crypto-native cluster', 'native', 'Hook line 2', 'Spoken in order, right after the opener.', '"Here''s what I keep seeing at shops that already take it: either a BitPay-style processor skimming 1-2% plus a quarter per transaction and settling to the bank in a day or two - card-fee economics on crypto rails - or a bare wallet QR by the register that''s free but clunky enough the staff steer around it."', 91),
  ('cluster.native.hook.2', 'Crypto-native cluster', 'native', 'Hook line 3', 'Spoken in order, right after the opener.', '"We''re the third option: a real terminal - staff types the amount, customer scans, ten seconds - zero processing fee, settlement straight to a wallet you control, instantly. Processor-grade checkout, DIY-grade economics."', 92),
  ('cluster.native.hookHint', 'Crypto-native cluster', 'native', 'Hook coaching note', 'Guidance for the rep, never spoken.', 'NEVER pitch "have you considered crypto" - open with respect, then the third option.', 93),
  ('cluster.native.mathLine', 'Crypto-native cluster', 'native', 'The math line', '{vol} and {loss} fill in live from discovery.', '"If you''re on a processor rail today, run the comparison: their cut on {vol} a month against our flat $24.99. If you''re on a bare QR you''re already at zero - so the pitch is the terminal experience and how fast it settles, not the fee."', 94),
  ('cluster.native.discovery.0.q', 'Crypto-native cluster', 'native', 'Discovery 1', 'Answer box hint: BitPay / QR / other', '"What are you running today - BitPay-style processor, or your own wallet QR?"', 95),
  ('cluster.native.discovery.1.q', 'Crypto-native cluster', 'native', 'Discovery 2', 'Answer box hint: $2,000', '"Roughly how much crypto volume a month?"', 96),
  ('cluster.native.discovery.2.q', 'Crypto-native cluster', 'native', 'Discovery 3', 'Answer box hint: $12,000', '"And what''s total card volume - worth knowing what the no-fee lane could absorb?"', 97),
  ('cluster.native.close.0.title', 'Crypto-native cluster', 'native', 'Close 1 - title', 'Native closes replace the shared set.', '① Run both rails (best)', 98),
  ('cluster.native.close.0.script', 'Crypto-native cluster', 'native', 'Close 1 - script', 'What the rep says.', '"Keep whatever you run today exactly as is - put our terminal beside it for a month and compare the tape. If ours doesn''t win on your own numbers, I''ll carry it back out myself."', 99),
  ('cluster.native.close.1.title', 'Crypto-native cluster', 'native', 'Close 2 - title', 'Native closes replace the shared set.', '② Time to money', 100),
  ('cluster.native.close.1.script', 'Crypto-native cluster', 'native', 'Close 2 - script', 'What the rep says.', '"Pull one number off whatever you run today: how long between the customer paying and the money being yours to spend. Processor rail, that''s a day or two into a bank after their cut. Ours is seconds, into a wallet you hold. Same checkout either way - the difference is all on your side."', 101),
  ('cluster.native.close.2.title', 'Crypto-native cluster', 'native', 'Close 3 - title', 'Native closes replace the shared set.', '② The one-pager text', 102),
  ('cluster.native.close.2.script', 'Crypto-native cluster', 'native', 'Close 3 - script', 'What the rep says.', '"Let me text you the one-page version - everything including pricing. What''s the best cell?"', 103),
  ('cluster.native.close.2.note', 'Crypto-native cluster', 'native', 'Close 3 - note', 'Coaching note, not spoken.', 'Then send the PNG + their Pulse link.', 104),
  ('cluster.native.close.3.title', 'Crypto-native cluster', 'native', 'Close 4 - title', 'Native closes replace the shared set.', '④ The trial', 105),
  ('cluster.native.close.3.script', 'Crypto-native cluster', 'native', 'Close 4 - script', 'What the rep says.', '"Here''s what I''d rather do. Let me put one in for a trial - costs you nothing while it runs, no $499, no monthly. Take real payments on it. If it earns its place you keep it, if it doesn''t I come get it. Fair?"', 106),
  ('cluster.native.close.3.note', 'Crypto-native cluster', 'native', 'Close 4 - note', 'Coaching note, not spoken.', 'Trial length is your call. A signed agreement goes in before the terminal does.', 107),
  ('cluster.native.objection.0.q', 'Crypto-native cluster', 'native', 'Objection 1 - what they say', 'Native-only, shown above the shared wall.', '"My QR setup works fine."', 108),
  ('cluster.native.objection.0.a', 'Crypto-native cluster', 'native', 'Objection 1 - the answer', 'What the rep says back.', '"And it''s free, which I respect. The gap is everything around the payment - amount entry, staff being able to run it, receipts, refunds. That''s what keeps the crypto lane from actually getting used. Let me put a terminal in on a trial, run both side by side for a couple of weeks, and watch which one your staff reaches for."', 109),
  ('cluster.native.objection.1.q', 'Crypto-native cluster', 'native', 'Objection 2 - what they say', 'Native-only, shown above the shared wall.', '"I''m on BitPay already."', 110),
  ('cluster.native.objection.1.a', 'Crypto-native cluster', 'native', 'Objection 2 - the answer', 'What the rep says back.', '"Then you know the drill - they take their cut and the bank deposit shows up in a day or two. Ours is zero fee and settles to your wallet in seconds. Same customers, same coins, none of the skim. Put one in on a trial and run them side by side - the difference shows up on the first sale."', 111)
on conflict (block_key) do nothing;
