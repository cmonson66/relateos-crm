--
-- PostgreSQL database dump
--

\restrict khi35bcNfxegFi23jwbmh8x9Z8IbcOM4Ko9ON9JmeZefwu6ghBhs5pOrGKhctB9

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: activity_direction; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.activity_direction AS ENUM (
    'inbound',
    'outbound',
    'internal'
);


--
-- Name: activity_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.activity_type AS ENUM (
    'call',
    'email',
    'meeting',
    'note',
    'task'
);


--
-- Name: contact_lifecycle; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.contact_lifecycle AS ENUM (
    'new',
    'working',
    'engaged',
    'customer',
    'disqualified'
);


--
-- Name: entity_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.entity_type AS ENUM (
    'account',
    'contact',
    'deal',
    'activity',
    'task'
);


--
-- Name: notification_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notification_type AS ENUM (
    'mention',
    'task_assigned',
    'system_alert',
    'activity_reminder',
    'deal_stage_change'
);


--
-- Name: org_lock_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.org_lock_status AS ENUM (
    'active',
    'read_only',
    'locked'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'super_admin',
    'admin',
    'manager',
    'rep'
);


--
-- Name: vertical; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.vertical AS ENUM (
    'corporate',
    'sports',
    'public_safety',
    'military',
    'education',
    'other'
);


--
-- Name: app_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_role() RETURNS public.user_role
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1
$$;


--
-- Name: bump_last_activity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bump_last_activity() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.completed_at IS NOT NULL THEN
    IF NEW.account_id IS NOT NULL THEN
      UPDATE accounts SET last_activity_at = NEW.completed_at
      WHERE id = NEW.account_id
        AND (last_activity_at IS NULL OR last_activity_at < NEW.completed_at);
    END IF;
    IF NEW.contact_id IS NOT NULL THEN
      UPDATE contacts SET last_activity_at = NEW.completed_at
      WHERE id = NEW.contact_id
        AND (last_activity_at IS NULL OR last_activity_at < NEW.completed_at);
    END IF;
    IF NEW.deal_id IS NOT NULL THEN
      UPDATE deals SET last_activity_at = NEW.completed_at
      WHERE id = NEW.deal_id
        AND (last_activity_at IS NULL OR last_activity_at < NEW.completed_at);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: can_see_owner(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_see_owner(target_owner_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  viewer_id uuid;
  viewer_role text;
BEGIN
  viewer_id := auth.uid();
  IF viewer_id IS NULL THEN RETURN false; END IF;
  IF target_owner_id IS NULL THEN RETURN false; END IF;

  -- Self-ownership: always visible
  IF viewer_id = target_owner_id THEN RETURN true; END IF;

  -- Look up role
  SELECT role INTO viewer_role FROM profiles WHERE id = viewer_id;

  -- super_admin and admin: see everything
  IF viewer_role IN ('super_admin', 'admin') THEN RETURN true; END IF;

  -- manager: see anyone in their downward hierarchy
  IF viewer_role = 'manager' THEN
    RETURN target_owner_id IN (
      WITH RECURSIVE chain AS (
        SELECT id FROM profiles WHERE manager_id = viewer_id
        UNION
        SELECT p.id FROM profiles p
        JOIN chain c ON p.manager_id = c.id
      )
      SELECT id FROM chain
    );
  END IF;

  -- rep: only self
  RETURN false;
END;
$$;


--
-- Name: current_org_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_org_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT org_id FROM profiles WHERE id = auth.uid() LIMIT 1
$$;


--
-- Name: current_org_lock_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_org_lock_status() RETURNS public.org_lock_status
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT o.lock_status
  FROM profiles p
  JOIN organizations o ON o.id = p.org_id
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;


--
-- Name: enforce_lock_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_lock_status() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  status org_lock_status;
  caller_role text;
BEGIN
  -- Look up caller role first — super_admin always allowed
  SELECT role INTO caller_role FROM profiles WHERE id = auth.uid();
  IF caller_role = 'super_admin' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Look up org lock status from the row\'s org_id
  IF TG_OP = 'DELETE' THEN
    SELECT lock_status INTO status FROM organizations WHERE id = OLD.org_id;
  ELSE
    SELECT lock_status INTO status FROM organizations WHERE id = NEW.org_id;
  END IF;

  IF status = 'locked' THEN
    RAISE EXCEPTION 'Workspace is locked. Contact your super_admin.' USING ERRCODE = 'P0001';
  END IF;

  IF status = 'read_only' THEN
    RAISE EXCEPTION 'Workspace is in read-only mode. Contact your super_admin.' USING ERRCODE = 'P0001';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: fan_out_mention_notifications(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fan_out_mention_notifications() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  mentioned_id uuid;
  actor_name text;
BEGIN
  IF NEW.mentions IS NULL OR array_length(NEW.mentions, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO actor_name FROM profiles WHERE id = NEW.author_id;

  FOREACH mentioned_id IN ARRAY NEW.mentions LOOP
    IF mentioned_id != NEW.author_id THEN
      INSERT INTO notifications (org_id, recipient_id, actor_id, type, title, body, entity_type, entity_id)
      VALUES (
        NEW.org_id,
        mentioned_id,
        NEW.author_id,
        'mention',
        COALESCE(actor_name, 'Someone') || ' mentioned you',
        substring(NEW.body from 1 for 200),
        NEW.entity_type,
        NEW.entity_id
      );
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;


--
-- Name: fan_out_task_assignment(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fan_out_task_assignment() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  actor_name text;
BEGIN
  IF NEW.type != 'task' THEN RETURN NEW; END IF;
  IF NEW.assigned_to IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.assigned_to = NEW.assigned_to THEN RETURN NEW; END IF;
  IF NEW.assigned_to = COALESCE(NEW.assigned_by, NEW.owner_id) THEN RETURN NEW; END IF;

  SELECT full_name INTO actor_name FROM profiles
  WHERE id = COALESCE(NEW.assigned_by, NEW.owner_id);

  INSERT INTO notifications (org_id, recipient_id, actor_id, type, title, body, entity_type, entity_id)
  VALUES (
    NEW.org_id,
    NEW.assigned_to,
    COALESCE(NEW.assigned_by, NEW.owner_id),
    'task_assigned',
    COALESCE(actor_name, 'Someone') || ' assigned you a task',
    COALESCE(NEW.subject, NEW.assignment_note, 'New task'),
    'task',
    NEW.id
  );
  RETURN NEW;
END;
$$;


--
-- Name: handle_deal_stage_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_deal_stage_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  old_stage_name text;
  new_stage_name text;
  actor_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.stage_entered_at = COALESCE(NEW.stage_entered_at, now());
    RETURN NEW;
  END IF;

  IF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    NEW.stage_entered_at = now();

    SELECT name INTO old_stage_name FROM pipeline_stages WHERE id = OLD.stage_id;
    SELECT name INTO new_stage_name FROM pipeline_stages WHERE id = NEW.stage_id;

    actor_id := auth.uid();

    INSERT INTO audit_log (org_id, actor_id, entity_type, entity_id, action, changes)
    VALUES (
      NEW.org_id,
      actor_id,
      'deal',
      NEW.id,
      'stage_changed',
      jsonb_build_object(
        'stage', jsonb_build_object('from', old_stage_name, 'to', new_stage_name)
      )
    );

    -- If moved to a "won" stage, set closed_at
    IF (SELECT is_won FROM pipeline_stages WHERE id = NEW.stage_id) THEN
      NEW.closed_at = now();
    ELSIF (SELECT is_lost FROM pipeline_stages WHERE id = NEW.stage_id) THEN
      NEW.closed_at = now();
    ELSE
      NEW.closed_at = NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  default_org_id uuid;
BEGIN
  SELECT id INTO default_org_id FROM organizations WHERE slug = 'protoseq' LIMIT 1;
  INSERT INTO public.profiles (id, org_id, email, full_name)
  VALUES (
    new.id,
    default_org_id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  RETURN new;
END;
$$;


--
-- Name: is_admin_or_above(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin_or_above() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE((SELECT role IN ('admin','super_admin') FROM profiles WHERE id = auth.uid()), false)
$$;


--
-- Name: is_super_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_super_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE((SELECT role = 'super_admin' FROM profiles WHERE id = auth.uid()), false)
$$;


--
-- Name: notify_deal_stage_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_deal_stage_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  actor_id uuid;
  actor_name text;
  new_stage_name text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.stage_id IS DISTINCT FROM OLD.stage_id AND NEW.owner_id IS NOT NULL THEN
    actor_id := auth.uid();
    IF actor_id IS NULL OR actor_id = NEW.owner_id THEN
      RETURN NEW;
    END IF;

    SELECT full_name INTO actor_name FROM profiles WHERE id = actor_id;
    SELECT name INTO new_stage_name FROM pipeline_stages WHERE id = NEW.stage_id;

    INSERT INTO notifications (org_id, recipient_id, actor_id, type, title, body, entity_type, entity_id)
    VALUES (
      NEW.org_id,
      NEW.owner_id,
      actor_id,
      'deal_stage_change',
      COALESCE(actor_name, 'Someone') || ' moved a deal to ' || new_stage_name,
      NEW.name,
      'deal',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: reassign_and_delete_user(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reassign_and_delete_user(target_user_id uuid, successor_user_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  caller_id uuid;
  caller_role text;
  target_role text;
  successor_role text;
  caller_org uuid;
  target_org uuid;
  successor_org uuid;
  accounts_moved int;
  contacts_moved int;
  deals_moved int;
  activities_moved int;
  comments_moved int;
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF caller_id = target_user_id THEN
    RAISE EXCEPTION 'Cannot delete yourself';
  END IF;

  IF target_user_id = successor_user_id THEN
    RAISE EXCEPTION 'Successor cannot be the user being deleted';
  END IF;

  -- Look up actors
  SELECT role, org_id INTO caller_role, caller_org FROM profiles WHERE id = caller_id;
  SELECT role, org_id INTO target_role, target_org FROM profiles WHERE id = target_user_id;
  SELECT role, org_id INTO successor_role, successor_org FROM profiles WHERE id = successor_user_id;

  IF caller_role IS NULL THEN RAISE EXCEPTION 'Caller has no profile'; END IF;
  IF target_role IS NULL THEN RAISE EXCEPTION 'Target user not found'; END IF;
  IF successor_role IS NULL THEN RAISE EXCEPTION 'Successor user not found'; END IF;

  -- Org consistency
  IF caller_org != target_org THEN
    RAISE EXCEPTION 'Cannot delete user from another org';
  END IF;
  IF successor_org != target_org THEN
    RAISE EXCEPTION 'Successor must be in same org';
  END IF;

  -- Permission tiers
  IF caller_role = 'rep' THEN
    RAISE EXCEPTION 'Reps cannot delete users';
  END IF;

  IF caller_role = 'manager' THEN
    -- Manager can only delete their downstream reports
    IF target_user_id NOT IN (
      WITH RECURSIVE chain AS (
        SELECT id FROM profiles WHERE manager_id = caller_id
        UNION
        SELECT p.id FROM profiles p
        JOIN chain c ON p.manager_id = c.id
      )
      SELECT id FROM chain
    ) THEN
      RAISE EXCEPTION 'Manager can only delete their direct/indirect reports';
    END IF;
    -- And they cannot delete admins or super_admins
    IF target_role IN ('admin', 'super_admin') THEN
      RAISE EXCEPTION 'Manager cannot delete admins';
    END IF;
  END IF;

  IF caller_role = 'admin' THEN
    -- Admin cannot delete other admins or super_admins
    IF target_role IN ('admin', 'super_admin') THEN
      RAISE EXCEPTION 'Admin cannot delete other admins';
    END IF;
  END IF;

  -- super_admin can delete anyone (except themselves, checked above)

  -- Transfer ownership of records
  UPDATE accounts
    SET owner_id = successor_user_id
    WHERE owner_id = target_user_id;
  GET DIAGNOSTICS accounts_moved = ROW_COUNT;

  UPDATE contacts
    SET owner_id = successor_user_id
    WHERE owner_id = target_user_id;
  GET DIAGNOSTICS contacts_moved = ROW_COUNT;

  UPDATE deals
    SET owner_id = successor_user_id
    WHERE owner_id = target_user_id;
  GET DIAGNOSTICS deals_moved = ROW_COUNT;

  UPDATE activities
    SET owner_id = successor_user_id
    WHERE owner_id = target_user_id;
  GET DIAGNOSTICS activities_moved = ROW_COUNT;

  -- Reassign assigned tasks too
  UPDATE activities
    SET assigned_to = successor_user_id
    WHERE assigned_to = target_user_id;

  -- Reassign comments authored by target so the audit trail makes sense
  UPDATE comments
    SET author_id = successor_user_id
    WHERE author_id = target_user_id;
  GET DIAGNOSTICS comments_moved = ROW_COUNT;

  -- Reparent any users who had target as their manager
  UPDATE profiles
    SET manager_id = NULL
    WHERE manager_id = target_user_id;

  -- Update created_by / created_by-style fields
  UPDATE accounts SET created_by = successor_user_id WHERE created_by = target_user_id;
  UPDATE contacts SET created_by = successor_user_id WHERE created_by = target_user_id;
  UPDATE deals SET created_by = successor_user_id WHERE created_by = target_user_id;

  -- Audit-log this delete BEFORE removing target so we capture actor & target
  INSERT INTO audit_log (org_id, actor_id, entity_type, entity_id, action, changes)
  VALUES (
    caller_org,
    caller_id,
    'account',  -- using 'account' since entity_type enum doesn't have 'user';
                -- entity_id holds the deleted user id for forensic trail
    target_user_id,
    'deleted',
    jsonb_build_object(
      'kind', 'user_deleted',
      'successor', successor_user_id,
      'reassigned', jsonb_build_object(
        'accounts', accounts_moved,
        'contacts', contacts_moved,
        'deals', deals_moved,
        'activities', activities_moved,
        'comments', comments_moved
      )
    )
  );

  -- Now safely delete profile (cascade should handle dependent rows)
  DELETE FROM profiles WHERE id = target_user_id;

  -- Finally remove from auth.users — service-role bypass needed for this,
  -- so we rely on the calling Supabase admin API on the app side.
  -- This function returns the counts so the app can call admin.deleteUser next.
  RETURN json_build_object(
    'ok', true,
    'reassigned', json_build_object(
      'accounts', accounts_moved,
      'contacts', contacts_moved,
      'deals', deals_moved,
      'activities', activities_moved,
      'comments', comments_moved
    )
  );
END;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: team_owner_ids(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.team_owner_ids() RETURNS uuid[]
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE(array_agg(p.id), ARRAY[]::uuid[]) FROM profiles p
  WHERE p.manager_id = auth.uid() OR p.id = auth.uid()
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name text NOT NULL,
    vertical public.vertical DEFAULT 'corporate'::public.vertical NOT NULL,
    website text,
    industry text,
    employee_count integer,
    city text,
    state text,
    country text DEFAULT 'US'::text,
    notes text,
    tags text[] DEFAULT '{}'::text[],
    owner_id uuid,
    last_activity_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: activities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    type public.activity_type NOT NULL,
    direction public.activity_direction,
    subject text,
    body text,
    account_id uuid,
    contact_id uuid,
    deal_id uuid,
    scheduled_at timestamp with time zone,
    completed_at timestamp with time zone,
    duration_minutes integer,
    owner_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_to uuid,
    assigned_by uuid,
    assignment_note text,
    reminder_sent_at timestamp with time zone
);


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    actor_id uuid,
    entity_type public.entity_type NOT NULL,
    entity_id uuid NOT NULL,
    action text NOT NULL,
    changes jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    entity_type public.entity_type NOT NULL,
    entity_id uuid NOT NULL,
    parent_id uuid,
    author_id uuid NOT NULL,
    body text NOT NULL,
    mentions uuid[] DEFAULT '{}'::uuid[],
    edited_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: contact_cadences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_cadences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contact_id uuid NOT NULL,
    status text DEFAULT 'inactive'::text NOT NULL,
    current_step integer DEFAULT 0,
    started_at timestamp with time zone,
    paused_at timestamp with time zone
);


--
-- Name: contact_signals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_signals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contact_id uuid NOT NULL,
    priority_score integer,
    momentum text,
    momentum_score integer,
    reasoning text,
    computed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    account_id uuid,
    first_name text NOT NULL,
    last_name text,
    email text,
    phone text,
    title text,
    lifecycle_stage public.contact_lifecycle DEFAULT 'new'::public.contact_lifecycle NOT NULL,
    notes text,
    tags text[] DEFAULT '{}'::text[],
    owner_id uuid,
    last_activity_at timestamp with time zone,
    legacy_id text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    linkedin_url text,
    last_cold_alert_at timestamp with time zone
);


--
-- Name: deals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    account_id uuid NOT NULL,
    primary_contact_id uuid,
    name text NOT NULL,
    stage_id uuid NOT NULL,
    value_cents bigint DEFAULT 0,
    expected_close_date date,
    closed_at timestamp with time zone,
    notes text,
    tags text[] DEFAULT '{}'::text[],
    owner_id uuid,
    last_activity_at timestamp with time zone,
    stage_entered_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_stuck_alert_at timestamp with time zone
);


--
-- Name: pipeline_stages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pipeline_stages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    "position" integer NOT NULL,
    is_won boolean DEFAULT false NOT NULL,
    is_lost boolean DEFAULT false NOT NULL,
    color text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: deals_with_stage; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.deals_with_stage AS
 SELECT d.id,
    d.org_id,
    d.account_id,
    d.primary_contact_id,
    d.name,
    d.stage_id,
    d.value_cents,
    d.expected_close_date,
    d.closed_at,
    d.notes,
    d.tags,
    d.owner_id,
    d.last_activity_at,
    d.stage_entered_at,
    d.created_by,
    d.created_at,
    d.updated_at,
    d.last_stuck_alert_at,
    s.name AS stage_name,
    s.slug AS stage_slug,
    s."position" AS stage_position,
    s.color AS stage_color,
    s.is_won AS stage_is_won,
    s.is_lost AS stage_is_lost,
    ((EXTRACT(epoch FROM (now() - d.stage_entered_at)))::integer / 86400) AS days_in_stage,
    ((EXTRACT(epoch FROM (now() - d.created_at)))::integer / 86400) AS days_open
   FROM (public.deals d
     JOIN public.pipeline_stages s ON ((s.id = d.stage_id)));


--
-- Name: imports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.imports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    filename text,
    row_count integer DEFAULT 0 NOT NULL,
    success_count integer DEFAULT 0 NOT NULL,
    error_count integer DEFAULT 0 NOT NULL,
    errors jsonb DEFAULT '[]'::jsonb,
    status text DEFAULT 'pending'::text NOT NULL,
    imported_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    recipient_id uuid NOT NULL,
    actor_id uuid,
    type public.notification_type NOT NULL,
    title text NOT NULL,
    body text,
    entity_type public.entity_type,
    entity_id uuid,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    lock_status public.org_lock_status DEFAULT 'active'::public.org_lock_status NOT NULL,
    lock_message text,
    locked_at timestamp with time zone,
    locked_by uuid,
    brand_name text,
    brand_initial text,
    logo_url text,
    theme_primary text,
    theme_accent text,
    theme_background text,
    CONSTRAINT organizations_brand_initial_len CHECK (((brand_initial IS NULL) OR (char_length(brand_initial) <= 1)))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    org_id uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    role public.user_role DEFAULT 'rep'::public.user_role NOT NULL,
    manager_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    password_set_at timestamp with time zone
);


--
-- Name: system_rule_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_rule_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rule_name text NOT NULL,
    ran_at timestamp with time zone DEFAULT now() NOT NULL,
    duration_ms integer,
    notifications_created integer DEFAULT 0,
    errors jsonb,
    ok boolean DEFAULT true NOT NULL
);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: activities activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- Name: contact_cadences contact_cadences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_cadences
    ADD CONSTRAINT contact_cadences_pkey PRIMARY KEY (id);


--
-- Name: contact_signals contact_signals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_signals
    ADD CONSTRAINT contact_signals_pkey PRIMARY KEY (id);


--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);


--
-- Name: deals deals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_pkey PRIMARY KEY (id);


--
-- Name: imports imports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imports
    ADD CONSTRAINT imports_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_slug_key UNIQUE (slug);


--
-- Name: pipeline_stages pipeline_stages_org_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_stages
    ADD CONSTRAINT pipeline_stages_org_id_slug_key UNIQUE (org_id, slug);


--
-- Name: pipeline_stages pipeline_stages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_stages
    ADD CONSTRAINT pipeline_stages_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: system_rule_runs system_rule_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_rule_runs
    ADD CONSTRAINT system_rule_runs_pkey PRIMARY KEY (id);


--
-- Name: idx_accounts_last_activity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounts_last_activity ON public.accounts USING btree (last_activity_at DESC NULLS LAST);


--
-- Name: idx_accounts_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounts_org ON public.accounts USING btree (org_id);


--
-- Name: idx_accounts_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounts_owner ON public.accounts USING btree (owner_id);


--
-- Name: idx_accounts_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounts_tags ON public.accounts USING gin (tags);


--
-- Name: idx_accounts_vertical; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounts_vertical ON public.accounts USING btree (vertical);


--
-- Name: idx_activities_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activities_account ON public.activities USING btree (account_id);


--
-- Name: idx_activities_assigned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activities_assigned ON public.activities USING btree (assigned_to) WHERE ((assigned_to IS NOT NULL) AND (completed_at IS NULL));


--
-- Name: idx_activities_completed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activities_completed ON public.activities USING btree (completed_at DESC) WHERE (completed_at IS NOT NULL);


--
-- Name: idx_activities_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activities_contact ON public.activities USING btree (contact_id);


--
-- Name: idx_activities_deal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activities_deal ON public.activities USING btree (deal_id);


--
-- Name: idx_activities_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activities_org ON public.activities USING btree (org_id);


--
-- Name: idx_activities_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activities_owner ON public.activities USING btree (owner_id);


--
-- Name: idx_activities_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activities_scheduled ON public.activities USING btree (scheduled_at) WHERE ((scheduled_at IS NOT NULL) AND (completed_at IS NULL));


--
-- Name: idx_activities_timeline_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activities_timeline_account ON public.activities USING btree (account_id, COALESCE(completed_at, scheduled_at, created_at) DESC) WHERE (account_id IS NOT NULL);


--
-- Name: idx_activities_timeline_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activities_timeline_contact ON public.activities USING btree (contact_id, COALESCE(completed_at, scheduled_at, created_at) DESC) WHERE (contact_id IS NOT NULL);


--
-- Name: idx_activities_timeline_deal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activities_timeline_deal ON public.activities USING btree (deal_id, COALESCE(completed_at, scheduled_at, created_at) DESC) WHERE (deal_id IS NOT NULL);


--
-- Name: idx_audit_actor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_actor ON public.audit_log USING btree (actor_id, created_at DESC);


--
-- Name: idx_audit_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_entity ON public.audit_log USING btree (entity_type, entity_id, created_at DESC);


--
-- Name: idx_audit_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_org ON public.audit_log USING btree (org_id, created_at DESC);


--
-- Name: idx_comments_author; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comments_author ON public.comments USING btree (author_id);


--
-- Name: idx_comments_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comments_entity ON public.comments USING btree (entity_type, entity_id, created_at DESC);


--
-- Name: idx_comments_mentions; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comments_mentions ON public.comments USING gin (mentions);


--
-- Name: idx_contacts_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_account ON public.contacts USING btree (account_id);


--
-- Name: idx_contacts_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_email ON public.contacts USING btree (lower(email));


--
-- Name: idx_contacts_last_activity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_last_activity ON public.contacts USING btree (last_activity_at DESC NULLS LAST);


--
-- Name: idx_contacts_lifecycle; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_lifecycle ON public.contacts USING btree (lifecycle_stage);


--
-- Name: idx_contacts_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_org ON public.contacts USING btree (org_id);


--
-- Name: idx_contacts_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_owner ON public.contacts USING btree (owner_id);


--
-- Name: idx_deals_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deals_account ON public.deals USING btree (account_id);


--
-- Name: idx_deals_last_activity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deals_last_activity ON public.deals USING btree (last_activity_at DESC NULLS LAST);


--
-- Name: idx_deals_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deals_org ON public.deals USING btree (org_id);


--
-- Name: idx_deals_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deals_owner ON public.deals USING btree (owner_id);


--
-- Name: idx_deals_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deals_stage ON public.deals USING btree (stage_id);


--
-- Name: idx_notifications_recipient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_recipient ON public.notifications USING btree (recipient_id, created_at DESC);


--
-- Name: idx_notifications_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_unread ON public.notifications USING btree (recipient_id) WHERE (read_at IS NULL);


--
-- Name: idx_profiles_manager; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_manager ON public.profiles USING btree (manager_id);


--
-- Name: idx_profiles_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_org ON public.profiles USING btree (org_id);


--
-- Name: idx_profiles_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_role ON public.profiles USING btree (role);


--
-- Name: idx_rule_runs_by_rule; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rule_runs_by_rule ON public.system_rule_runs USING btree (rule_name, ran_at DESC);


--
-- Name: idx_rule_runs_recent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rule_runs_recent ON public.system_rule_runs USING btree (ran_at DESC);


--
-- Name: activities bump_activity_on_complete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER bump_activity_on_complete AFTER INSERT OR UPDATE ON public.activities FOR EACH ROW EXECUTE FUNCTION public.bump_last_activity();


--
-- Name: comments comments_fanout_mentions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER comments_fanout_mentions AFTER INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION public.fan_out_mention_notifications();


--
-- Name: deals deal_stage_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER deal_stage_change BEFORE INSERT OR UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.handle_deal_stage_change();


--
-- Name: deals deal_stage_notify; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER deal_stage_notify AFTER UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.notify_deal_stage_change();


--
-- Name: accounts enforce_lock_status_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_lock_status_trigger BEFORE INSERT OR DELETE OR UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.enforce_lock_status();


--
-- Name: activities enforce_lock_status_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_lock_status_trigger BEFORE INSERT OR DELETE OR UPDATE ON public.activities FOR EACH ROW EXECUTE FUNCTION public.enforce_lock_status();


--
-- Name: comments enforce_lock_status_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_lock_status_trigger BEFORE INSERT OR DELETE OR UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.enforce_lock_status();


--
-- Name: contacts enforce_lock_status_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_lock_status_trigger BEFORE INSERT OR DELETE OR UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.enforce_lock_status();


--
-- Name: deals enforce_lock_status_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_lock_status_trigger BEFORE INSERT OR DELETE OR UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.enforce_lock_status();


--
-- Name: imports enforce_lock_status_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_lock_status_trigger BEFORE INSERT OR DELETE OR UPDATE ON public.imports FOR EACH ROW EXECUTE FUNCTION public.enforce_lock_status();


--
-- Name: notifications enforce_lock_status_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_lock_status_trigger BEFORE INSERT OR DELETE OR UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.enforce_lock_status();


--
-- Name: accounts set_updated_at_accounts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_accounts BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: activities set_updated_at_activities; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_activities BEFORE UPDATE ON public.activities FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: comments set_updated_at_comments; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_comments BEFORE UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: contacts set_updated_at_contacts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_contacts BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: deals set_updated_at_deals; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_deals BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: organizations set_updated_at_organizations; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_organizations BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: profiles set_updated_at_profiles; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_profiles BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: activities tasks_fanout_assignment; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tasks_fanout_assignment AFTER INSERT OR UPDATE OF assigned_to ON public.activities FOR EACH ROW EXECUTE FUNCTION public.fan_out_task_assignment();


--
-- Name: accounts accounts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: accounts accounts_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: accounts accounts_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: activities activities_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: activities activities_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: activities activities_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: activities activities_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: activities activities_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE CASCADE;


--
-- Name: activities activities_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: activities activities_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: audit_log audit_log_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: audit_log audit_log_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: comments comments_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: comments comments_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: comments comments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.comments(id) ON DELETE CASCADE;


--
-- Name: contact_cadences contact_cadences_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_cadences
    ADD CONSTRAINT contact_cadences_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: contact_signals contact_signals_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_signals
    ADD CONSTRAINT contact_signals_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: contacts contacts_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;


--
-- Name: contacts contacts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: contacts contacts_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: contacts contacts_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: deals deals_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: deals deals_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: deals deals_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: deals deals_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: deals deals_primary_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_primary_contact_id_fkey FOREIGN KEY (primary_contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: deals deals_stage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES public.pipeline_stages(id);


--
-- Name: imports imports_imported_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imports
    ADD CONSTRAINT imports_imported_by_fkey FOREIGN KEY (imported_by) REFERENCES public.profiles(id);


--
-- Name: imports imports_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imports
    ADD CONSTRAINT imports_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: notifications notifications_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: notifications notifications_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: organizations organizations_locked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_locked_by_fkey FOREIGN KEY (locked_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: pipeline_stages pipeline_stages_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_stages
    ADD CONSTRAINT pipeline_stages_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: accounts accounts_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY accounts_delete ON public.accounts FOR DELETE USING ((public.is_super_admin() OR (public.is_admin_or_above() AND (org_id = public.current_org_id()))));


--
-- Name: accounts accounts_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY accounts_insert ON public.accounts FOR INSERT WITH CHECK ((org_id = public.current_org_id()));


--
-- Name: accounts accounts_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY accounts_select ON public.accounts FOR SELECT USING ((public.is_super_admin() OR ((org_id = public.current_org_id()) AND (public.can_see_owner(owner_id) OR ((owner_id IS NULL) AND public.is_admin_or_above())))));


--
-- Name: accounts accounts_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY accounts_update ON public.accounts FOR UPDATE USING ((public.is_super_admin() OR (public.is_admin_or_above() AND (org_id = public.current_org_id())) OR ((public.app_role() = 'manager'::public.user_role) AND (owner_id = ANY (public.team_owner_ids()))) OR (owner_id = auth.uid())));


--
-- Name: activities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

--
-- Name: activities activities_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY activities_delete ON public.activities FOR DELETE USING ((public.is_super_admin() OR (public.is_admin_or_above() AND (org_id = public.current_org_id())) OR (owner_id = auth.uid())));


--
-- Name: activities activities_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY activities_insert ON public.activities FOR INSERT WITH CHECK (((org_id = public.current_org_id()) AND (owner_id = auth.uid())));


--
-- Name: activities activities_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY activities_select ON public.activities FOR SELECT USING ((public.is_super_admin() OR ((org_id = public.current_org_id()) AND (public.can_see_owner(owner_id) OR ((assigned_to IS NOT NULL) AND public.can_see_owner(assigned_to))))));


--
-- Name: activities activities_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY activities_update ON public.activities FOR UPDATE USING ((public.is_super_admin() OR (public.is_admin_or_above() AND (org_id = public.current_org_id())) OR (owner_id = auth.uid())));


--
-- Name: audit_log audit_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_insert ON public.audit_log FOR INSERT WITH CHECK ((org_id = public.current_org_id()));


--
-- Name: audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_log audit_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_select ON public.audit_log FOR SELECT USING ((public.is_super_admin() OR ((org_id = public.current_org_id()) AND public.is_admin_or_above()) OR (actor_id = auth.uid())));


--
-- Name: contact_cadences cadences_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cadences_all ON public.contact_cadences USING (true);


--
-- Name: comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

--
-- Name: comments comments_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comments_delete ON public.comments FOR DELETE USING (((author_id = auth.uid()) OR public.is_admin_or_above()));


--
-- Name: comments comments_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comments_insert ON public.comments FOR INSERT WITH CHECK (((org_id = public.current_org_id()) AND (author_id = auth.uid())));


--
-- Name: comments comments_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comments_select ON public.comments FOR SELECT USING ((public.is_super_admin() OR (org_id = public.current_org_id())));


--
-- Name: comments comments_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comments_update ON public.comments FOR UPDATE USING (((author_id = auth.uid()) OR public.is_admin_or_above()));


--
-- Name: contact_cadences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contact_cadences ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_signals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contact_signals ENABLE ROW LEVEL SECURITY;

--
-- Name: contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: contacts contacts_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contacts_delete ON public.contacts FOR DELETE USING ((public.is_super_admin() OR (public.is_admin_or_above() AND (org_id = public.current_org_id()))));


--
-- Name: contacts contacts_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contacts_insert ON public.contacts FOR INSERT WITH CHECK ((org_id = public.current_org_id()));


--
-- Name: contacts contacts_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contacts_select ON public.contacts FOR SELECT USING ((public.is_super_admin() OR ((org_id = public.current_org_id()) AND (public.can_see_owner(owner_id) OR ((owner_id IS NULL) AND public.is_admin_or_above())))));


--
-- Name: contacts contacts_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contacts_update ON public.contacts FOR UPDATE USING ((public.is_super_admin() OR (public.is_admin_or_above() AND (org_id = public.current_org_id())) OR ((public.app_role() = 'manager'::public.user_role) AND (owner_id = ANY (public.team_owner_ids()))) OR (owner_id = auth.uid())));


--
-- Name: deals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

--
-- Name: deals deals_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deals_delete ON public.deals FOR DELETE USING ((public.is_super_admin() OR (public.is_admin_or_above() AND (org_id = public.current_org_id()))));


--
-- Name: deals deals_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deals_insert ON public.deals FOR INSERT WITH CHECK ((org_id = public.current_org_id()));


--
-- Name: deals deals_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deals_select ON public.deals FOR SELECT USING ((public.is_super_admin() OR ((org_id = public.current_org_id()) AND (public.can_see_owner(owner_id) OR ((owner_id IS NULL) AND public.is_admin_or_above())))));


--
-- Name: deals deals_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deals_update ON public.deals FOR UPDATE USING ((public.is_super_admin() OR (public.is_admin_or_above() AND (org_id = public.current_org_id())) OR ((public.app_role() = 'manager'::public.user_role) AND (owner_id = ANY (public.team_owner_ids()))) OR (owner_id = auth.uid())));


--
-- Name: imports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.imports ENABLE ROW LEVEL SECURITY;

--
-- Name: imports imports_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY imports_admin ON public.imports USING ((public.is_super_admin() OR (public.is_admin_or_above() AND (org_id = public.current_org_id()))));


--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications notifications_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_insert ON public.notifications FOR INSERT WITH CHECK ((org_id = public.current_org_id()));


--
-- Name: notifications notifications_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_select ON public.notifications FOR SELECT USING (((recipient_id = auth.uid()) OR public.is_super_admin()));


--
-- Name: notifications notifications_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_update ON public.notifications FOR UPDATE USING ((recipient_id = auth.uid()));


--
-- Name: organizations org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_select ON public.organizations FOR SELECT USING ((public.is_super_admin() OR (id = public.current_org_id())));


--
-- Name: organizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations organizations_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY organizations_select ON public.organizations FOR SELECT USING (((id = public.current_org_id()) OR public.is_super_admin()));


--
-- Name: organizations organizations_update_super_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY organizations_update_super_admin ON public.organizations FOR UPDATE USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());


--
-- Name: pipeline_stages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_insert_admin ON public.profiles FOR INSERT WITH CHECK (public.is_admin_or_above());


--
-- Name: profiles profiles_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select ON public.profiles FOR SELECT USING ((public.is_super_admin() OR (org_id = public.current_org_id())));


--
-- Name: profiles profiles_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update ON public.profiles FOR UPDATE USING (((id = auth.uid()) OR public.is_admin_or_above()));


--
-- Name: profiles profiles_update_self_password_marker; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update_self_password_marker ON public.profiles FOR UPDATE USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));


--
-- Name: system_rule_runs rule_runs_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rule_runs_insert ON public.system_rule_runs FOR INSERT WITH CHECK (true);


--
-- Name: system_rule_runs rule_runs_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rule_runs_select ON public.system_rule_runs FOR SELECT USING (public.is_super_admin());


--
-- Name: contact_signals signals_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY signals_all ON public.contact_signals USING (true);


--
-- Name: pipeline_stages stages_modify; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stages_modify ON public.pipeline_stages USING ((public.is_super_admin() OR (public.is_admin_or_above() AND (org_id = public.current_org_id()))));


--
-- Name: pipeline_stages stages_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stages_select ON public.pipeline_stages FOR SELECT USING ((public.is_super_admin() OR (org_id = public.current_org_id())));


--
-- Name: system_rule_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.system_rule_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION app_role(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.app_role() TO anon;
GRANT ALL ON FUNCTION public.app_role() TO authenticated;
GRANT ALL ON FUNCTION public.app_role() TO service_role;


--
-- Name: FUNCTION bump_last_activity(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.bump_last_activity() TO anon;
GRANT ALL ON FUNCTION public.bump_last_activity() TO authenticated;
GRANT ALL ON FUNCTION public.bump_last_activity() TO service_role;


--
-- Name: FUNCTION can_see_owner(target_owner_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.can_see_owner(target_owner_id uuid) TO anon;
GRANT ALL ON FUNCTION public.can_see_owner(target_owner_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.can_see_owner(target_owner_id uuid) TO service_role;


--
-- Name: FUNCTION current_org_id(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.current_org_id() TO anon;
GRANT ALL ON FUNCTION public.current_org_id() TO authenticated;
GRANT ALL ON FUNCTION public.current_org_id() TO service_role;


--
-- Name: FUNCTION current_org_lock_status(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.current_org_lock_status() TO anon;
GRANT ALL ON FUNCTION public.current_org_lock_status() TO authenticated;
GRANT ALL ON FUNCTION public.current_org_lock_status() TO service_role;


--
-- Name: FUNCTION enforce_lock_status(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.enforce_lock_status() TO anon;
GRANT ALL ON FUNCTION public.enforce_lock_status() TO authenticated;
GRANT ALL ON FUNCTION public.enforce_lock_status() TO service_role;


--
-- Name: FUNCTION fan_out_mention_notifications(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fan_out_mention_notifications() TO anon;
GRANT ALL ON FUNCTION public.fan_out_mention_notifications() TO authenticated;
GRANT ALL ON FUNCTION public.fan_out_mention_notifications() TO service_role;


--
-- Name: FUNCTION fan_out_task_assignment(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fan_out_task_assignment() TO anon;
GRANT ALL ON FUNCTION public.fan_out_task_assignment() TO authenticated;
GRANT ALL ON FUNCTION public.fan_out_task_assignment() TO service_role;


--
-- Name: FUNCTION handle_deal_stage_change(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.handle_deal_stage_change() TO anon;
GRANT ALL ON FUNCTION public.handle_deal_stage_change() TO authenticated;
GRANT ALL ON FUNCTION public.handle_deal_stage_change() TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION is_admin_or_above(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_admin_or_above() TO anon;
GRANT ALL ON FUNCTION public.is_admin_or_above() TO authenticated;
GRANT ALL ON FUNCTION public.is_admin_or_above() TO service_role;


--
-- Name: FUNCTION is_super_admin(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_super_admin() TO anon;
GRANT ALL ON FUNCTION public.is_super_admin() TO authenticated;
GRANT ALL ON FUNCTION public.is_super_admin() TO service_role;


--
-- Name: FUNCTION notify_deal_stage_change(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.notify_deal_stage_change() TO anon;
GRANT ALL ON FUNCTION public.notify_deal_stage_change() TO authenticated;
GRANT ALL ON FUNCTION public.notify_deal_stage_change() TO service_role;


--
-- Name: FUNCTION reassign_and_delete_user(target_user_id uuid, successor_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.reassign_and_delete_user(target_user_id uuid, successor_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.reassign_and_delete_user(target_user_id uuid, successor_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.reassign_and_delete_user(target_user_id uuid, successor_user_id uuid) TO service_role;


--
-- Name: FUNCTION set_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_updated_at() TO service_role;


--
-- Name: FUNCTION team_owner_ids(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.team_owner_ids() TO anon;
GRANT ALL ON FUNCTION public.team_owner_ids() TO authenticated;
GRANT ALL ON FUNCTION public.team_owner_ids() TO service_role;


--
-- Name: TABLE accounts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.accounts TO anon;
GRANT ALL ON TABLE public.accounts TO authenticated;
GRANT ALL ON TABLE public.accounts TO service_role;


--
-- Name: TABLE activities; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.activities TO anon;
GRANT ALL ON TABLE public.activities TO authenticated;
GRANT ALL ON TABLE public.activities TO service_role;


--
-- Name: TABLE audit_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.audit_log TO anon;
GRANT ALL ON TABLE public.audit_log TO authenticated;
GRANT ALL ON TABLE public.audit_log TO service_role;


--
-- Name: TABLE comments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.comments TO anon;
GRANT ALL ON TABLE public.comments TO authenticated;
GRANT ALL ON TABLE public.comments TO service_role;


--
-- Name: TABLE contact_cadences; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.contact_cadences TO anon;
GRANT ALL ON TABLE public.contact_cadences TO authenticated;
GRANT ALL ON TABLE public.contact_cadences TO service_role;


--
-- Name: TABLE contact_signals; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.contact_signals TO anon;
GRANT ALL ON TABLE public.contact_signals TO authenticated;
GRANT ALL ON TABLE public.contact_signals TO service_role;


--
-- Name: TABLE contacts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.contacts TO anon;
GRANT ALL ON TABLE public.contacts TO authenticated;
GRANT ALL ON TABLE public.contacts TO service_role;


--
-- Name: TABLE deals; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.deals TO anon;
GRANT ALL ON TABLE public.deals TO authenticated;
GRANT ALL ON TABLE public.deals TO service_role;


--
-- Name: TABLE pipeline_stages; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.pipeline_stages TO anon;
GRANT ALL ON TABLE public.pipeline_stages TO authenticated;
GRANT ALL ON TABLE public.pipeline_stages TO service_role;


--
-- Name: TABLE deals_with_stage; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.deals_with_stage TO anon;
GRANT ALL ON TABLE public.deals_with_stage TO authenticated;
GRANT ALL ON TABLE public.deals_with_stage TO service_role;


--
-- Name: TABLE imports; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.imports TO anon;
GRANT ALL ON TABLE public.imports TO authenticated;
GRANT ALL ON TABLE public.imports TO service_role;


--
-- Name: TABLE notifications; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.notifications TO anon;
GRANT ALL ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;


--
-- Name: TABLE organizations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.organizations TO anon;
GRANT ALL ON TABLE public.organizations TO authenticated;
GRANT ALL ON TABLE public.organizations TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE system_rule_runs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.system_rule_runs TO anon;
GRANT ALL ON TABLE public.system_rule_runs TO authenticated;
GRANT ALL ON TABLE public.system_rule_runs TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict khi35bcNfxegFi23jwbmh8x9Z8IbcOM4Ko9ON9JmeZefwu6ghBhs5pOrGKhctB9

