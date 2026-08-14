-- 065_region_campaign_blank_sender.sql
-- Requires 060.
--
-- 060's seed copied the whole sending identity into a new region. Two of
-- those fields are per-region decisions and copying them is actively wrong:
--
--   from_domain  Sending reputation belongs to the DOMAIN. Handing DFW a
--                subdomain Phoenix has been warming since Aug 10 means one
--                region's spam complaints land on the other's reputation,
--                and nobody would connect the two.
--   reply_to     A Texas merchant hitting reply should reach somebody who
--                can drive to them.
--
-- The other three stay copied, because they are genuinely one per company
-- rather than one per region: the Resend API key is one account, the physical
-- address is the CAN-SPAM footer for the same legal entity, and pulse_base_url
-- points at the single Pulse deployment. Blanking those would mean pasting a
-- secret again for every region, which is how secrets end up in a text file.

begin;

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
    src.resend_api_key,      -- one Resend account
    null,                    -- this region warms its own sending domain
    src.from_label,
    null,                    -- replies go to somebody in THIS region
    src.physical_address,    -- same legal entity, same CAN-SPAM footer
    src.pulse_base_url,      -- one Pulse deployment
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

-- Clear what the old version already copied, but ONLY for a region that is
-- still paused, has never sent, and is carrying a domain that demonstrably
-- belongs to another region. A region somebody has configured on purpose is
-- left alone even if it happens to share a domain.
update public.campaign_settings s
   set from_domain = null,
       reply_to = null,
       updated_at = now()
 where s.status = 'paused'
   and s.last_run_at is null
   and s.from_domain is not null
   and exists (
     select 1 from public.campaign_settings other
      where other.region_id <> s.region_id
        and other.from_domain = s.from_domain
        and (other.last_run_at is not null or other.status = 'running')
   );

commit;

-- Verify:
-- select r.code, s.status, s.from_domain, s.reply_to,
--        s.resend_api_key is not null as has_key, s.physical_address is not null as has_address
--   from public.campaign_settings s join public.regions r on r.id = s.region_id
--  order by r.code;
--
-- Phoenix keeps everything. DFW should show status paused with from_domain
-- and reply_to empty, and still carry the key and the address.
