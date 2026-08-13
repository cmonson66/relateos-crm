-- 059_region_visibility.sql
-- Regions become a visibility dimension. Requires 058.
--
-- THE SHAPE: reads widen, writes do not. A manager gains read access to their
-- whole region; write permissions stay exactly what they are today and gain a
-- region fence on top. Widening a write policy later is easy; discovering that
-- two regions have been editing each other's records is not.
--
-- This also closes a gap that predates regions: accounts and contacts never
-- had a manager branch at all, while deals did, so a manager could see a deal
-- and not open the account under it.
--
-- Run as bare statements in the Supabase SQL editor.

begin;

-- ---------------------------------------------------------------------------
-- 1. can_see_region()
-- ---------------------------------------------------------------------------
-- corporate (super_admin/admin, active) -> every region, plus rows whose
--   region is still NULL, so nothing can hide from the top
-- manager -> their own region only
-- rep -> false; a rep's scope is their book, which the policies handle
--   separately via owner_id
--
-- Checks is_active, which can_see_owner() does not - a deactivated manager
-- currently still passes that function. Not fixed here, but noted.

create or replace function public.can_see_region(target_region_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_role   user_role;
  v_region uuid;
  v_active boolean;
begin
  select role, region_id, is_active
    into v_role, v_region, v_active
    from profiles where id = auth.uid();

  if v_role is null or not v_active then
    return false;
  end if;

  if v_role in ('super_admin', 'admin') then
    return true;
  end if;

  if v_role = 'manager' then
    -- A manager with no region set is not region-limited, it is unplaced.
    -- Fail closed: they fall back to their own book.
    if v_region is null or target_region_id is null then
      return false;
    end if;
    return target_region_id = v_region;
  end if;

  return false;
end;
$function$;

grant execute on function public.can_see_region(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Accounts and contacts - reads gain a region branch
-- ---------------------------------------------------------------------------
-- Update and delete are deliberately untouched. Reassigning an account is
-- already admin-only in the app (bulkAssignAccounts), so a read-only manager
-- is consistent with how the product behaves today.
--
-- TO GIVE MANAGERS WRITE ON THEIR REGION LATER, the change is one clause in
-- each of accounts_update and contacts_update:
--     ... or (app_role() = 'manager' and can_see_region(region_id))
-- added to both using and with check.

drop policy if exists accounts_select on public.accounts;
create policy accounts_select on public.accounts
  for select using (
    org_id = my_org()
    and (owner_id = auth.uid() or can_see_region(region_id))
  );

drop policy if exists contacts_select on public.contacts;
create policy contacts_select on public.contacts
  for select using (
    org_id = my_org()
    and (owner_id = auth.uid() or can_see_region(region_id))
  );

-- ---------------------------------------------------------------------------
-- 3. Deals
-- ---------------------------------------------------------------------------
-- select: keeps can_see_owner() so an existing reporting line still works,
-- and adds the region branch beside it.
--
-- update: unchanged except that the manager branch is now fenced to their
-- region. team_owner_ids() is left alone on purpose - it is flat (direct
-- reports only) while can_see_owner() is recursive, and reconciling those two
-- is a separate decision from this migration.

drop policy if exists deals_select on public.deals;
create policy deals_select on public.deals
  for select using (
    is_super_admin()
    or (
      org_id = current_org_id()
      and (
        can_see_owner(owner_id)
        or can_see_region(region_id)
        or (owner_id is null and is_admin_or_above())
      )
    )
  );

drop policy if exists deals_update on public.deals;
create policy deals_update on public.deals
  for update using (
    is_super_admin()
    or (is_admin_or_above() and org_id = current_org_id())
    or (
      app_role() = 'manager'
      and owner_id = any(team_owner_ids())
      and region_id = my_region()
    )
    or owner_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- 4. Terminals
-- ---------------------------------------------------------------------------
-- terminals_all was FOR ALL with org_id = current_org_id() and nothing else,
-- so every rep could read, edit and delete every unit in the company. With two
-- regions a DFW rep could mark a Phoenix terminal lost.
--
-- Inventory is hardware, not customer data, so region-mates can see it - a rep
-- needs to read their region's serials for deployTerminal's "already in a
-- different shop" guard to refuse readably instead of hitting a unique
-- violation. Reps keep insert and update, because adding a hardware line item
-- to a deal calls deployTerminal under the rep's own session. DELETE is the
-- one that narrows: admin, or a manager inside their region.

drop policy if exists terminals_all on public.terminals;

create policy terminals_select on public.terminals
  for select using (
    org_id = my_org()
    and (is_admin_visible() or region_id = my_region() or held_by_profile_id = auth.uid())
  );

create policy terminals_insert on public.terminals
  for insert with check (
    org_id = my_org()
    and (is_admin_visible() or region_id = my_region() or region_id is null)
  );

create policy terminals_update on public.terminals
  for update
  using      (org_id = my_org() and (is_admin_visible() or region_id = my_region()))
  with check (org_id = my_org() and (is_admin_visible() or region_id = my_region()));

create policy terminals_delete on public.terminals
  for delete using (
    org_id = my_org()
    and (is_admin_visible() or (app_role() = 'manager' and region_id = my_region()))
  );

-- ---------------------------------------------------------------------------
-- 5. New terminals land in a region
-- ---------------------------------------------------------------------------
-- 058's inherit trigger covers contacts and deals, which always have an
-- account. A terminal received into stock has no account yet, so it takes the
-- region of whoever is receiving it. Without this, receiving a batch creates
-- region-NULL rows that no manager can see.

create or replace function public.terminals_default_region()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.region_id is null and new.account_id is not null then
    select a.region_id into new.region_id from public.accounts a where a.id = new.account_id;
  end if;
  if new.region_id is null then
    select p.region_id into new.region_id from public.profiles p where p.id = auth.uid();
  end if;
  return new;
end;
$function$;

drop trigger if exists terminals_set_region on public.terminals;
create trigger terminals_set_region
  before insert or update of account_id on public.terminals
  for each row execute function public.terminals_default_region();

commit;

-- ---------------------------------------------------------------------------
-- Verify (run separately)
-- ---------------------------------------------------------------------------
-- select tablename, policyname, cmd from pg_policies
-- where schemaname = 'public'
--   and tablename in ('accounts','contacts','deals','terminals')
-- order by tablename, cmd, policyname;
--
-- Expect: accounts and contacts unchanged in count, deals unchanged in count,
-- and terminals now showing four policies where terminals_all used to be one.
