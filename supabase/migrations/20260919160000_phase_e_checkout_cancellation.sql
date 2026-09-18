-- ==========================================================
-- CHARMS HUB AI — PHASE E1: CHECKOUT, PAYMENTS, CANCELLATION,
-- ORDER TIMELINE
--
-- Requires: all previous migrations. Safe to re-run.
-- ==========================================================

-- 1. Orders: payment reference (UPI transaction id), cancellation trail
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_reference TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- 1b. Payment status domain: prepaid orders cancelled without a real
--     gateway need an explicit refund_required/manual-review state.
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN ('Paid', 'Pending Verification', 'Cash on Delivery', 'Refund Required'));

-- 2. Store configuration (owner-editable, customer-readable).
--    Example keys: upi_merchant_id, support_whatsapp, store_display_name.
CREATE TABLE IF NOT EXISTS public.store_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT NOT NULL
);
ALTER TABLE public.store_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read store config" ON public.store_config;
CREATE POLICY "Public can read store config"
  ON public.store_config FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage store config" ON public.store_config;
CREATE POLICY "Admins manage store config"
  ON public.store_config FOR ALL
  USING (public.get_user_role(auth.uid()) IN ('shop_owner', 'developer'));

-- 3. Order events: customer-visible status timeline (ordered, timestamped).
--    Customers read the timeline of their own orders only.
CREATE TABLE IF NOT EXISTS public.order_events (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers view own order events" ON public.order_events;
CREATE POLICY "Customers view own order events"
  ON public.order_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_events.order_id AND o.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Admins view all order events" ON public.order_events;
CREATE POLICY "Admins view all order events"
  ON public.order_events FOR SELECT
  USING (public.get_user_role(auth.uid()) IN ('shop_owner', 'developer'));

-- 4. create_order: richer address, payment reference, order_placed event.
--    (CREATE OR REPLACE — never touches the applied migration file.)
CREATE OR REPLACE FUNCTION public.create_order(
  p_items JSONB,
  p_payment_method TEXT,
  p_shipping_details JSONB,
  p_idempotency_key TEXT DEFAULT NULL,
  p_payment_reference TEXT DEFAULT NULL
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
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  v_role := public.get_user_role(v_uid);
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
    SELECT order_id INTO v_existing_order_id
    FROM public.order_idempotency
    WHERE idempotency_key = p_idempotency_key AND user_id = v_uid;
    IF v_existing_order_id IS NOT NULL THEN
      SELECT public.create_order_payload(v_existing_order_id) INTO v_result;
      RETURN v_result;
    END IF;
  END IF;

  IF p_items IS NULL OR JSONB_TYPEOF(p_items) <> 'array' OR JSONB_ARRAY_LENGTH(p_items) = 0 THEN
    RAISE EXCEPTION 'Order must contain at least one item';
  END IF;
  IF JSONB_ARRAY_LENGTH(p_items) > 30 THEN
    RAISE EXCEPTION 'Too many order lines';
  END IF;

  -- Structured Indian address: house/building, street, area/locality, city, state, pincode
  IF COALESCE(p_shipping_details->>'fullName', '') = ''
     OR COALESCE(p_shipping_details->>'phone', '') = ''
     OR COALESCE(p_shipping_details->>'email', '') = ''
     OR COALESCE(p_shipping_details->>'house_building', '') = ''
     OR COALESCE(p_shipping_details->>'street', '') = ''
     OR COALESCE(p_shipping_details->>'area', '') = ''
     OR COALESCE(p_shipping_details->>'city', '') = ''
     OR COALESCE(p_shipping_details->>'state', '') = ''
     OR COALESCE(p_shipping_details->>'pincode', '') = '' THEN
    RAISE EXCEPTION 'Shipping address is incomplete';
  END IF;

  v_payment_method := COALESCE(NULLIF(TRIM(p_payment_method), ''), 'UPI');
  v_payment_status := CASE
    WHEN v_payment_method ILIKE '%cash%' OR v_payment_method ILIKE '%cod%' THEN 'Cash on Delivery'
    ELSE 'Pending Verification'
  END;

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

  v_shipping := CASE WHEN v_subtotal >= 499 THEN 0 ELSE 50 END;
  v_total := v_subtotal - v_discount + v_shipping;

  v_order_id := 'ord_' || EXTRACT(EPOCH FROM clock_timestamp())::bigint || '_' || SUBSTR(MD5(RANDOM()::text), 1, 7);
  v_order_number := 'CH-' || EXTRACT(YEAR FROM NOW()) || '-' || NEXTVAL('public.order_number_seq')::text;
  v_invoice_id := 'inv_' || EXTRACT(EPOCH FROM clock_timestamp())::bigint || '_' || SUBSTR(MD5(RANDOM()::text), 1, 7);
  v_invoice_number := 'INV-' || v_order_number;

  INSERT INTO public.orders (
    id, order_number, user_id, customer_email, customer_name,
    status, payment_status, payment_method, payment_reference,
    subtotal, discount_amount, shipping_amount, total_amount, currency,
    shipping_details, billing_details, invoice_id, invoice_number
  ) VALUES (
    v_order_id, v_order_number, v_uid::text,
    COALESCE((SELECT u.email FROM auth.users u WHERE u.id = v_uid), p_shipping_details->>'email'),
    p_shipping_details->>'fullName',
    'Confirmed', v_payment_status, v_payment_method,
    NULLIF(TRIM(COALESCE(p_payment_reference, '')), ''),
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

  IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
    INSERT INTO public.order_idempotency (idempotency_key, user_id, order_id)
    VALUES (p_idempotency_key, v_uid, v_order_id);
  END IF;

  -- Customer-visible timeline event
  INSERT INTO public.order_events (id, order_id, event, metadata)
  VALUES (
    'evt_' || SUBSTR(MD5(v_order_id || ':placed'), 1, 16),
    v_order_id, 'order_placed',
    JSONB_BUILD_OBJECT('order_number', v_order_number, 'status', 'Confirmed')
  );

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

-- 5. cancel_order: customer-side, ownership-verified, state-guarded.
CREATE OR REPLACE FUNCTION public.cancel_order(p_order_id TEXT, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT;
  v_order public.orders%ROWTYPE;
  v_new_payment_status TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  v_role := public.get_user_role(v_uid);
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) < 3 THEN
    RAISE EXCEPTION 'A cancellation reason is required';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND OR v_order.user_id <> v_uid::text THEN
    RAISE EXCEPTION 'Order not found among your orders';
  END IF;

  IF v_order.status IN ('Shipped', 'Delivered', 'Cancelled') THEN
    RAISE EXCEPTION 'This order can no longer be cancelled (status: %)', v_order.status;
  END IF;

  -- Prepaid (UPI) orders cancelled without a real gateway require manual review.
  v_new_payment_status := CASE
    WHEN v_order.payment_status = 'Cash on Delivery' THEN 'Cash on Delivery'
    WHEN v_order.payment_status = 'Paid' THEN 'Refund Required'
    WHEN v_order.payment_status = 'Pending Verification' THEN 'Refund Required'
    ELSE v_order.payment_status
  END;

  UPDATE public.orders
  SET status = 'Cancelled',
      cancellation_reason = TRIM(p_reason),
      cancelled_at = NOW(),
      payment_status = v_new_payment_status,
      updated_at = NOW()
  WHERE id = p_order_id AND user_id = v_uid::text;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found among your orders';
  END IF;

  INSERT INTO public.order_events (id, order_id, event, metadata)
  VALUES (
    'evt_' || SUBSTR(MD5(p_order_id || ':cancelled:' || EXTRACT(EPOCH FROM clock_timestamp())::bigint), 1, 20),
    p_order_id, 'order_cancelled',
    JSONB_BUILD_OBJECT('reason', TRIM(p_reason), 'cancelled_by', 'customer')
  );

  INSERT INTO public.activity_logs (
    id, user_id, user_email, role, event_type, entity_type, entity_id, metadata
  ) VALUES (
    'log_' || EXTRACT(EPOCH FROM clock_timestamp())::bigint || '_' || SUBSTR(MD5(RANDOM()::text), 1, 6),
    v_uid::text,
    COALESCE((SELECT email FROM public.user_profiles WHERE id = v_uid), 'customer'),
    v_role,
    'order_cancelled', 'order', p_order_id,
    JSONB_BUILD_OBJECT('order_number', v_order.order_number, 'reason', TRIM(p_reason), 'refund_required', v_new_payment_status = 'Refund Required')
  );

  RETURN JSONB_BUILD_OBJECT(
    'order_id', p_order_id,
    'order_number', v_order.order_number,
    'status', 'Cancelled',
    'payment_status', v_new_payment_status,
    'cancellation_reason', TRIM(p_reason),
    'cancelled_at', NOW()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_order(TEXT, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cancel_order(TEXT, TEXT) TO authenticated;

-- 6. Status audit trigger now also writes the customer-visible timeline.
CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.order_events (id, order_id, event, metadata)
    VALUES (
      'evt_' || SUBSTR(MD5(NEW.id || ':status:' || EXTRACT(EPOCH FROM clock_timestamp())::bigint || NEW.status), 1, 24),
      NEW.id, 'status_changed',
      JSONB_BUILD_OBJECT('old_status', OLD.status, 'new_status', NEW.status)
    );

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
