import { Order, Invoice, OrderItemSnapshot, ShippingAddress, UserRole, CartItem } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';

export interface CreateOrderInput {
  /** What the customer buys. Prices/totals are computed by the database RPC. */
  items: Array<{ product_id: string; quantity: number; selected_variant?: string }>;
  paymentMethod: string;
  shippingDetails: ShippingAddress;
  /** Replay protection: the same key always returns the same order. */
  idempotencyKey?: string;
}

export interface CreateOrderResult {
  success: boolean;
  order?: Order;
  invoice?: Invoice;
  error?: string;
}

/** Raw authoritative payload returned by the create_order RPC. */
interface OrderRpcPayload {
  order_id: string;
  order_number: string;
  invoice_id: string;
  invoice_number: string;
  status: string;
  payment_status: string;
  payment_method: string;
  subtotal: number;
  discount_amount: number;
  shipping_amount: number;
  total_amount: number;
  currency: string;
  items: Array<{
    product_id: string;
    product_name_snapshot: string;
    product_image_snapshot: string;
    unit_price: number;
    quantity: number;
    discount_amount: number;
    line_total: number;
    selected_variant: string | null;
  }>;
}

// Cloud is the sole authoritative store for orders, invoices and logs.
// (localStorage previously mirrored these; it no longer does.)

function mapOrderItem(row: Record<string, unknown>): OrderItemSnapshot {
  return {
    id: (row.id as string) || `item_${row.order_id}_${row.product_id}`,
    order_id: row.order_id as string,
    product_id: row.product_id as string,
    product_name_snapshot: row.product_name_snapshot as string,
    product_image_snapshot: (row.product_image_snapshot as string) || '',
    unit_price: Number(row.unit_price),
    quantity: Number(row.quantity),
    discount_amount: Number(row.discount_amount ?? 0),
    line_total: Number(row.line_total ?? Number(row.unit_price) * Number(row.quantity)),
    selected_variant: (row.selected_variant as string) || undefined,
    created_at: (row.created_at as string) || new Date().toISOString(),
  };
}

function mapOrder(row: Record<string, unknown>): Order {
  return {
    id: row.id as string,
    order_number: row.order_number as string,
    user_id: row.user_id as string,
    customer_email: row.customer_email as string,
    customer_name: row.customer_name as string,
    status: row.status as Order['status'],
    payment_status: row.payment_status as Order['payment_status'],
    payment_method: row.payment_method as string,
    subtotal: Number(row.subtotal),
    discount_amount: Number(row.discount_amount ?? 0),
    shipping_amount: Number(row.shipping_amount ?? 0),
    total_amount: Number(row.total_amount),
    currency: (row.currency as string) || 'INR',
    shipping_details: row.shipping_details as ShippingAddress,
    billing_details: (row.billing_details as ShippingAddress) || undefined,
    items: [],
    invoice_id: (row.invoice_id as string) || undefined,
    invoice_number: (row.invoice_number as string) || undefined,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function mapInvoice(row: Record<string, unknown>): Invoice {
  return {
    id: row.id as string,
    invoice_number: row.invoice_number as string,
    order_id: row.order_id as string,
    order_number: row.order_number as string,
    user_id: row.user_id as string,
    customer_name: row.customer_name as string,
    customer_email: row.customer_email as string,
    shipping_details: row.shipping_details as ShippingAddress,
    items: [],
    subtotal: Number(row.subtotal),
    discount_amount: Number(row.discount_amount ?? 0),
    shipping_amount: Number(row.shipping_amount ?? 0),
    total_amount: Number(row.total_amount),
    currency: (row.currency as string) || 'INR',
    invoice_url: (row.invoice_url as string) || undefined,
    status: row.status as Invoice['status'],
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

async function fetchOrderItems(orderIds: string[]): Promise<Map<string, OrderItemSnapshot[]>> {
  const byOrder = new Map<string, OrderItemSnapshot[]>();
  if (!supabase || orderIds.length === 0) return byOrder;
  const { data, error } = await supabase
    .from('order_items')
    .select('*')
    .in('order_id', orderIds);
  if (error) {
    console.error('Failed to load order_items:', error.message);
    return byOrder;
  }
  for (const raw of data ?? []) {
    const item = mapOrderItem(raw as Record<string, unknown>);
    const list = byOrder.get(item.order_id) || [];
    list.push(item);
    byOrder.set(item.order_id, list);
  }
  return byOrder;
}

async function hydrateOrders(orders: Order[]): Promise<Order[]> {
  if (orders.length === 0) return orders;
  const byOrder = await fetchOrderItems(orders.map((o) => o.id));
  return orders.map((o) => ({ ...o, items: byOrder.get(o.id) || o.items || [] }));
}

/**
 * Creates an order through the secure database transaction.
 * The database fetches current product prices, validates stock/availability,
 * computes all monetary values and stores immutable snapshots atomically.
 * Client-supplied amounts are ignored.
 */
export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Checkout is unavailable: cloud services are not configured.' };
  }
  if (!input.items || input.items.length === 0) {
    return { success: false, error: 'Your bag is empty.' };
  }

  const { data, error } = await supabase.rpc('create_order', {
    p_items: input.items,
    p_payment_method: input.paymentMethod,
    p_shipping_details: input.shippingDetails,
    p_idempotency_key: input.idempotencyKey ?? null,
  });

  if (error || !data) {
    const message = error?.message || 'Order creation failed';
    console.error('create_order RPC failed:', message);
    return { success: false, error: message };
  }

  const payload = data as OrderRpcPayload;
  const now = new Date().toISOString();

  const items: OrderItemSnapshot[] = payload.items.map((item, idx) => ({
    id: `item_${payload.order_id}_${idx}`,
    order_id: payload.order_id,
    product_id: item.product_id,
    product_name_snapshot: item.product_name_snapshot,
    product_image_snapshot: item.product_image_snapshot,
    unit_price: Number(item.unit_price),
    quantity: Number(item.quantity),
    discount_amount: Number(item.discount_amount ?? 0),
    line_total: Number(item.line_total),
    selected_variant: item.selected_variant || undefined,
    created_at: now,
  }));

  const order: Order = {
    id: payload.order_id,
    order_number: payload.order_number,
    user_id: '',
    customer_email: input.shippingDetails.email,
    customer_name: input.shippingDetails.fullName,
    status: payload.status as Order['status'],
    payment_status: payload.payment_status as Order['payment_status'],
    payment_method: payload.payment_method,
    subtotal: Number(payload.subtotal),
    discount_amount: Number(payload.discount_amount ?? 0),
    shipping_amount: Number(payload.shipping_amount ?? 0),
    total_amount: Number(payload.total_amount),
    currency: payload.currency || 'INR',
    shipping_details: input.shippingDetails,
    billing_details: input.shippingDetails,
    items,
    invoice_id: payload.invoice_id,
    invoice_number: payload.invoice_number,
    created_at: now,
    updated_at: now,
  };

  const invoice: Invoice = {
    id: payload.invoice_id,
    invoice_number: payload.invoice_number,
    order_id: payload.order_id,
    order_number: payload.order_number,
    user_id: '',
    customer_name: input.shippingDetails.fullName,
    customer_email: input.shippingDetails.email,
    shipping_details: input.shippingDetails,
    items,
    subtotal: Number(payload.subtotal),
    discount_amount: Number(payload.discount_amount ?? 0),
    shipping_amount: Number(payload.shipping_amount ?? 0),
    total_amount: Number(payload.total_amount),
    currency: payload.currency || 'INR',
    status: 'Generated',
    created_at: now,
    updated_at: now,
  };

  return { success: true, order, invoice };
}

/** Customer: own orders only (enforced by RLS). */
export async function getOrdersByUser(userId: string): Promise<Order[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Failed to load user orders:', error.message);
    return [];
  }
  return hydrateOrders((data ?? []).map((row) => mapOrder(row as Record<string, unknown>)));
}

/** Shop Owner / Developer: all orders (RLS-enforced). */
export async function getAllOrders(roleOrUser: UserRole | { role?: UserRole }): Promise<Order[]> {
  const role = typeof roleOrUser === 'string' ? roleOrUser : roleOrUser?.role;
  if (role !== 'shop_owner' && role !== 'developer') return [];
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Failed to load all orders:', error.message);
    return [];
  }
  return hydrateOrders((data ?? []).map((row) => mapOrder(row as Record<string, unknown>)));
}

/** Single order with role-aware access (RLS enforces server-side). */
export async function getOrderById(orderId: string, userId: string, role: UserRole): Promise<Order | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();
  if (error) {
    console.error('Failed to load order:', error.message);
    return null;
  }
  if (!data) return null;
  // Customer isolation is enforced by RLS; this is defense in depth.
  if (role === 'customer' && data.user_id !== userId) return null;
  const [order] = await hydrateOrders([mapOrder(data as Record<string, unknown>)]);
  return order;
}

/** Shop Owner / Developer only: update order status (RLS-enforced).
 *  The order_status_changed audit entry is written by a database trigger. */
export async function updateOrderStatus(
  orderId: string,
  status: Order['status'],
  roleOrUser: UserRole | { id: string; role: UserRole; email?: string }
): Promise<{ success: boolean; order?: Order; error?: string }> {
  const role = typeof roleOrUser === 'string' ? roleOrUser : roleOrUser?.role;
  if (role !== 'shop_owner' && role !== 'developer') {
    return { success: false, error: 'Unauthorized: only Shop Owner and Developer can update order status.' };
  }
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Cloud services are not configured.' };
  }

  const { data, error } = await supabase
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .select('*')
    .maybeSingle();

  if (error) {
    return { success: false, error: error.message };
  }
  if (!data) {
    return { success: false, error: 'Order not found or not authorized.' };
  }
  const [order] = await hydrateOrders([mapOrder(data as Record<string, unknown>)]);
  return { success: true, order };
}

/** Customer: own invoices, hydrated with immutable item snapshots. */
export async function getInvoicesByUser(userId: string): Promise<Invoice[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Failed to load invoices:', error.message);
    return [];
  }
  return (data ?? []).map((row) => mapInvoice(row as Record<string, unknown>));
}

export async function getAllInvoices(role: UserRole): Promise<Invoice[]> {
  if (role !== 'shop_owner' && role !== 'developer') {
    throw new Error('Unauthorized: Only Shop Owner and Developer can access all invoices.');
  }
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Failed to load all invoices:', error.message);
    return [];
  }
  return (data ?? []).map((row) => mapInvoice(row as Record<string, unknown>));
}

/** Invoice for an order, with item snapshots from order_items (never
 *  regenerated from current product data). RLS enforces ownership. */
export async function getInvoiceByOrderId(orderId: string, user?: { id: string; role: UserRole }): Promise<Invoice | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data: invoiceRow, error: invoiceError } = await supabase
    .from('invoices')
    .select('*')
    .eq('order_id', orderId)
    .maybeSingle();
  if (invoiceError) {
    console.error('Failed to load invoice:', invoiceError.message);
    return null;
  }
  if (!invoiceRow) return null;

  // Defense in depth: customer may only read own invoices (also RLS-enforced).
  if (user && user.role === 'customer' && invoiceRow.user_id !== user.id) return null;

  const itemsByOrder = await fetchOrderItems([orderId]);
  const invoice = mapInvoice(invoiceRow as Record<string, unknown>);
  invoice.items = itemsByOrder.get(orderId) || [];
  return invoice;
}

export async function getInvoiceById(invoiceId: string, userId: string, role: UserRole): Promise<Invoice | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .maybeSingle();
  if (error) {
    console.error('Failed to load invoice:', error.message);
    return null;
  }
  if (!data) return null;
  if (role === 'customer' && data.user_id !== userId) return null;

  const itemsByOrder = await fetchOrderItems([data.order_id as string]);
  const invoice = mapInvoice(data as Record<string, unknown>);
  invoice.items = itemsByOrder.get(data.order_id as string) || [];
  return invoice;
}
