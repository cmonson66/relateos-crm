-- 060_campaign_settings_per_region.sql
-- One campaign per region instead of one per org. Requires 058 and 059.
--
-- After this runs, creating a region automatically creates its campaign, and
-- that campaign is BORN PAUSED with its own campaign_start. A new region can
-- never inherit a running sequence and start mailing strangers on day one.
--
-- Run as bare statements in the Supabase SQL editor.

begin;

-- ---------------------------------------------------------------------------
-- 1. Re-key campaign_settings
-- ---------------------------------------------------------------------------
-- org_id stays: the RLS policy is written against it, and campaign_runs
-- reports by org. region_id becomes the primary key because a region belongs
-- to exactly one org, so it is already globally unique.

alter table public.campaign_settings
  add column if not exists region_id uuid references public.regions(id) on delete cascade;

update public.campaign_settings s
   set region_id = r.id
  from public.regions r
 where r.org_id = s.org_id
   and r.code = 'PHX'
   and s.region_id is null;

-- Any settings row whose org somehow has no PHX region takes that org's
-- oldest region rather than being left orphaned by the NOT NULL below.
update public.campaign_settings s
   set region_id = (
     select r.id from public.regions r
      where r.org_id = s.org_id
      order by r.created_at limit 1
   )
 where s.region_id is null;

delete from public.campaign_settings where region_id is null;

alter table public.campaign_settings alter column region_id set not null;
alter table public.campaign_settings drop constraint if exists campaign_settings_pkey;
alter table public.campaign_settings add constraint campaign_settings_pkey primary key (region_id);

create index if not exists campaign_settings_org_idx on public.campaign_settings(org_id);

-- ---------------------------------------------------------------------------
-- 2. campaign_runs gets a region
-- ---------------------------------------------------------------------------
-- Without this the two regions' send history pools into one list and nobody
-- can answer "did DFW go out this morning".

alter table public.campaign_runs
  add column if not exists region_id uuid references public.regions(id) on delete set null;

update public.campaign_runs cr
   set region_id = r.id
  from public.regions r
 where r.org_id = cr.org_id
   and r.code = 'PHX'
   and cr.region_id is null;

-- The time column on campaign_runs is ran_at, not created_at. Rather than
-- trust that a second time, this asks the catalog and builds the index around
-- whatever is actually there.
do $$
declare ts_col text;
begin
  select column_name into ts_col
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'campaign_runs'
     and column_name in ('ran_at', 'created_at')
   order by case column_name when 'ran_at' then 1 else 2 end
   limit 1;

  if ts_col is null then
    execute 'create index if not exists campaign_runs_region_idx on public.campaign_runs(region_id)';
  else
    execute format(
      'create index if not exists campaign_runs_region_idx on public.campaign_runs(region_id, %I desc)',
      ts_col);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. A new region gets its own campaign, paused
-- ---------------------------------------------------------------------------
-- Copies the operational settings that are genuinely shared - the Resend key,
-- the CAN-SPAM address, the Pulse base URL, the ramp and gap curves - and
-- deliberately does NOT copy what must be decided per region:
--
--   status         forced to 'paused'
--   campaign_start today in the NEW region's own timezone, so the ramp starts
--                  at day 1 rather than inheriting Phoenix's day count and
--                  jumping straight to the full daily cap
--   send_owner_id  null; the other region's reps are not this region's reps
--   last_run_at    null
--
-- from_domain IS copied. Both regions sharing one cold subdomain is fine for
-- one company, but if DFW should warm its own sending reputation separately,
-- change it on the region's campaign page before unpausing.

create or replace function public.seed_region_campaign()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  src public.campaign_settings%rowtype;
begin
  select * into src
    from public.campaign_settings s
    join public.regions r on r.id = s.region_id
   where r.org_id = new.org_id
   order by s.updated_at nulls last
   limit 1;

  insert into public.campaign_settings (
    region_id, org_id, status, resend_api_key, from_domain, from_label,
    reply_to, physical_address, pulse_base_url, campaign_start, ramp,
    followup_gap_days, send_delay_ms, assigned_only, send_owner_id, last_run_at
  ) values (
    new.id,
    new.org_id,
    'paused',
    src.resend_api_key,
    src.from_domain,
    src.from_label,
    src.reply_to,
    src.physical_address,
    src.pulse_base_url,
    (now() at time zone new.timezone)::date,
    coalesce(src.ramp, '[]'::jsonb),
    coalesce(src.followup_gap_days, '{}'::jsonb),
    coalesce(src.send_delay_ms, 700),
    true,
    null,
    null
  )
  on conflict (region_id) do nothing;

  return new;
end;
$function$;

drop trigger if exists regions_seed_campaign on public.regions;
create trigger regions_seed_campaign
  after insert on public.regions
  for each row execute function public.seed_region_campaign();

commit;

-- ---------------------------------------------------------------------------
-- Verify (run separately)
-- ---------------------------------------------------------------------------
-- select r.code, r.timezone, r.send_hour, s.status, s.campaign_start,
--        s.from_domain, s.assigned_only, s.last_run_at
--   from public.campaign_settings s
--   join public.regions r on r.id = s.region_id
--  order by r.code;
--
-- One row, PHX, status running, your real campaign_start. Creating DFW after
-- 060 should add a second row that says paused with today's date.
