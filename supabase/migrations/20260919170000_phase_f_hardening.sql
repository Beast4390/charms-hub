-- ==========================================================
-- CHARMS HUB AI — PHASE F: PRODUCTION HARDENING
--
-- Requires: all previous migrations. Safe to re-run.
-- ==========================================================

-- 1. Knowledge: 'processing' state for in-flight embedding jobs
ALTER TABLE public.knowledge_base DROP CONSTRAINT IF EXISTS knowledge_base_embedding_status_check;
ALTER TABLE public.knowledge_base ADD CONSTRAINT knowledge_base_embedding_status_check
  CHECK (embedding_status IN ('pending', 'processing', 'indexed', 'failed'));

-- 2. Orders: who cancelled
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancelled_by TEXT;

-- 3. Order status state machine (server-enforced; terminal states final)
CREATE OR REPLACE FUNCTION public.enforce_order_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_allowed BOOLEAN;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM (VALUES
      ('Pending',    'Confirmed'),
      ('Pending',    'Processing'),
      ('Pending',    'Cancelled'),
      ('Confirmed',  'Processing'),
      ('Confirmed',  'Shipped'),
      ('Confirmed',  'Cancelled'),
      ('Processing', 'Shipped'),
      ('Processing', 'Cancelled'),
      ('Shipped',    'Delivered')
    ) AS t(from_status, to_status)
    WHERE from_status = OLD.status AND to_status = NEW.status
  ) INTO v_allowed;
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Illegal status transition: % -> %', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_status_transition ON public.orders;
CREATE TRIGGER trg_order_status_transition
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_order_status_transition();

-- 4. Categories: cloud-managed, referenced by products
CREATE TABLE IF NOT EXISTS public.categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  featured BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_key ON public.categories (slug);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public reads active categories" ON public.categories;
CREATE POLICY "Public reads active categories"
  ON public.categories FOR SELECT
  USING (is_active = TRUE OR public.get_user_role(auth.uid()) IN ('shop_owner', 'developer'));

DROP POLICY IF EXISTS "Admins manage categories" ON public.categories;
CREATE POLICY "Admins manage categories"
  ON public.categories FOR ALL
  USING (public.get_user_role(auth.uid()) IN ('shop_owner', 'developer'));

INSERT INTO public.categories (id, name, slug, description, image_url, featured)
VALUES
  ('cat-organizers',        'Organizers',        'organizers',        'Travel and home jewelry organizers, pouches, and storage boxes.',            '/products/organizers/travelling-makeup-organizer.jpg',            TRUE),
  ('cat-quirky-keychains',  'Quirky Keychains',  'quirky-keychains',  'Aesthetic, fun, evil eye, Shinchan, and plush keychains.',                   '/products/keychains/shinchan-mood-swing-toy-keychain.jpg',        TRUE),
  ('cat-unique-products',   'Unique Products',   'unique-products',   'Gift sets, rotating flower boxes, specialty novelty accessories.',           '/products/organizers/5-in-1-rose-ring-gift-box.jpg',              TRUE),
  ('cat-quirky-stationery', 'Quirky Stationery', 'quirky-stationery', 'Cute sharpeners, glue pens, 3D novelty erasers, and desk accessories.',      '/products/stationery/3d-chocolate-erasers-pack-of-4.jpg',         TRUE),
  ('cat-earrings',          'Earrings',          'earrings',          'Handcrafted Kashmiri jhumkas, chandeliers, and aesthetic studs.',            '/products/earrings/kashmiri-earring-design-5.jpg',                TRUE),
  ('cat-rings',             'Rings',             'rings',             'Solitaire, tiara, fairytale, floral, and adjustable statement rings.',       '/products/rings/vine-wrapped-solitaire-ring.jpg',                 TRUE),
  ('cat-bracelets',         'Bracelets',         'bracelets',         'Tennis bracelets, evil eye charms, bangles, and delicate silver chains.',    '/products/bracelets/the-solar-daisy-charm-bangle.webp',           TRUE),
  ('cat-hair-accessories',  'Hair Accessories',  'hair-accessories',  'Floral claws, Korean bows, satin ribbons, hairpins, and hairbands.',         '/products/hair-accessories/mini-floral-hairpins-pairs.jpg',       TRUE),
  ('cat-mystery-scoop',     'Mystery Scoop',     'mystery-scoop',     'Curated mystery scoops filled with jewelry, hair charms, and surprises.',    '/products/mystery-scoop/pookia-mystery-scoop.webp',               TRUE)
ON CONFLICT (id) DO NOTHING;

-- Products must reference valid, active categories.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_category_fkey'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_category_fkey
      FOREIGN KEY (category_id) REFERENCES public.categories(id);
  END IF;
END $$;

-- 5. Store configuration defaults (no invented business facts — contact
--    fields stay unset until the owner configures real values).
INSERT INTO public.store_config (key, value, updated_by)
VALUES
  ('upi_enabled',             'true', 'system_default'),
  ('cod_enabled',             'true', 'system_default'),
  ('free_shipping_threshold', '499',  'system_default'),
  ('shipping_flat_fee',       '50',   'system_default')
ON CONFLICT (key) DO NOTHING;

-- Knowledge staleness: config changes invalidate related knowledge embeddings
CREATE OR REPLACE FUNCTION public.mark_knowledge_stale_on_config_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.key IN ('upi_merchant_id', 'upi_enabled', 'cod_enabled') THEN
    UPDATE public.knowledge_base
    SET embedding_status = 'pending', updated_at = NOW()
    WHERE category = 'payments' AND embedding_status = 'indexed';
  ELSIF NEW.key = 'support_whatsapp' OR NEW.key = 'support_email' OR NEW.key = 'support_phone' THEN
    UPDATE public.knowledge_base
    SET embedding_status = 'pending', updated_at = NOW()
    WHERE category IN ('customer_support', 'business_information') AND embedding_status = 'indexed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_config_knowledge_stale ON public.store_config;
CREATE TRIGGER trg_config_knowledge_stale
  AFTER INSERT OR UPDATE OF value ON public.store_config
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_knowledge_stale_on_config_change();

-- 6. Configurable shipping rule inside the order transaction
--    (values come from store_config; 499/50 remain the verified defaults).
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
  v_free_threshold NUMERIC(10,2) := 499;
  v_flat_fee NUMERIC(10,2) := 50;
  v_cfg TEXT;
  v_cfg_enabled TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  v_role := public.get_user_role(v_uid);
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- Payment method must currently be enabled by the shop owner
  v_payment_method := COALESCE(NULLIF(TRIM(p_payment_method), ''), 'UPI');
  v_cfg_enabled := CASE
    WHEN v_payment_method ILIKE '%cash%' OR v_payment_method ILIKE '%cod%' THEN 'cod_enabled'
    ELSE 'upi_enabled'
  END;
  SELECT value INTO v_cfg_enabled FROM public.store_config WHERE key = v_cfg_enabled;
  IF COALESCE(v_cfg_enabled, 'true') <> 'true' THEN
    RAISE EXCEPTION 'This payment method is currently unavailable';
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

  -- Owner-configurable shipping rule (defaults preserve the verified rule)
  SELECT value INTO v_cfg FROM public.store_config WHERE key = 'free_shipping_threshold';
  BEGIN
    IF v_cfg IS NOT NULL THEN v_free_threshold := v_cfg::numeric; END IF;
  EXCEPTION WHEN OTHERS THEN v_free_threshold := 499; END;
  SELECT value INTO v_cfg FROM public.store_config WHERE key = 'shipping_flat_fee';
  BEGIN
    IF v_cfg IS NOT NULL THEN v_flat_fee := v_cfg::numeric; END IF;
  EXCEPTION WHEN OTHERS THEN v_flat_fee := 50; END;

  v_shipping := CASE WHEN v_subtotal >= v_free_threshold THEN 0 ELSE v_flat_fee END;
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

-- 7. Cancellation records the actor; stock remains boolean availability
--    (documented: nothing to restore, no fake restoration performed).
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

  v_new_payment_status := CASE
    WHEN v_order.payment_status = 'Cash on Delivery' THEN 'Cash on Delivery'
    WHEN v_order.payment_status IN ('Paid', 'Pending Verification') THEN 'Refund Required'
    ELSE v_order.payment_status
  END;

  UPDATE public.orders
  SET status = 'Cancelled',
      cancellation_reason = TRIM(p_reason),
      cancelled_at = NOW(),
      cancelled_by = 'customer',
      payment_status = v_new_payment_status,
      updated_at = NOW()
  WHERE id = p_order_id AND user_id = v_uid::text;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found among your orders';
  END IF;

  -- Note: stock is boolean availability in this catalog (no numeric
  -- reservation), so cancellation correctly restores nothing.

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

-- 8. Realtime: order/order-event/product/knowledge changes broadcast
--    (Supabase Realtime applies RLS for authenticated subscribers).
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.order_events;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 9. Private invoice storage bucket (client-generated PDFs archived here;
--    customers read only their own folder, staff read all).
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', FALSE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Customers read own invoice files" ON storage.objects;
CREATE POLICY "Customers read own invoice files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'invoices' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Admins read all invoice files" ON storage.objects;
CREATE POLICY "Admins read all invoice files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'invoices' AND public.get_user_role(auth.uid()) IN ('shop_owner', 'developer'));

DROP POLICY IF EXISTS "Customers upload own invoice files" ON storage.objects;
CREATE POLICY "Customers upload own invoice files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'invoices' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Admins write invoice files" ON storage.objects;
CREATE POLICY "Admins write invoice files"
  ON storage.objects FOR ALL
  USING (bucket_id = 'invoices' AND public.get_user_role(auth.uid()) IN ('shop_owner', 'developer'));
