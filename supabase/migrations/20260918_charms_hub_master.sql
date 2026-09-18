-- ==========================================================
-- CHARMS HUB AI — MASTER PRODUCTION DATABASE & RLS MIGRATION
-- Project: Charms Hub AI (X-Factor LevelX - Phase 2)
-- ==========================================================

-- 1. Create Roles Enum
DO $$ BEGIN
  CREATE TYPE user_role_type AS ENUM ('customer', 'shop_owner', 'developer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. User Profiles Table
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role user_role_type NOT NULL DEFAULT 'customer',
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  shipping_address JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Dynamic Products Table
CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  mrp NUMERIC(10,2),
  discount_percent INTEGER,
  category_id TEXT NOT NULL,
  category_name TEXT,
  image_url TEXT NOT NULL,
  additional_images JSONB DEFAULT '[]'::jsonb,
  in_stock BOOLEAN NOT NULL DEFAULT TRUE,
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  archived_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'charms_hub_verified',
  reference_verified BOOLEAN NOT NULL DEFAULT FALSE,
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
  id TEXT PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Confirmed',
  payment_status TEXT NOT NULL DEFAULT 'Paid',
  payment_method TEXT NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  shipping_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  shipping_details JSONB NOT NULL,
  billing_details JSONB,
  invoice_id TEXT,
  invoice_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Order Item Snapshots (Ensures Immutable Historical Integrity)
CREATE TABLE IF NOT EXISTS public.order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  product_name_snapshot TEXT NOT NULL,
  product_image_snapshot TEXT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  quantity INTEGER NOT NULL,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(10,2) NOT NULL,
  selected_variant TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Invoices Table
CREATE TABLE IF NOT EXISTS public.invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT UNIQUE NOT NULL,
  order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  user_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  shipping_details JSONB NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  shipping_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  invoice_url TEXT,
  status TEXT NOT NULL DEFAULT 'Generated',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Activity & Audit Logs Table
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  role TEXT NOT NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Store Appearance Configuration
CREATE TABLE IF NOT EXISTS public.store_appearance (
  id TEXT PRIMARY KEY DEFAULT 'default',
  settings JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT NOT NULL
);

-- ==========================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- ==========================================================

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_appearance ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user role
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id UUID)
RETURNS TEXT AS $$
  SELECT role::text FROM public.user_profiles WHERE id = p_user_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Products: Everyone can read active products. Owners and Developers can insert/update/delete.
CREATE POLICY "Public can view active products" ON public.products
  FOR SELECT USING (is_active = true OR public.get_user_role(auth.uid()) IN ('shop_owner', 'developer'));

CREATE POLICY "Owners and Developers manage products" ON public.products
  FOR ALL USING (public.get_user_role(auth.uid()) IN ('shop_owner', 'developer'));

-- Orders: Customers can view only their own orders. Owners and Developers can view all.
CREATE POLICY "Customers view own orders" ON public.orders
  FOR SELECT USING (user_id = auth.uid()::text OR public.get_user_role(auth.uid()) IN ('shop_owner', 'developer'));

CREATE POLICY "Authenticated users can create orders" ON public.orders
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Owners and Developers update orders" ON public.orders
  FOR UPDATE USING (public.get_user_role(auth.uid()) IN ('shop_owner', 'developer'));

-- Order Items: Viewable if user owns the parent order or is owner/dev.
CREATE POLICY "View order items" ON public.order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
      AND (o.user_id = auth.uid()::text OR public.get_user_role(auth.uid()) IN ('shop_owner', 'developer'))
    )
  );

-- Invoices: Customers view own invoices. Owners and Developers view all.
CREATE POLICY "Customers view own invoices" ON public.invoices
  FOR SELECT USING (user_id = auth.uid()::text OR public.get_user_role(auth.uid()) IN ('shop_owner', 'developer'));

CREATE POLICY "System inserts invoices" ON public.invoices
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Activity Logs: Only Shop Owners and Developers can read. Authenticated users can insert.
CREATE POLICY "Admins view activity logs" ON public.activity_logs
  FOR SELECT USING (public.get_user_role(auth.uid()) IN ('shop_owner', 'developer'));

CREATE POLICY "Insert activity logs" ON public.activity_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Store Appearance: Anyone can read, only Shop Owners and Developers can update.
CREATE POLICY "Public read appearance" ON public.store_appearance
  FOR SELECT USING (true);

CREATE POLICY "Admins update appearance" ON public.store_appearance
  FOR ALL USING (public.get_user_role(auth.uid()) IN ('shop_owner', 'developer'));
