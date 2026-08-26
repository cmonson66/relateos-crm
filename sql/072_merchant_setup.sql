-- 072_merchant_setup.sql
-- Requires 046 (deals.trial_*), 058 (regions) and the inline migration that
-- added deals.welcome_token + get_deal_welcome.
--
-- THE PROBLEM: the install visit dies on two things a rep cannot do for the
-- merchant - creating an account against the merchant's own email, and
-- opening an exchange account, which is days of KYC rather than minutes. Both
-- currently happen with the rep standing there.
--
-- This moves them BEFORE the visit and, more usefully, lets the rep see
-- whether they actually happened before driving out.
--
-- TOKEN: deliberately NOT a new one. deals.welcome_token already exists and
-- already addresses this merchant. One token per deal means one thing to
-- revoke if it ever leaks, and /start/<token> and /setup/<token> stay in
-- step. sendSetupLink mints it the same lazy way sendWelcome does.
--
-- WHY A SEPARATE TABLE rather than columns on deals: deals_with_stage
-- ENUMERATES its columns, so every new deals column is invisible to the app
-- until the view is recreated (the trap 046 left behind). Progress lives in
-- its own table and the view is untouched.
--
-- NOTE ON WHAT IS **NOT** HERE: the wallet. Under the confirmed install flow
-- the wallet is paired from the physical coin the rep brings, so it cannot be
-- merchant homework. If beekeeper.money ever supports creating a wallet
-- without a coin, add 'wallet' to the step check and to SETUP_STEPS.

begin;

create table if not exists public.merchant_setup_steps (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  deal_id    uuid not null references public.deals(id) on delete cascade,
  step       text not null check (step in ('exchange', 'account', 'ready')),
  done_at    timestamptz,
  -- Who ticked it. A rep ticking it on the merchant's behalf is legitimate
  -- (they phoned and asked) but it is weaker evidence than the merchant
  -- doing it, and the panel says which.
  marked_by  text not null default 'merchant' check (marked_by in ('merchant', 'rep')),
  updated_at timestamptz not null default now(),
  unique (deal_id, step)
);

create index if not exists merchant_setup_steps_deal_idx
  on public.merchant_setup_steps(deal_id);

alter table public.merchant_setup_steps enable row level security;

-- App users see progress for their own org. Merchant writes never come
-- through here - they arrive via the security-definer RPC below, because the
-- merchant has no login and never will.
drop policy if exists merchant_setup_steps_rw on public.merchant_setup_steps;
create policy merchant_setup_steps_rw on public.merchant_setup_steps
  for all
  using      (org_id = my_org())
  with check (org_id = my_org());


-- ---------------------------------------------------------------------------
-- READ: everything the merchant-facing page prints.
-- ---------------------------------------------------------------------------
create or replace function public.get_merchant_setup(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_deal  record;
  v_acct  record;
  v_rep   record;
  v_prof  record;
  v_first text;
  v_steps jsonb;
begin
  -- Base table only. trial_end is COMPUTED BY deals_with_stage, not stored on
  -- deals, so selecting it here fails at runtime rather than at deploy. Nothing
  -- needs it: is_trial is simply whether a trial was ever started.
  select id, account_id, owner_id, primary_contact_id, trial_start
    into v_deal
    from deals
   where welcome_token = p_token;

  if v_deal.id is null then
    return null;
  end if;

  select name, city into v_acct from accounts where id = v_deal.account_id;

  -- The person who signs, when we have a real one. pick-contact's rule in
  -- SQL: a placeholder contact is not a name to greet somebody by.
  select first_name into v_first
    from contacts
   where id = v_deal.primary_contact_id
     and first_name is not null
     and first_name not in ('Business', 'Owner', 'Manager', 'Front desk', 'Info');

  select first_name, cell, from_email into v_rep
    from reps where profile_id = v_deal.owner_id;
  select full_name into v_prof from profiles where id = v_deal.owner_id;

  if v_rep.first_name is null then
    select first_name, cell, from_email into v_rep
      from reps where is_default and active limit 1;
  end if;

  select coalesce(jsonb_object_agg(step, done_at), '{}'::jsonb)
    into v_steps
    from merchant_setup_steps
   where deal_id = v_deal.id
     and done_at is not null;

  return jsonb_build_object(
    'business_name', coalesce(v_acct.name, 'your shop'),
    'city',          coalesce(v_acct.city, ''),
    'owner_first',   v_first,
    'is_trial',      v_deal.trial_start is not null,
    'steps',         coalesce(v_steps, '{}'::jsonb),
    'rep', jsonb_build_object(
      'first', coalesce(v_rep.first_name, split_part(coalesce(v_prof.full_name, ''), ' ', 1), 'your rep'),
      'cell',  coalesce(v_rep.cell, ''),
      'email', coalesce(v_rep.from_email, '')
    )
  );
end;
$function$;

grant execute on function public.get_merchant_setup(text) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- WRITE: the merchant ticking a step off, with no login.
--
-- The token is the credential, exactly as it is for /agreement. The deal id is
-- never accepted from the caller - it is resolved from the token here, so
-- holding one merchant's link gives you no reach into anyone else's deal. The
-- step name is whitelisted by the table's own check constraint.
-- ---------------------------------------------------------------------------
create or replace function public.mark_setup_step(
  p_token text,
  p_step  text,
  p_done  boolean default true
)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
declare
  v_deal record;
begin
  if p_step not in ('exchange', 'account', 'ready') then
    return null;
  end if;

  select id, org_id into v_deal from deals where welcome_token = p_token;
  if v_deal.id is null then
    return null;
  end if;

  insert into merchant_setup_steps (org_id, deal_id, step, done_at, marked_by, updated_at)
  values (
    v_deal.org_id,
    v_deal.id,
    p_step,
    case when p_done then now() else null end,
    'merchant',
    now()
  )
  on conflict (deal_id, step) do update
     set done_at    = excluded.done_at,
         marked_by  = excluded.marked_by,
         updated_at = now();

  return (
    select coalesce(jsonb_object_agg(step, done_at), '{}'::jsonb)
      from merchant_setup_steps
     where deal_id = v_deal.id
       and done_at is not null
  );
end;
$function$;

grant execute on function public.mark_setup_step(text, text, boolean) to anon, authenticated;

commit;

-- Verify (pick any deal that already has a welcome_token):
--   select public.get_merchant_setup(welcome_token)
--     from public.deals where welcome_token is not null limit 1;
--
-- Round trip, on a deal you do not mind touching:
--   select public.mark_setup_step('<token>', 'exchange', true);
--   select public.mark_setup_step('<token>', 'exchange', false);
