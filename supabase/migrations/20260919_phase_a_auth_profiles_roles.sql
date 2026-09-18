-- ==========================================================
-- CHARMS HUB AI — PHASE A: AUTH PROFILES, ROLES & RLS HARDENING
-- Supabase Auth  →  user_profiles  →  authoritative role
--
-- Requires: 20260918_charms_hub_master.sql (already applied)
-- Safe to re-run: all statements are idempotent.
-- ==========================================================

-- ----------------------------------------------------------
-- 1. SIGNUP TRIGGER: every new auth user gets a user_profiles
--    row with the least-privileged role ('customer').
--    Role is NEVER taken from client-provided metadata.
-- ----------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
      SPLIT_PART(COALESCE(NEW.email, 'charms_user'), '@', 1)
    ),
    'customer'::user_role_type
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------
-- 2. BACKFILL: create profiles for auth users that predate
--    this migration (role defaults to 'customer').
-- ----------------------------------------------------------

INSERT INTO public.user_profiles (id, email, full_name, role)
SELECT
  u.id,
  COALESCE(u.email, ''),
  COALESCE(
    NULLIF(u.raw_user_meta_data ->> 'full_name', ''),
    SPLIT_PART(COALESCE(u.email, 'charms_user'), '@', 1)
  ),
  'customer'::user_role_type
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = u.id);

-- ----------------------------------------------------------
-- 3. ROLE-ESCALATION GUARD: block any role change unless the
--    acting user is a developer (or the operation runs without
--    a user JWT, i.e. trusted backend/maintenance context,
--    which is still gated by RLS).
-- ----------------------------------------------------------

CREATE OR REPLACE FUNCTION public.prevent_unauthorized_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF auth.uid() IS NOT NULL
       AND COALESCE(public.get_user_role(auth.uid()), '') IS DISTINCT FROM 'developer' THEN
      RAISE EXCEPTION 'Role changes require developer privileges';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.user_profiles;

CREATE TRIGGER trg_prevent_role_escalation
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_unauthorized_role_change();

-- ----------------------------------------------------------
-- 4. user_profiles RLS: users see/update only their own
--    profile; developers can read all profiles. There is
--    deliberately NO insert or delete policy for end users
--    (rows are created by the signup trigger, removed only
--    via auth.users cascade).
-- ----------------------------------------------------------

DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
CREATE POLICY "Users can view own profile"
  ON public.user_profiles
  FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Developers can view all profiles" ON public.user_profiles;
CREATE POLICY "Developers can view all profiles"
  ON public.user_profiles
  FOR SELECT
  USING (public.get_user_role(auth.uid()) = 'developer');

-- ----------------------------------------------------------
-- 5. SERVER-SIDE ROLE MANAGEMENT: developers promote/demote
--    through this SECURITY DEFINER RPC only. The role change
--    is recorded in the audit trail. Direct table updates by
--    developers are still limited to their own row.
-- ----------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_user_role(target_user_id UUID, new_role user_role_type)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
BEGIN
  caller_role := COALESCE(public.get_user_role(auth.uid()), '');
  IF caller_role IS DISTINCT FROM 'developer' THEN
    RAISE EXCEPTION 'Only developers can change user roles';
  END IF;

  UPDATE public.user_profiles
  SET role = new_role, updated_at = NOW()
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target user profile not found';
  END IF;

  INSERT INTO public.activity_logs (id, user_id, user_email, role, event_type, entity_type, entity_id, metadata)
  VALUES (
    'log_' || EXTRACT(EPOCH FROM NOW())::bigint || '_' || SUBSTR(MD5(RANDOM()::text), 1, 6),
    auth.uid()::text,
    COALESCE((SELECT email FROM public.user_profiles WHERE id = auth.uid()), 'developer'),
    'developer',
    'role_changed',
    'user_profile',
    target_user_id::text,
    JSONB_BUILD_OBJECT('target_user_id', target_user_id, 'new_role', new_role)
  );

  RETURN 'OK';
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_role(UUID, user_role_type) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_user_role(UUID, user_role_type) TO authenticated;

-- ----------------------------------------------------------
-- 6. DEMO ACCOUNTS (hackathon evaluation):
--    Three real Supabase auth users so the login page demo
--    buttons authenticate against the real identity provider.
--    Their roles live in user_profiles (database-backed), so
--    these accounts confer no client-side escalation path.
--    Passwords are bcrypt-hashed via pgcrypto.
-- ----------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pgcrypto;

SET search_path = public, extensions;

WITH seed(email, full_name) AS (
  VALUES
    ('shopper@charmshub.ai',   'Demo Shopper'),
    ('owner@charmshub.ai',     'Demo Owner'),
    ('developer@charmshub.ai', 'Demo Developer')
),
inserted AS (
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, last_sign_in_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    phone_change, phone_change_token
  )
  SELECT
    NULL, gen_random_uuid(), 'authenticated', 'authenticated',
    s.email, crypt('demo1234', gen_salt('bf')),
    NOW(), NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    JSONB_BUILD_OBJECT('full_name', s.full_name),
    NOW(), NOW(),
    '', '', '', '', '', ''
  FROM seed s
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.email = s.email)
  RETURNING id, email
)
INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT
  i.id::text,
  i.id,
  JSONB_BUILD_OBJECT('sub', i.id::text, 'email', i.email, 'email_verified', true),
  'email',
  NOW(), NOW(), NOW()
FROM inserted i;
-- The signup trigger fired above created profiles with role
-- 'customer'; promote the demo accounts to their intended roles.
UPDATE public.user_profiles p
SET role = CASE u.email
             WHEN 'owner@charmshub.ai'     THEN 'shop_owner'::user_role_type
             WHEN 'developer@charmshub.ai' THEN 'developer'::user_role_type
             ELSE 'customer'::user_role_type
           END,
    updated_at = NOW()
FROM auth.users u
WHERE u.id = p.id
  AND u.email IN ('shopper@charmshub.ai', 'owner@charmshub.ai', 'developer@charmshub.ai');

RESET search_path;
