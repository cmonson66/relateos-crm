-- 070_runs.sql
-- Requires 058 (regions), 068 (day planner).
--
-- RUNS: the offered half of the day. /plan's morning list is a QUEUE - things
-- a rep owes. A run is an OPPORTUNITY - finite, timed, and declinable. Mixing
-- them makes the queue feel optional and the opportunity feel like homework,
-- so they are separate objects with separate tables.
--
-- A run is not stored until a rep TAKES it. Offers are computed fresh each
-- time, because an offer nobody accepted is not history worth keeping.

begin;

create table if not exists public.day_runs (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  region_id   uuid references public.regions(id) on delete set null,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  plan_date   date not null,
  kind        text not null check (kind in ('canvas', 'calls')),
  -- Named by street, because reps think in streets. "83rd Ave, Peoria" is
  -- something you can picture; "Cluster 3" is not.
  label       text not null,
  doors       integer not null default 0,
  est_minutes integer not null default 0,
  center_lat  double precision,
  center_lng  double precision,
  state       text not null default 'active' check (state in ('active', 'done', 'abandoned')),
  created_at  timestamptz not null default now()
);

create table if not exists public.day_run_stops (
  id         uuid primary key default gen_random_uuid(),
  run_id     uuid not null references public.day_runs(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  sequence   integer not null,
  -- True when this door was unowned and the run handed it to the rep.
  claimed    boolean not null default false,
  state      text not null default 'pending' check (state in ('pending', 'done', 'skipped')),
  outcome    text,
  updated_at timestamptz not null default now(),
  unique (run_id, account_id)
);

create index if not exists day_runs_lookup_idx on public.day_runs(profile_id, plan_date desc);
create index if not exists day_run_stops_run_idx on public.day_run_stops(run_id, sequence);

alter table public.day_runs enable row level security;
alter table public.day_run_stops enable row level security;

drop policy if exists day_runs_rw on public.day_runs;
create policy day_runs_rw on public.day_runs
  for all
  using (
    org_id = my_org()
    and (profile_id = auth.uid() or is_admin_visible() or can_see_region(region_id))
  )
  with check (org_id = my_org() and profile_id = auth.uid());

drop policy if exists day_run_stops_rw on public.day_run_stops;
create policy day_run_stops_rw on public.day_run_stops
  for all
  using (exists (select 1 from public.day_runs r where r.id = run_id))
  with check (exists (select 1 from public.day_runs r where r.id = run_id));

-- ---------------------------------------------------------------------------
-- Candidate doors
-- ---------------------------------------------------------------------------
-- Returns shops a rep could walk into: their own book PLUS the unassigned
-- reserve, since a rep's own book is usually too thin in any one pocket to
-- make a walk worthwhile.
--
-- The compliance hold and the address both live on nectarpay_leads, which is
-- closed to app users - so this has to be a security-definer function. Held
-- shops are excluded HERE rather than in the app: canvassing into a smoke
-- shop is a payments-partner problem, and a filter somebody can forget to
-- apply is not a filter.

create or replace function public.get_canvas_candidates(
  p_region_id uuid,
  p_owner_id uuid,
  p_cold_days integer default 30
)
returns table (
  account_id uuid,
  name text,
  vertical text,
  city text,
  address text,
  lat double precision,
  lng double precision,
  band text,
  crypto_score integer,
  owner_id uuid,
  last_activity_at timestamptz,
  last_engaged_at timestamptz
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_org uuid;
begin
  v_org := my_org();
  if v_org is null then return; end if;

  -- A rep asks for their own doors. Anyone who can see the whole region may
  -- ask on somebody else's behalf; nobody else can.
  if p_owner_id <> auth.uid() and not (is_admin_visible() or can_see_region(p_region_id)) then
    return;
  end if;

  return query
  select a.id, a.name, a.vertical::text, a.city,
         l.address, a.latitude, a.longitude,
         coalesce(
           (select t from unnest(a.tags) t where t in ('HOT', 'WARM', 'COOL') limit 1),
           'COOL'
         ) as band,
         a.crypto_score,
         a.owner_id,
         a.last_activity_at,
         l.last_engaged_at
    from accounts a
    left join contacts c on c.account_id = a.id and c.legacy_id is not null
    left join nectarpay_leads l on l.place_id = c.legacy_id
   where a.org_id = v_org
     and a.latitude is not null
     and a.longitude is not null
     and (p_region_id is null or a.region_id = p_region_id)
     -- Own book plus the unassigned reserve. Never another rep's shops.
     and (a.owner_id is null or a.owner_id = p_owner_id)
     and coalesce(l.compliance_hold, false) = false
     and coalesce(l.status, '') not in ('DNC', 'DO_NOT_CONTACT')
     and (a.last_activity_at is null
          or a.last_activity_at < now() - make_interval(days => p_cold_days))
   order by
     case coalesce((select t from unnest(a.tags) t where t in ('HOT','WARM','COOL') limit 1), 'COOL')
       when 'HOT' then 0 when 'WARM' then 1 else 2 end,
     a.crypto_score desc nulls last
   limit 5000;
end;
$function$;

grant execute on function public.get_canvas_candidates(uuid, uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Claiming territory
-- ---------------------------------------------------------------------------
-- Taking a run hands the rep every unowned door in it. This is how a
-- neighbourhood gets claimed - by walking it, not by an admin handing it out.
--
-- Security definer because assigning accounts is otherwise admin-only, and
-- deliberately narrow: it only ever fills a NULL owner, so it can never take
-- a shop off another rep.

create or replace function public.claim_accounts(p_account_ids uuid[], p_owner_id uuid)
returns integer
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
declare
  v_org uuid;
  v_count integer;
begin
  v_org := my_org();
  if v_org is null then return 0; end if;

  if p_owner_id <> auth.uid() and not is_admin_visible() then
    return 0;
  end if;

  update accounts
     set owner_id = p_owner_id
   where id = any(p_account_ids)
     and org_id = v_org
     and owner_id is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

grant execute on function public.claim_accounts(uuid[], uuid) to authenticated;

commit;

-- Verify:
-- select count(*) from public.get_canvas_candidates(
--   (select id from public.regions where code = 'PHX'), auth.uid());
