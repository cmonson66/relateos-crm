-- 067_region_create_super_admin.sql
-- Requires 058.
--
-- Opening a new market is a commercial decision, not a settings change. Until
-- now 058's regions_write let any admin create one, which means a region -
-- and the scrape and the sending domain that follow it - could appear without
-- the person who runs the platform knowing.
--
-- Split by verb rather than tightening the whole policy:
--
--   INSERT  super_admin only. A new region is a new market.
--   DELETE  super_admin only. Deleting one cascades its campaign_settings and
--           nulls region_id across accounts, contacts, deals, terminals,
--           profiles and the lead pool. That is not an undo.
--   UPDATE  admin and above, unchanged. Tuning a send hour, a timezone or
--           turning a region off is day-to-day operations, and blocking it
--           would just route around the person it is protecting.
--
-- This is a speed bump, not a vault: anyone with the database password can do
-- as they like. What it buys is that a region cannot be opened by accident or
-- in passing, which is the realistic failure mode.

begin;

drop policy if exists regions_write on public.regions;

create policy regions_insert on public.regions
  for insert
  with check (org_id = my_org() and is_super_admin());

create policy regions_update on public.regions
  for update
  using      (org_id = my_org() and is_admin_or_above())
  with check (org_id = my_org() and is_admin_or_above());

create policy regions_delete on public.regions
  for delete
  using (org_id = my_org() and is_super_admin());

commit;

-- ---------------------------------------------------------------------------
-- Verify (run separately)
-- ---------------------------------------------------------------------------
-- select policyname, cmd from pg_policies
--  where schemaname = 'public' and tablename = 'regions'
--  order by cmd;
--
-- Expect four: regions_select (SELECT), regions_insert (INSERT),
-- regions_update (UPDATE), regions_delete (DELETE). regions_write should be
-- gone - if it is still listed, the drop did not take and admins can still
-- create regions through it.
