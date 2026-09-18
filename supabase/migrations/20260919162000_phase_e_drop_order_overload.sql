-- ==========================================================
-- CHARMS HUB AI — PHASE E FIX: REMOVE create_order OVERLOAD
--
-- The Phase E create_order (5 args) was created alongside the
-- Phase D 4-arg version because CREATE OR REPLACE only matches
-- identical signatures. PostgREST cannot resolve calls between
-- the two overloads (PGRST203). Drop the superseded one.
-- ==========================================================

DROP FUNCTION IF EXISTS public.create_order(JSONB, TEXT, JSONB, TEXT);
