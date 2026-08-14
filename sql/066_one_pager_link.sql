-- 066_one_pager_link.sql
-- Requires 057 (get_pulse_events) and 058.
--
-- "Send the one-pager" needs something sendable. Until now the one-pager only
-- existed inside the app, rendered for printing - there was no URL a merchant
-- could open, so the Call Mode button logged an outcome for something that
-- never actually left the rep's phone.
--
-- The link is keyed on the lead's EXISTING pulse_token rather than a new one:
-- the shop already has it, the Pulse card already uses it, and reusing it
-- means one thing to revoke if a token ever has to be burned.
--
-- The page needs the REP's name, cell and email - a one-pager with no way to
-- reach a human is a brochure. Resolved through the contact that owns the
-- lead, which is the same path the campaign engine uses to pick a sender.

begin;

create or replace function public.get_one_pager(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_lead   record;
  v_owner  uuid;
  v_rep    record;
  v_prof   record;
begin
  select place_id, name, city, compliance_hold
    into v_lead
    from nectarpay_leads
   where pulse_token = p_token;

  if v_lead.place_id is null then
    return null;
  end if;

  -- A held shop is one nobody should be marketing to. The link dies with the
  -- hold rather than living on in somebody's texts.
  if v_lead.compliance_hold then
    return null;
  end if;

  select owner_id into v_owner
    from contacts
   where legacy_id = v_lead.place_id
     and owner_id is not null
   order by created_at
   limit 1;

  select first_name, cell, from_email into v_rep from reps where profile_id = v_owner;
  select full_name into v_prof from profiles where id = v_owner;

  -- Falls back to the default sending rep so an unassigned shop still gets a
  -- usable sheet instead of a blank contact block.
  if v_rep.first_name is null then
    select first_name, cell, from_email into v_rep
      from reps where is_default and active limit 1;
  end if;

  return jsonb_build_object(
    'shop', v_lead.name,
    'city', v_lead.city,
    'rep', jsonb_build_object(
      'first', coalesce(v_rep.first_name, split_part(coalesce(v_prof.full_name, ''), ' ', 1), 'your rep'),
      'cell',  coalesce(v_rep.cell, ''),
      'email', coalesce(v_rep.from_email, '')
    )
  );
end;
$function$;

-- anon so the merchant can open it without a login; authenticated so a rep
-- can preview exactly what they are about to send.
grant execute on function public.get_one_pager(text) to anon, authenticated;

commit;

-- Verify:
-- select public.get_one_pager(pulse_token)
--   from public.nectarpay_leads
--  where pulse_token is not null and not compliance_hold
--  limit 1;
