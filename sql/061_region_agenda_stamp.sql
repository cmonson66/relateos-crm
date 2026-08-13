-- 061_region_agenda_stamp.sql
-- One column. The reminders cron moves from once a day at a fixed UTC time to
-- hourly, firing per region at that region's own agenda_hour, so it needs the
-- same once-per-local-day guard the campaign cron got in 060.
--
-- campaign_settings.last_run_at plays that role for sends. Agendas have no
-- settings row of their own, so the stamp lives on the region.

begin;

alter table public.regions
  add column if not exists last_agenda_at timestamptz;

comment on column public.regions.last_agenda_at is
  'Set by /api/reminders after a successful run. Compared in this region''s own calendar so an hourly cron sends one agenda per local day.';

-- ---------------------------------------------------------------------------
-- Lead counts per region, for the Regions page
-- ---------------------------------------------------------------------------
-- nectarpay_leads gives app users nothing through RLS, so a direct count from
-- the page comes back as zero rather than an error - the same trap 044 hit
-- with the campaign stats. Security definer, but joined through regions and
-- fenced to the caller's own org so it cannot report another tenant's pool.

create or replace function public.get_region_lead_counts()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(jsonb_object_agg(r.id::text, x.n), '{}'::jsonb)
  from public.regions r
  join (
    select region_id, count(*) as n
      from public.nectarpay_leads
     where region_id is not null
     group by region_id
  ) x on x.region_id = r.id
  where r.org_id = my_org();
$function$;

grant execute on function public.get_region_lead_counts() to authenticated;

commit;

-- Verify:
-- select code, timezone, agenda_hour, last_agenda_at from public.regions order by code;
