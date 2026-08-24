-- 071_account_address.sql
-- Requires 058 (regions).
--
-- Hand-added accounts were second-class citizens: no street address anywhere,
-- and no coordinates, so a franchise somebody typed in never appeared on the
-- map and could never be in a canvas run. The two things a rep uses to find
-- doors could not see it.
--
-- Three columns fix that, and a fourth makes chains legible.

begin;

alter table public.accounts add column if not exists address text;

-- The Google place id, when we know it. Scraped accounts get it from the lead
-- pool; hand-added ones get it from the lookup on the form.
--
-- This is what stops a later scrape creating a second copy of a shop somebody
-- typed in by hand: same place, same id, and the sync can match rather than
-- duplicate.
alter table public.accounts add column if not exists place_id text;

create unique index if not exists accounts_place_id_uniq
  on public.accounts(org_id, place_id)
  where place_id is not null;

-- Chains, grouped without anybody having to link anything.
--
-- A franchise is its own business with its own owner - that is the right model
-- for how these are sold. But a rep looking at four Ray's Pizzas should be
-- able to see they are related, and that the one on Bell Rd already said no.
--
-- Derived from the name rather than a foreign key on purpose: it works
-- retroactively across every scraped account without a migration pass, and
-- nobody has to remember to set it. Trailing store numbers are stripped so
-- "Ray's Pizza" and "Rays Pizza #4" land together.
alter table public.accounts drop column if exists brand_key;
alter table public.accounts add column brand_key text
  generated always as (
    nullif(
      regexp_replace(
        regexp_replace(
          -- Cut at a location suffix: " - Surprise", " #4", " (Bell Rd)".
          -- The leading whitespace requirement keeps 7-Eleven intact.
          regexp_replace(lower(coalesce(name, '')), '\s+[-#(].*$', '', 'g'),
          '[^a-z0-9]', '', 'g'
        ),
        -- Trailing store numbers: "rayspizza4" -> "rayspizza".
        '[0-9]+$', '', 'g'
      ),
    '')
  ) stored;

create index if not exists accounts_brand_idx on public.accounts(org_id, brand_key);

-- Coordinates already exist but were never indexed for the "anything near
-- this point" question the duplicate check asks.
create index if not exists accounts_coords_idx
  on public.accounts(org_id, latitude, longitude)
  where latitude is not null;

-- ---------------------------------------------------------------------------
-- Backfill what we already know
-- ---------------------------------------------------------------------------
-- Scraped accounts have an address and a place id sitting in the lead pool,
-- reachable through the contact's legacy_id. No reason to leave them blank.

update public.accounts a
   set address  = coalesce(a.address, l.address),
       place_id = coalesce(a.place_id, l.place_id)
  from public.contacts c
  join public.nectarpay_leads l on l.place_id = c.legacy_id
 where c.account_id = a.id
   and c.legacy_id is not null
   and (a.address is null or a.place_id is null);

commit;

-- ---------------------------------------------------------------------------
-- Verify (run separately)
-- ---------------------------------------------------------------------------
-- select count(*) filter (where address is not null)  as with_address,
--        count(*) filter (where place_id is not null) as with_place_id,
--        count(*) filter (where latitude is null)     as no_coords,
--        count(*)                                     as total
--   from public.accounts;
--
-- Chains, largest first:
-- select brand_key, count(*), min(name) as example
--   from public.accounts where brand_key is not null
--  group by brand_key having count(*) > 1
--  order by 2 desc limit 20;
