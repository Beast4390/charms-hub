-- ==========================================================
-- CHARMS HUB AI — PHASE B: ORDER/INVOICE/LOG RLS HARDENING
--
-- Requires: 20260918_charms_hub_master.sql, Phase A migrations.
-- Safe to re-run: all statements idempotent.
--
-- Changes:
--   1. order_items: add the missing INSERT policy — items may only
--      be attached to an order the caller owns (admins excepted).
--   2. orders: INSERT restricted to your own user_id (admins excepted).
--   3. invoices: INSERT restricted to your own user_id (admins excepted);
--      UPDATE granted to Shop Owner/Developer for status management.
--   4. activity_logs: INSERT restricted to your own user_id (prevents
--      log forgery under another identity).
--   No UPDATE/DELETE policies are added to orders/order_items so
--   historical records stay immutable for customers; owners manage
--   order status via the existing orders UPDATE policy.
-- ==========================================================

-- 1. order_items INSERT (the known RLS gap)
DROP POLICY IF EXISTS "Users insert own order items" ON public.order_items;
CREATE POLICY "Users insert own order items"
  ON public.order_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (
          o.user_id = auth.uid()::text
          OR public.get_user_role(auth.uid()) IN ('shop_owner', 'developer')
        )
    )
  );

-- 2. orders INSERT ownership
DROP POLICY IF EXISTS "Authenticated users can create orders" ON public.orders;
CREATE POLICY "Authenticated users can create orders"
  ON public.orders
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()::text
    OR public.get_user_role(auth.uid()) IN ('shop_owner', 'developer')
  );

-- 3a. invoices INSERT ownership
DROP POLICY IF EXISTS "System inserts invoices" ON public.invoices;
CREATE POLICY "Users insert own invoices"
  ON public.invoices
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()::text
    OR public.get_user_role(auth.uid()) IN ('shop_owner', 'developer')
  );

-- 3b. invoices status management for admins
DROP POLICY IF EXISTS "Owners and Developers update invoices" ON public.invoices;
CREATE POLICY "Owners and Developers update invoices"
  ON public.invoices
  FOR UPDATE
  USING (public.get_user_role(auth.uid()) IN ('shop_owner', 'developer'));

-- 4. activity_logs: only your own actions
DROP POLICY IF EXISTS "Insert activity logs" ON public.activity_logs;
CREATE POLICY "Users insert own activity logs"
  ON public.activity_logs
  FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);
