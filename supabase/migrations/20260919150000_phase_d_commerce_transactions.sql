-- ==========================================================
-- CHARMS HUB AI — PHASE D: SECURE CLOUD COMMERCE TRANSACTIONS
--
-- Requires: 20260918 master + Phase A/B/C migrations.
-- Safe to re-run: all statements idempotent.
--
-- Makes PostgreSQL the authoritative commerce engine:
--   1. create_order(...) RPC — one transactional, server-side
--      order creation with authoritative pricing. Clients can
--      only declare WHAT they buy; the database decides prices,
--      discounts, shipping and totals.
--   2. Future-proof order numbers (year prefix + sequence).
--   3. Status CHECK constraints (valid transitions domain).
--   4. Idempotency table for double-submission protection.
--   5. Order status audit trigger (authoritative old/new status).
--   6. Activity log identity trigger (role/user identity derived
--      from the authenticated session, never trusted from client).
-- ==========================================================

-- 1. Order number sequence (never repeats; year prefix is cosmetic)
DO $$ BEGIN
  CREATE SEQUENCE public.order_number_seq START 10001;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Status domain constraints
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'));

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN ('Paid', 'Pending Verification', 'Cash on Delivery'));

-- 3. Idempotency registry (only the definer RPC touches it; RLS on with
--    no policies = invisible/unwritable through PostgREST)
CREATE TABLE IF NOT EXISTS public.order_idempotency (
  idempotency_key TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.order_idempotency ENABLE ROW LEVEL SECURITY;

-- ==========================================================
-- 4. create_order — the single secure transaction
-- ==========================================================
CREATE OR REPLACE FUNCTION public.create_order(
  p_items JSONB,
  p_payment_method TEXT,
  p_shipping_details JSONB,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT;
  v_item JSONB;
  v_pid TEXT;
  v_qty INT;
  v_variant TEXT;
  v_product public.products%ROWTYPE;
  v_subtotal NUMERIC(10,2) := 0;
  v_discount NUMERIC(10,2) := 0;
  v_shipping NUMERIC(10,2) := 0;
  v_total NUMERIC(10,2);
  v_order_id TEXT;
  v_order_number TEXT;
  v_invoice_id TEXT;
  v_invoice_number TEXT;
  v_payment_status TEXT;
  v_payment_method TEXT;
  v_items JSONB := '[]'::jsonb;
  v_existing_order_id TEXT;
  v_result JSONB;
BEGIN
  -- 4.1 Authentication & profile
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  v_role := public.get_user_role(v_uid);
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- 4.2 Idempotency: replay protection for double submissions
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
    SELECT order_id INTO v_existing_order_id
    FROM public.order_idempotency
    WHERE idempotency_key = p_idempotency_key AND user_id = v_uid;
    IF v_existing_order_id IS NOT NULL THEN
      SELECT public.create_order_payload(v_existing_order_id) INTO v_result;
      RETURN v_result;
    END IF;
  END IF;

  -- 4.3 Item list validation
  IF p_items IS NULL OR JSONB_TYPEOF(p_items) <> 'array' OR JSONB_ARRAY_LENGTH(p_items) = 0 THEN
    RAISE EXCEPTION 'Order must contain at least one item';
  END IF;
  IF JSONB_ARRAY_LENGTH(p_items) > 30 THEN
    RAISE EXCEPTION 'Too many order lines';
  END IF;

  -- 4.4 Shipping address validation
  IF COALESCE(p_shipping_details->>'fullName', '') = ''
     OR COALESCE(p_shipping_details->>'phone', '') = ''
     OR COALESCE(p_shipping_details->>'email', '') = ''
     OR COALESCE(p_shipping_details->>'street', '') = ''
     OR COALESCE(p_shipping_details->>'city', '') = ''
     OR COALESCE(p_shipping_details->>'state', '') = ''
     OR COALESCE(p_shipping_details->>'pincode', '') = '' THEN
    RAISE EXCEPTION 'Shipping address is incomplete';
  END IF;

  -- 4.5 Payment mode: never claim confirmed payment without a gateway
  v_payment_method := COALESCE(NULLIF(TRIM(p_payment_method), ''), 'Online / UPI');
  v_payment_status := CASE
    WHEN v_payment_method ILIKE '%cash%' OR v_payment_method ILIKE '%cod%' THEN 'Cash on Delivery'
    ELSE 'Pending Verification'
  END;

  -- 4.6 Authoritative pricing: fetch current DB values, ignore client money
  FOR v_item IN SELECT * FROM JSONB_ARRAY_ELEMENTS(p_items) LOOP
    v_pid := v_item->>'product_id';
    v_qty := COALESCE((v_item->>'quantity')::int, 0);
    v_variant := NULLIF(v_item->>'selected_variant', '');

    IF v_pid IS NULL OR v_pid = '' THEN
      RAISE EXCEPTION 'Invalid product reference';
    END IF;
    IF v_qty < 1 OR v_qty > 20 THEN
      RAISE EXCEPTION 'Invalid quantity for product %', v_pid;
    END IF;

    SELECT * INTO v_product FROM public.products WHERE id = v_pid;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found: %', v_pid;
    END IF;
    IF v_product.is_active = FALSE THEN
      RAISE EXCEPTION 'Product is no longer available: %', v_product.name;
    END IF;
    IF v_product.in_stock = FALSE THEN
      RAISE EXCEPTION 'Product is out of stock: %', v_product.name;
    END IF;

    v_items := v_items || JSONB_BUILD_OBJECT(
      'product_id', v_product.id,
      'product_name_snapshot', v_product.name,
      'product_image_snapshot', v_product.image_url,
      'unit_price', v_product.price,
      'quantity', v_qty,
      'discount_amount', 0,
      'line_total', v_product.price * v_qty,
      'selected_variant', v_variant
    );
    v_subtotal := v_subtotal + v_product.price * v_qty;
  END LOOP;

  -- 4.7 Shipping rule (verified business rule: free above Rs.499, else Rs.50)
  v_shipping := CASE WHEN v_subtotal >= 499 THEN 0 ELSE 50 END;
  v_total := v_subtotal - v_discount + v_shipping;

  -- 4.8 Identifiers (future-proof: year prefix + never-repeating sequence)
  v_order_id := 'ord_' || EXTRACT(EPOCH FROM clock_timestamp())::bigint || '_' || SUBSTR(MD5(RANDOM()::text), 1, 7);
  v_order_number := 'CH-' || EXTRACT(YEAR FROM NOW()) || '-' || NEXTVAL('public.order_number_seq')::text;
  v_invoice_id := 'inv_' || EXTRACT(EPOCH FROM clock_timestamp())::bigint || '_' || SUBSTR(MD5(RANDOM()::text), 1, 7);
  v_invoice_number := 'INV-' || v_order_number;

  -- 4.9 Order + immutable item snapshots + invoice record (atomic)
  INSERT INTO public.orders (
    id, order_number, user_id, customer_email, customer_name,
    status, payment_status, payment_method,
    subtotal, discount_amount, shipping_amount, total_amount, currency,
    shipping_details, billing_details, invoice_id, invoice_number
  ) VALUES (
    v_order_id, v_order_number, v_uid::text,
    COALESCE((SELECT u.email FROM auth.users u WHERE u.id = v_uid), p_shipping_details->>'email'),
    p_shipping_details->>'fullName',
    'Confirmed', v_payment_status, v_payment_method,
    v_subtotal, v_discount, v_shipping, v_total, 'INR',
    p_shipping_details, p_shipping_details, v_invoice_id, v_invoice_number
  );

  INSERT INTO public.order_items (
    id, order_id, product_id, product_name_snapshot, product_image_snapshot,
    unit_price, quantity, discount_amount, line_total, selected_variant
  )
  SELECT
    'item_' || SUBSTR(MD5(v_order_id || ':' || idx::text), 1, 14),
    v_order_id,
    x->>'product_id',
    x->>'product_name_snapshot',
    x->>'product_image_snapshot',
    (x->>'unit_price')::numeric,
    (x->>'quantity')::int,
    (x->>'discount_amount')::numeric,
    (x->>'line_total')::numeric,
    x->>'selected_variant'
  FROM JSONB_ARRAY_ELEMENTS(v_items) WITH ORDINALITY AS t(x, idx);

  INSERT INTO public.invoices (
    id, invoice_number, order_id, order_number, user_id,
    customer_name, customer_email, shipping_details,
    subtotal, discount_amount, shipping_amount, total_amount, currency, status
  ) VALUES (
    v_invoice_id, v_invoice_number, v_order_id, v_order_number, v_uid::text,
    p_shipping_details->>'fullName',
    COALESCE((SELECT u.email FROM auth.users u WHERE u.id = v_uid), p_shipping_details->>'email'),
    p_shipping_details,
    v_subtotal, v_discount, v_shipping, v_total, 'INR', 'Generated'
  );

  -- 4.10 Register idempotency key (same transaction as the order)
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
    INSERT INTO public.order_idempotency (idempotency_key, user_id, order_id)
    VALUES (p_idempotency_key, v_uid, v_order_id);
  END IF;

  -- 4.11 Audit trail (identity derived from the session, not the client)
  INSERT INTO public.activity_logs (
    id, user_id, user_email, role, event_type, entity_type, entity_id, metadata
  ) VALUES (
    'log_' || EXTRACT(EPOCH FROM clock_timestamp())::bigint || '_' || SUBSTR(MD5(RANDOM()::text), 1, 6),
    v_uid::text,
    COALESCE((SELECT email FROM public.user_profiles WHERE id = v_uid), p_shipping_details->>'email'),
    v_role,
    'order_created', 'order', v_order_id,
    JSONB_BUILD_OBJECT('order_number', v_order_number, 'total_amount', v_total, 'item_count', JSONB_ARRAY_LENGTH(v_items))
  );

  RETURN public.create_order_payload(v_order_id);
END;
$$;

-- Rebuilds the authoritative order payload from stored rows (used both for
-- fresh creations and idempotent replays).
CREATE OR REPLACE FUNCTION public.create_order_payload(p_order_id TEXT)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT JSONB_BUILD_OBJECT(
    'order_id', o.id,
    'order_number', o.order_number,
    'invoice_id', o.invoice_id,
    'invoice_number', o.invoice_number,
    'status', o.status,
    'payment_status', o.payment_status,
    'payment_method', o.payment_method,
    'subtotal', o.subtotal,
    'discount_amount', o.discount_amount,
    'shipping_amount', o.shipping_amount,
    'total_amount', o.total_amount,
    'currency', o.currency,
    'items', COALESCE((
      SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
        'product_id', oi.product_id,
        'product_name_snapshot', oi.product_name_snapshot,
        'product_image_snapshot', oi.product_image_snapshot,
        'unit_price', oi.unit_price,
        'quantity', oi.quantity,
        'discount_amount', oi.discount_amount,
        'line_total', oi.line_total,
        'selected_variant', oi.selected_variant
      ) ORDER BY oi.created_at, oi.id)
      FROM public.order_items oi WHERE oi.order_id = o.id
    ), '[]'::jsonb)
  )
  FROM public.orders o
  WHERE o.id = p_order_id;
$$;

REVOKE ALL ON FUNCTION public.create_order(JSONB, TEXT, JSONB, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_order(JSONB, TEXT, JSONB, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.create_order_payload(TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_order_payload(TEXT) TO authenticated;

-- ==========================================================
-- 5. Order status audit: every status change is logged with the
--    authoritative old/new values and the acting session identity.
-- ==========================================================
CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.activity_logs (
      id, user_id, user_email, role, event_type, entity_type, entity_id, metadata
    ) VALUES (
      'log_' || EXTRACT(EPOCH FROM clock_timestamp())::bigint || '_' || SUBSTR(MD5(RANDOM()::text), 1, 6),
      COALESCE(auth.uid()::text, 'system'),
      COALESCE((SELECT email FROM public.user_profiles WHERE id = auth.uid()), 'system'),
      COALESCE(public.get_user_role(auth.uid()), 'system'),
      'order_status_changed', 'order', NEW.id,
      JSONB_BUILD_OBJECT(
        'order_id', NEW.id,
        'order_number', NEW.order_number,
        'old_status', OLD.status,
        'new_status', NEW.status
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_status_audit ON public.orders;
CREATE TRIGGER trg_order_status_audit
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.log_order_status_change();

-- ==========================================================
-- 6. Activity log identity authority: client-supplied user_id /
--    user_email / role are overwritten with session-derived values.
--    (BEFORE triggers run before the RLS WITH CHECK evaluation.)
-- ==========================================================
CREATE OR REPLACE FUNCTION public.enforce_activity_log_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.user_id := auth.uid()::text;
    NEW.user_email := COALESCE(
      (SELECT email FROM public.user_profiles WHERE id = auth.uid()),
      NEW.user_email
    );
    NEW.role := COALESCE(public.get_user_role(auth.uid()), 'customer');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_log_identity ON public.activity_logs;
CREATE TRIGGER trg_activity_log_identity
  BEFORE INSERT ON public.activity_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_activity_log_identity();
