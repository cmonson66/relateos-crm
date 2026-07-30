-- ============================================================================
-- 019_crypto_accounts_sync.sql
-- Run AFTER 017 (crypto_signals + nectarpay_leads.crypto_score) and after at
-- least one `node crypto/score.js` run has populated those scores.
--
-- Carries crypto_score from nectarpay_leads onto accounts so the CRM can
-- sort and filter by it in SQL instead of only showing it on the map.
--
-- ADDITIVE ONLY: no DROP, no DELETE, no TRUNCATE. The one UPDATE touches
-- five named crypto_* columns and nothing else.
--
-- Join path: accounts has no place_id. The scraper's leads reach the CRM
-- through contacts.legacy_id, so the hop is
--   nectarpay_leads.place_id -> contacts.legacy_id -> contacts.account_id
-- ============================================================================

begin;

alter table accounts add column if not exists crypto_score          numeric;
alter table accounts add column if not exists crypto_atm_count      integer;
alter table accounts add column if not exists crypto_merchant_count integer;
alter table accounts add column if not exists crypto_nearest_atm_m  numeric;
alter table accounts add column if not exists crypto_scored_at      timestamptz;

create index if not exists accounts_crypto_score_idx
  on accounts (crypto_score desc nulls last);

create or replace function sync_crypto_to_accounts()
returns integer
language plpgsql
set search_path = public
as $$
declare
  touched integer;
begin
  update accounts a
     set crypto_score          = src.crypto_score,
         crypto_atm_count      = src.crypto_atm_count,
         crypto_merchant_count = src.crypto_merchant_count,
         crypto_nearest_atm_m  = src.crypto_nearest_atm_m,
         crypto_scored_at      = now()
    from (
           -- an account can carry several contacts; take the strongest
           -- signal among them, and the closest kiosk
           select c.account_id,
                  max(l.crypto_score)          as crypto_score,
                  max(l.crypto_atm_count)      as crypto_atm_count,
                  max(l.crypto_merchant_count) as crypto_merchant_count,
                  min(l.crypto_nearest_atm_m)  as crypto_nearest_atm_m
             from contacts c
             join nectarpay_leads l on l.place_id = c.legacy_id
            where c.account_id is not null
              and l.crypto_score is not null
            group by c.account_id
         ) src
   where a.id = src.account_id;

  get diagnostics touched = row_count;
  return touched;
end;
$$;

-- Backfill now, and report. A count of 0 means the join key is wrong --
-- stop and check that contacts.legacy_id actually holds Places place_ids.
do $$
declare
  n       integer;
  scored  integer;
  linked  integer;
begin
  select count(*) into scored from nectarpay_leads where crypto_score is not null;
  select count(*) into linked
    from contacts c join nectarpay_leads l on l.place_id = c.legacy_id
   where c.account_id is not null;

  n := sync_crypto_to_accounts();

  raise notice 'leads with a crypto score : %', scored;
  raise notice 'contacts linked to a lead : %', linked;
  raise notice 'accounts updated          : %', n;
end $$;

commit;
