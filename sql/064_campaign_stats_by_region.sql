-- 064_campaign_stats_by_region.sql
-- Requires 058 and 063.
--
-- get_campaign_stats() counted the whole lead pool. Everything else on the
-- campaign page moved to the region in 060 - settings, daily cap, campaign
-- day, run history - so the queue, the stage bars, the emailable count and
-- the held count were org-wide numbers sitting next to region-scoped ones.
-- With DFW paused and Phoenix running, DFW's page showed Phoenix's queue.
--
-- The old zero-argument version is DROPPED rather than left alongside. A
-- defaulted parameter would make rpc('get_campaign_stats') ambiguous, and
-- PostgREST refuses to choose - "could not choose the best candidate
-- function" - which would take the page down rather than degrade it.

begin;

drop function if exists public.get_campaign_stats();

create or replace function public.get_campaign_stats(p_region_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare v_ok boolean;
begin
  select exists (
    select 1 from profiles
     where id = auth.uid() and is_active and role in ('super_admin', 'admin')
  ) into v_ok;
  if not v_ok then return '{}'::jsonb; end if;

  -- p_region_id null means every region, which is what an org-wide roll-up
  -- would want. The campaign page always passes one, because a campaign
  -- belongs to exactly one region.
  return (select jsonb_build_object(
    'stages', (
      select coalesce(jsonb_object_agg(s.stg::text, s.n), '{}'::jsonb)
      from (
        select email_stage as stg, count(*) as n
          from nectarpay_leads
         where emails <> '{}'
           and not compliance_hold
           and (p_region_id is null or region_id = p_region_id)
         group by email_stage
      ) s
    ),
    'queued', (
      select count(*) from nectarpay_leads
       where status = 'NEW' and email_stage = 0 and emails <> '{}' and not compliance_hold
         and (p_region_id is null or region_id = p_region_id)
    ),
    'emailable', (
      select count(*) from nectarpay_leads
       where emails <> '{}' and not compliance_hold
         and (p_region_id is null or region_id = p_region_id)
    ),
    'engaged', (
      select count(*) from nectarpay_leads
       where status not in ('NEW', 'EMAILED', 'FIELD')
         and (p_region_id is null or region_id = p_region_id)
    ),
    'held', (
      select count(*) from nectarpay_leads
       where compliance_hold
         and (p_region_id is null or region_id = p_region_id)
    )
  ));
end;
$function$;

grant execute on function public.get_campaign_stats(uuid) to authenticated;

commit;

-- ---------------------------------------------------------------------------
-- Verify (run separately)
-- ---------------------------------------------------------------------------
-- select r.code, public.get_campaign_stats(r.id) from public.regions r order by r.code;
--
-- Phoenix's queued should match what the page has been showing all along.
-- DFW's should be its own number, and its held count reflects the four
-- restricted verticals in Texas rather than Arizona's 1,664.
