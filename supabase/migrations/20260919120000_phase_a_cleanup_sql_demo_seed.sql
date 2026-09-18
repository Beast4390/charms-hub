-- ==========================================================
-- CHARMS HUB AI — PHASE A CLEANUP: REMOVE SQL-SEEDED DEMO USERS
--
-- The demo accounts inserted directly into auth.users in
-- 20260919_phase_a_auth_profiles_roles.sql are not visible to
-- GoTrue (instance_id-scoped lookups) and cannot authenticate.
-- They also occupy the demo emails. Remove them; demo users are
-- provisioned out-of-band via the Supabase Auth Admin API, which
-- stores GoTrue-native password hashes.
--
-- user_profiles rows cascade automatically via the
-- auth.users(id) foreign key.
-- ==========================================================

DELETE FROM auth.identities
WHERE user_id IN (
  SELECT id FROM auth.users
  WHERE email IN ('shopper@charmshub.ai', 'owner@charmshub.ai', 'developer@charmshub.ai')
    AND (raw_user_meta_data ->> 'full_name') IN ('Demo Shopper', 'Demo Owner', 'Demo Developer')
);

DELETE FROM auth.users
WHERE email IN ('shopper@charmshub.ai', 'owner@charmshub.ai', 'developer@charmshub.ai')
  AND (raw_user_meta_data ->> 'full_name') IN ('Demo Shopper', 'Demo Owner', 'Demo Developer');
