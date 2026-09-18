-- ==========================================================
-- CHARMS HUB AI — PHASE C: CLOUD CATALOG INTEGRITY
--
-- Requires: 20260918_charms_hub_master.sql + Phase A/B migrations.
-- Safe to re-run: all statements idempotent.
--
-- Prepares the products table to be the authoritative catalog:
--   1. Boolean classification flags used by the storefront
--      (home page sections, product details badges) that only
--      existed in the client-side dataset until now.
--   2. Server-side guards against duplicate products and
--      invalid pricing data.
-- ==========================================================

-- 1. Storefront classification flags
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_mystery_scoop BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_kashmiri_earring BOOLEAN NOT NULL DEFAULT FALSE;

-- 2a. Slug uniqueness: prevents duplicate products (case as written;
--     the catalog service generates slugs in lowercase already).
CREATE UNIQUE INDEX IF NOT EXISTS products_slug_key ON public.products (slug);

-- 2b. Pricing sanity: no negative prices (re-create for idempotency)
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_price_non_negative;
ALTER TABLE public.products ADD CONSTRAINT products_price_non_negative CHECK (price >= 0);

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_mrp_non_negative;
ALTER TABLE public.products ADD CONSTRAINT products_mrp_non_negative CHECK (mrp IS NULL OR mrp >= 0);
