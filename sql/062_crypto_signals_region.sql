-- 062_crypto_signals_region.sql
-- Crypto density becomes per region. Requires 058.
--
-- crypto_signals is reference data, not org data, so it never needed a
-- tenancy column. Regions changed that for a different reason: crypto_score
-- is a PERCENTILE within the dataset. Load Dallas ATMs into the same table
-- and every Phoenix lead's score silently re-ranks against a two-metro
-- distribution, and the map's density legend counts kiosks 900 miles away.

begin;

alter table public.crypto_signals
  add column if not exists region_id uuid references public.regions(id) on delete set null;

-- Every existing row is Arizona. Oldest PHX region wins, so a second
-- organization with its own PHX code cannot claim them.
update public.crypto_signals s
   set region_id = (
     select r.id from public.regions r
      where r.code = 'PHX'
      order by r.created_at
      limit 1
   )
 where s.region_id is null;

create index if not exists crypto_signals_region_idx on public.crypto_signals(region_id);

commit;

-- Verify:
-- select coalesce(r.code, '(none)') as region,
--        count(*) filter (where s.signal_type = 'atm') as atms,
--        count(*) filter (where s.signal_type = 'merchant') as merchants
--   from public.crypto_signals s
--   left join public.regions r on r.id = s.region_id
--  group by 1 order by 1;
--
-- The (none) row should be zero. Anything there is a signal the map will
-- show to everyone and count in every region's density.
