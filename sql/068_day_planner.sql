-- 068_day_planner.sql
-- Requires 058 (regions) and 063.
--
-- Phase 1 of the day planner: the morning desk block. No geography yet.
--
-- A plan is PERSISTED rather than computed on every page load, for one
-- reason: the rep marks things done and skipped as the morning goes, and a
-- list that reshuffles under them because a score changed is a list they stop
-- trusting. Generate once, then it is theirs until they replan.

begin;

create table if not exists public.day_plans (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  region_id   uuid references public.regions(id) on delete set null,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  -- Plain date in the REGION's calendar, resolved by the caller. Never
  -- derived here: a Dallas rep's Monday starts two hours before Phoenix's.
  plan_date   date not null,
  status      text not null default 'active' check (status in ('active', 'closed')),
  generated_at timestamptz not null default now(),
  params      jsonb not null default '{}'::jsonb,
  unique (profile_id, plan_date)
);

create table if not exists public.day_plan_items (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references public.day_plans(id) on delete cascade,
  block       text not null check (block in ('desk', 'field', 'close')),
  kind        text not null check (kind in ('call', 'send', 'appointment', 'walkin', 'admin')),
  sequence    integer not null,
  account_id  uuid references public.accounts(id) on delete cascade,
  contact_id  uuid references public.contacts(id) on delete set null,
  activity_id uuid references public.activities(id) on delete set null,
  -- ONE line, shown verbatim to the rep. A plan that cannot explain itself
  -- gets ignored, so this is not optional and it is not a debug field.
  reason      text not null,
  score       numeric,
  est_minutes integer not null default 6,
  state       text not null default 'pending' check (state in ('pending', 'done', 'skipped', 'rolled')),
  outcome     text,
  updated_at  timestamptz not null default now()
);

create index if not exists day_plans_lookup_idx on public.day_plans(profile_id, plan_date desc);
create index if not exists day_plans_region_idx on public.day_plans(region_id, plan_date desc);
create index if not exists day_plan_items_plan_idx on public.day_plan_items(plan_id, block, sequence);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- A plan is a rep's own working document. Managers see their region's because
-- "what did the team actually do today" is the first honest answer this table
-- can give; nobody else sees them at all.

alter table public.day_plans enable row level security;
alter table public.day_plan_items enable row level security;

drop policy if exists day_plans_rw on public.day_plans;
create policy day_plans_rw on public.day_plans
  for all
  using (
    org_id = my_org()
    and (profile_id = auth.uid() or is_admin_visible() or can_see_region(region_id))
  )
  with check (org_id = my_org() and profile_id = auth.uid());

drop policy if exists day_plan_items_rw on public.day_plan_items;
create policy day_plan_items_rw on public.day_plan_items
  for all
  using (exists (select 1 from public.day_plans p where p.id = plan_id))
  with check (exists (select 1 from public.day_plans p where p.id = plan_id));

-- ---------------------------------------------------------------------------
-- The signal the ranking runs on
-- ---------------------------------------------------------------------------
-- nectarpay_leads is closed to app users, and the engagement rollup already
-- writes the summary onto the lead (last_intent, last_engaged_at, the slider
-- number). So the planner never needs engagement_events - it needs these
-- columns for the accounts a rep already owns.
--
-- The caller passes legacy_ids they got through RLS on contacts, so this
-- cannot widen what they can see: they can only ask about shops they already
-- have.

create or replace function public.get_planner_signals(p_legacy_ids text[])
returns table (
  place_id text,
  status text,
  band text,
  score integer,
  email_stage smallint,
  last_emailed_at timestamptz,
  last_intent text,
  last_engaged_at timestamptz,
  self_reported_monthly_volume numeric,
  visit_day_pref text,
  compliance_hold boolean
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select l.place_id, l.status, l.band, l.score, l.email_stage, l.last_emailed_at,
         l.last_intent, l.last_engaged_at, l.self_reported_monthly_volume,
         l.visit_day_pref, l.compliance_hold
    from nectarpay_leads l
   where l.place_id = any(p_legacy_ids);
$function$;

grant execute on function public.get_planner_signals(text[]) to authenticated;

commit;

-- Verify:
-- select * from public.get_planner_signals(
--   array(select legacy_id from public.contacts where legacy_id is not null limit 5));
