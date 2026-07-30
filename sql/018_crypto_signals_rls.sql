-- ============================================================================
-- 018_crypto_signals_rls.sql
-- Run AFTER 017_crypto_signals.sql.
--
-- The CRM reads crypto_signals through the browser session, and every other
-- table in this database has RLS on. Without a policy the map would either
-- see nothing (RLS on, no policy) or expose the table to anon (RLS off).
--
-- These are public ATM locations, not org-scoped records, so every signed-in
-- user reads all rows. Writes stay closed: the scraper uses the service role
-- key, which bypasses RLS entirely.
-- ============================================================================

begin;

alter table crypto_signals enable row level security;

drop policy if exists crypto_signals_select on crypto_signals;
create policy crypto_signals_select
  on crypto_signals
  for select
  to authenticated
  using (true);

commit;
