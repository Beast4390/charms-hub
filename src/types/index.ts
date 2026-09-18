export type ThemeMode = 'light' | 'dark';

export type UserRole = 'customer' | 'shop_owner' | 'developer';

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image_url: string;
  item_count?: number;
  featured?: boolean;
}

export interface ProductVariant {
  id: string;
  name: string;
  in_stock: boolean;
  price?: number;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  mrp?: number;
  discount_percent?: number;
  category_id: string;
  category_name?: string;
  image_url: string;
  additional_images?: string[];
  in_stock: boolean;
  featured?: boolean;
  is_active?: boolean;
  archived_at?: string | null;
  source: string;
  reference_verified: boolean;
  created_at?: string;
  updated_at?: string;
  is_mystery_scoop?: boolean;
  is_kashmiri_earring?: boolean;
  variants?: ProductVariant[];
  tags?: string[];
  verified_source?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  selected_variant?: string;
}

export interface ShippingAddress {
  fullName: string;
  phone: string;
  email: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  full_name?: string;
  phone?: string;
  avatar_url?: string;
  shipping_address?: ShippingAddress;
  created_at?: string;
}

export interface OrderItemSnapshot {
  id: string;
  order_id: string;
  product_id: string;
  product_name_snapshot: string;
  product_image_snapshot: string;
  unit_price: number;
  quantity: number;
  discount_amount: number;
  line_total: number;
  selected_variant?: string;
  created_at: string;
}

export type OrderStatus = 'Pending' | 'Confirmed' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled';
export type PaymentStatus = 'Paid' | 'Pending Verification' | 'Cash on Delivery';

export interface Order {
  id: string;
  order_number: string;
  user_id: string;
  customer_email: string;
  customer_name: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: string;
  subtotal: number;
  discount_amount: number;
  shipping_amount: number;
  total_amount: number;
  currency: string;
  shipping_details: ShippingAddress;
  billing_details?: ShippingAddress;
  items: OrderItemSnapshot[];
  invoice_id?: string;
  invoice_number?: string;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  order_id: string;
  order_number: string;
  user_id: string;
  customer_name: string;
  customer_email: string;
  shipping_details: ShippingAddress;
  items: OrderItemSnapshot[];
  subtotal: number;
  discount_amount: number;
  shipping_amount: number;
  total_amount: number;
  currency: string;
  invoice_url?: string;
  status: 'Generated' | 'Paid';
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  user_email: string;
  role: UserRole;
  event_type: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface StoreAppearanceSettings {
  card_bg: 'white' | 'cream' | 'framed';
  card_radius: 'rounded-xl' | 'rounded-2xl' | 'rounded-3xl';
  card_border: 'border' | 'border-2' | 'none';
  card_shadow: 'shadow-xs' | 'shadow-md' | 'shadow-xl';
  card_density: 'compact' | 'standard' | 'spacious';
  image_aspect: 'aspect-square' | 'aspect-4/3' | 'aspect-3/4';
  badge_style: 'subtle' | 'vibrant' | 'pill';
  price_style: 'standard' | 'bold' | 'highlight';
  button_style: 'filled' | 'pill' | 'outline';
  updated_at: string;
  updated_by: string;
}

export interface PendingShoppingAction {
  action: 'add_to_cart' | 'buy_now';
  productId: string;
  quantity: number;
  variant?: string;
  returnUrl: string;
  timestamp: number;
}

export interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  category: 'delivery' | 'order' | 'payment' | 'return_refund' | 'product_care' | 'general';
  source: string;
  metadata?: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  recommendedProducts?: Product[];
  actionType?: 'view_products' | 'contact_whatsapp' | 'view_policy';
  actionPayload?: string;
  isFallback?: boolean;
}
