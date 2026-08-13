-- 058_regions.sql
-- Region foundation. ADDITIVE ONLY - nothing the running app reads changes
-- behavior. campaign_settings is deliberately NOT re-keyed here; that lands in
-- 059 alongside the engine change, because the app's .eq('org_id').single()
-- reads keep working only while exactly one region exists.
--
-- Run as bare statements in the Supabase SQL editor. Wrapped in a transaction,
-- so a failure anywhere leaves the database untouched.

begin;

-- ---------------------------------------------------------------------------
-- 1. The regions table
-- ---------------------------------------------------------------------------
-- timezone is an IANA name. It is the anchor for every scheduled thing in the
-- region: the campaign send hour, the morning agenda email, 9 AM tasks, and
-- what "today" means on the dashboard. A typo here silently misfires all of
-- them, so it is validated against pg_timezone_names by trigger below - a
-- CHECK constraint cannot hold a subquery.

create table if not exists public.regions (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null,
  code        text not null,
  timezone    text not null default 'America/Phoenix',
  send_hour   smallint not null default 6,
  agenda_hour smallint not null default 7,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (org_id, code),
  constraint regions_send_hour_range   check (send_hour   between 0 and 23),
  constraint regions_agenda_hour_range check (agenda_hour between 0 and 23)
);

create or replace function public.validate_region_timezone()
returns trigger
language plpgsql
as $$
begin
  if not exists (select 1 from pg_timezone_names where name = new.timezone) then
    raise exception 'Unknown IANA timezone: %. Try America/Phoenix or America/Chicago.', new.timezone;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists regions_validate_tz on public.regions;
create trigger regions_validate_tz
  before insert or update on public.regions
  for each row execute function public.validate_region_timezone();

-- ---------------------------------------------------------------------------
-- 2. Seed one region per organization
-- ---------------------------------------------------------------------------
-- Every existing row in this database is Arizona, so every org gets a Phoenix
-- region and everything it owns is backfilled into it. If a stray RelateOS-era
-- org is in here, it gets a Phoenix region too - harmless, rename or deactivate
-- it. Check first with: select id, name from public.organizations;

insert into public.regions (org_id, name, code, timezone, send_hour, agenda_hour)
select o.id, 'Phoenix', 'PHX', 'America/Phoenix', 6, 7
from public.organizations o
on conflict (org_id, code) do nothing;

-- ---------------------------------------------------------------------------
-- 3. region_id columns
-- ---------------------------------------------------------------------------
-- Nullable on purpose. On profiles, NULL means corporate - sees every region.
-- On the data tables it means unassigned, which stays visible to corporate and
-- is what an unmigrated row looks like if a future insert path forgets.

alter table public.accounts         add column if not exists region_id uuid references public.regions(id) on delete set null;
alter table public.contacts         add column if not exists region_id uuid references public.regions(id) on delete set null;
alter table public.deals            add column if not exists region_id uuid references public.regions(id) on delete set null;
alter table public.terminals        add column if not exists region_id uuid references public.regions(id) on delete set null;
alter table public.profiles         add column if not exists region_id uuid references public.regions(id) on delete set null;
alter table public.nectarpay_leads  add column if not exists region_id uuid references public.regions(id) on delete set null;

create index if not exists accounts_region_idx        on public.accounts(region_id);
create index if not exists contacts_region_idx        on public.contacts(region_id);
create index if not exists deals_region_idx           on public.deals(region_id);
create index if not exists terminals_region_idx       on public.terminals(region_id);
create index if not exists profiles_region_idx        on public.profiles(region_id);
create index if not exists nectarpay_leads_region_idx on public.nectarpay_leads(region_id);

-- ---------------------------------------------------------------------------
-- 4. Backfill
-- ---------------------------------------------------------------------------
-- Org-scoped tables map through their own org. nectarpay_leads has no org_id
-- and no state column - it has only ever held one metro - so it takes the
-- single Phoenix region outright. That assumption dies the moment DFW leads
-- land, which is why the scraper must write region_id on ingest rather than
-- infer it from a city string.

update public.accounts  a set region_id = r.id from public.regions r
  where r.org_id = a.org_id and r.code = 'PHX' and a.region_id is null;

update public.contacts  c set region_id = r.id from public.regions r
  where r.org_id = c.org_id and r.code = 'PHX' and c.region_id is null;

update public.deals     d set region_id = r.id from public.regions r
  where r.org_id = d.org_id and r.code = 'PHX' and d.region_id is null;

update public.terminals t set region_id = r.id from public.regions r
  where r.org_id = t.org_id and r.code = 'PHX' and t.region_id is null;

update public.profiles  p set region_id = r.id from public.regions r
  where r.org_id = p.org_id and r.code = 'PHX'
    and p.region_id is null
    and p.role in ('manager', 'rep');

update public.nectarpay_leads l set region_id = (
  select r.id from public.regions r where r.code = 'PHX' order by r.created_at limit 1
) where l.region_id is null;

-- ---------------------------------------------------------------------------
-- 5. Keep child rows on their account's region
-- ---------------------------------------------------------------------------
-- A contact or deal without its own region is a row RLS cannot place, and a
-- reassigned account whose contacts stay behind is worse. Both directions are
-- covered: inherit on insert, cascade on move.

create or replace function public.inherit_region_from_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.region_id is null and new.account_id is not null then
    select a.region_id into new.region_id from public.accounts a where a.id = new.account_id;
  end if;
  return new;
end;
$$;

drop trigger if exists contacts_inherit_region on public.contacts;
create trigger contacts_inherit_region
  before insert on public.contacts
  for each row execute function public.inherit_region_from_account();

drop trigger if exists deals_inherit_region on public.deals;
create trigger deals_inherit_region
  before insert on public.deals
  for each row execute function public.inherit_region_from_account();

create or replace function public.cascade_account_region()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.region_id is distinct from old.region_id then
    update public.contacts set region_id = new.region_id where account_id = new.id;
    update public.deals    set region_id = new.region_id where account_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists accounts_cascade_region on public.accounts;
create trigger accounts_cascade_region
  after update of region_id on public.accounts
  for each row execute function public.cascade_account_region();

-- ---------------------------------------------------------------------------
-- 6. my_region() and RLS on regions itself
-- ---------------------------------------------------------------------------
-- my_region() returns NULL for corporate (super_admin/admin, or anyone with no
-- region set). 059 leans on that: NULL means "not region-limited", which is why
-- the visibility rewrite reads as "corporate OR same region OR own book".

create or replace function public.my_region()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select region_id from public.profiles where id = auth.uid();
$$;

grant execute on function public.my_region() to authenticated;

alter table public.regions enable row level security;

drop policy if exists regions_select on public.regions;
create policy regions_select on public.regions
  for select using (org_id = my_org());

drop policy if exists regions_write on public.regions;
create policy regions_write on public.regions
  for all
  using      (org_id = my_org() and is_admin_or_above())
  with check (org_id = my_org() and is_admin_or_above());

commit;

-- ---------------------------------------------------------------------------
-- Verify (run separately, after the commit)
-- ---------------------------------------------------------------------------
-- select id, name, code, timezone, send_hour, agenda_hour from public.regions;
--
-- select 'accounts' t, count(*) total, count(region_id) placed from public.accounts
-- union all select 'contacts', count(*), count(region_id) from public.contacts
-- union all select 'deals', count(*), count(region_id) from public.deals
-- union all select 'terminals', count(*), count(region_id) from public.terminals
-- union all select 'leads', count(*), count(region_id) from public.nectarpay_leads
-- union all select 'profiles (region set)', count(*), count(region_id) from public.profiles;
--
-- profiles is the one where total and placed SHOULD differ: super_admin and
-- admin stay NULL on purpose. Everything else should match exactly.
