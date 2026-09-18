import { Order, Invoice, OrderItemSnapshot, OrderStatus, ShippingAddress, UserRole, CartItem } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';
import { logActivity } from './activityLogger';

const ORDERS_STORAGE_KEY = 'charms_hub_orders';
const INVOICES_STORAGE_KEY = 'charms_hub_invoices';

export async function createOrder(params: {
  userId: string;
  userEmail: string;
  customerName: string;
  shippingDetails: ShippingAddress;
  paymentMethod: string;
  cartItems: CartItem[];
  subtotal: number;
  discountAmount: number;
  shippingAmount: number;
  totalAmount: number;
}): Promise<{ order: Order; invoice: Invoice }> {
  const now = new Date().toISOString();
  const randomSuffix = Math.floor(10000 + Math.random() * 90000);
  const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const orderNumber = `CH-2026-${randomSuffix}`;
  const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const invoiceNumber = `INV-CH-2026-${randomSuffix}`;

  // 1. Create historical snapshots of items
  const itemSnapshots: OrderItemSnapshot[] = params.cartItems.map((item, idx) => ({
    id: `item_${Date.now()}_${idx}`,
    order_id: orderId,
    product_id: item.product.id,
    product_name_snapshot: item.product.name,
    product_image_snapshot: item.product.image_url,
    unit_price: item.product.price,
    quantity: item.quantity,
    discount_amount: 0,
    line_total: item.product.price * item.quantity,
    selected_variant: item.selected_variant,
    created_at: now,
  }));

  const paymentStatus = params.paymentMethod.toLowerCase().includes('cash')
    ? 'Cash on Delivery'
    : 'Paid';

  // 2. Create Order
  const order: Order = {
    id: orderId,
    order_number: orderNumber,
    user_id: params.userId,
    customer_email: params.userEmail,
    customer_name: params.customerName,
    status: 'Confirmed',
    payment_status: paymentStatus,
    payment_method: params.paymentMethod,
    subtotal: params.subtotal,
    discount_amount: params.discountAmount,
    shipping_amount: params.shippingAmount,
    total_amount: params.totalAmount,
    currency: 'INR',
    shipping_details: params.shippingDetails,
    billing_details: params.shippingDetails,
    items: itemSnapshots,
    invoice_id: invoiceId,
    invoice_number: invoiceNumber,
    created_at: now,
    updated_at: now,
  };

  // 3. Create Invoice
  const invoice: Invoice = {
    id: invoiceId,
    invoice_number: invoiceNumber,
    order_id: orderId,
    order_number: orderNumber,
    user_id: params.userId,
    customer_name: params.customerName,
    customer_email: params.userEmail,
    shipping_details: params.shippingDetails,
    items: itemSnapshots,
    subtotal: params.subtotal,
    discount_amount: params.discountAmount,
    shipping_amount: params.shippingAmount,
    total_amount: params.totalAmount,
    currency: 'INR',
    status: 'Generated',
    created_at: now,
    updated_at: now,
  };

  // 4. Save to Supabase if configured
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('orders').insert([order]);
      await supabase.from('order_items').insert(itemSnapshots);
      await supabase.from('invoices').insert([invoice]);
    } catch (err) {
      console.warn('Supabase order insert failed, saving to local store:', err);
    }
  }

  // 5. Always save to local storage
  try {
    const existingOrders: Order[] = JSON.parse(localStorage.getItem(ORDERS_STORAGE_KEY) || '[]');
    localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify([order, ...existingOrders]));

    const existingInvoices: Invoice[] = JSON.parse(localStorage.getItem(INVOICES_STORAGE_KEY) || '[]');
    localStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify([invoice, ...existingInvoices]));
  } catch (err) {
    console.error('Failed to save order to local storage:', err);
  }

  // 6. Log audit events
  await logActivity({
    userId: params.userId,
    userEmail: params.userEmail,
    role: 'customer',
    eventType: 'order_created',
    entityType: 'order',
    entityId: orderId,
    metadata: {
      order_number: orderNumber,
      total_amount: params.totalAmount,
      item_count: params.cartItems.length,
    },
  });

  await logActivity({
    userId: params.userId,
    userEmail: params.userEmail,
    role: 'customer',
    eventType: 'invoice_generated',
    entityType: 'invoice',
    entityId: invoiceId,
    metadata: {
      invoice_number: invoiceNumber,
      order_number: orderNumber,
    },
  });

  return { order, invoice };
}

// Customer Isolation: Only retrieve orders belonging to userId
export async function getOrdersByUser(userId: string): Promise<Order[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        return data as Order[];
      }
    } catch (err) {
      console.warn('Supabase query failed, falling back to local store:', err);
    }
  }

  try {
    const raw: Order[] = JSON.parse(localStorage.getItem(ORDERS_STORAGE_KEY) || '[]');
    return raw.filter((o) => o.user_id === userId);
  } catch {
    return [];
  }
}

// Authorized: Shop Owner and Developer only
export async function getAllOrders(roleOrUser: UserRole | { role: UserRole }): Promise<Order[]> {
  const role = typeof roleOrUser === 'string' ? roleOrUser : roleOrUser?.role;
  if (role !== 'shop_owner' && role !== 'developer') {
    return [];
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        return data as Order[];
      }
    } catch (err) {
      console.warn('Supabase query failed, falling back to local store:', err);
    }
  }

  try {
    return JSON.parse(localStorage.getItem(ORDERS_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

// Get single order with permission check
export async function getOrderById(orderId: string, userId: string, role: UserRole): Promise<Order | null> {
  let order: Order | null = null;

  try {
    const raw: Order[] = JSON.parse(localStorage.getItem(ORDERS_STORAGE_KEY) || '[]');
    order = raw.find((o) => o.id === orderId) || null;
  } catch {
    order = null;
  }

  if (!order) return null;

  // Permission check: customer can only view their own order
  if (role === 'customer' && order.user_id !== userId) {
    throw new Error('Access denied: You cannot view another customer’s order.');
  }

  return order;
}

// Update order status (Shop Owner / Developer only)
export async function updateOrderStatus(
  orderId: string,
  status: any,
  roleOrUser: UserRole | { id: string; role: UserRole; email?: string },
  userEmail?: string,
  userId?: string
): Promise<{ success: boolean; order?: Order; error?: string }> {
  const role = typeof roleOrUser === 'string' ? roleOrUser : roleOrUser?.role;
  const effectiveEmail = typeof roleOrUser === 'object' ? roleOrUser.email || 'system' : userEmail || 'system';
  const effectiveUserId = typeof roleOrUser === 'object' ? roleOrUser.id : userId || 'system';

  if (role !== 'shop_owner' && role !== 'developer') {
    return { success: false, error: 'Unauthorized: Only Shop Owner and Developer can update order status.' };
  }

  let updatedOrder: Order | null = null;
  try {
    const raw: Order[] = JSON.parse(localStorage.getItem(ORDERS_STORAGE_KEY) || '[]');
    const idx = raw.findIndex((o) => o.id === orderId);
    if (idx !== -1) {
      raw[idx].status = status;
      raw[idx].updated_at = new Date().toISOString();
      localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(raw));
      updatedOrder = raw[idx];
    }
  } catch (err) {
    console.error('Failed to update order status:', err);
    return { success: false, error: 'Failed to update order status' };
  }

  if (updatedOrder) {
    await logActivity({
      userId: effectiveUserId,
      userEmail: effectiveEmail,
      role,
      eventType: 'order_status_updated',
      entityType: 'order',
      entityId: orderId,
      metadata: {
        new_status: status,
        order_number: updatedOrder.order_number,
      },
    });
  }

  return { success: true, order: updatedOrder || undefined };
}


// Invoices for customer (Customer Isolation)
export async function getInvoicesByUser(userId: string): Promise<Invoice[]> {
  try {
    const raw: Invoice[] = JSON.parse(localStorage.getItem(INVOICES_STORAGE_KEY) || '[]');
    return raw.filter((inv) => inv.user_id === userId);
  } catch {
    return [];
  }
}

// Authorized: Shop Owner and Developer only
export async function getAllInvoices(role: UserRole): Promise<Invoice[]> {
  if (role !== 'shop_owner' && role !== 'developer') {
    throw new Error('Unauthorized: Only Shop Owner and Developer can access all invoices.');
  }
  try {
    return JSON.parse(localStorage.getItem(INVOICES_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

// Single invoice with permission check
export async function getInvoiceById(invoiceId: string, userId: string, role: UserRole): Promise<Invoice | null> {
  let invoice: Invoice | null = null;
  try {
    const raw: Invoice[] = JSON.parse(localStorage.getItem(INVOICES_STORAGE_KEY) || '[]');
    invoice = raw.find((i) => i.id === invoiceId) || null;
  } catch {
    invoice = null;
  }

  if (!invoice) return null;

  if (role === 'customer' && invoice.user_id !== userId) {
    throw new Error('Access denied: You cannot view another customer’s invoice.');
  }

  return invoice;
}

// Convenient alias for fetching user orders
export async function getUserOrders(userId: string, _user?: any): Promise<Order[]> {
  return getOrdersByUser(userId);
}

// Find invoice by order ID
export async function getInvoiceByOrderId(orderId: string, user?: any): Promise<Invoice | null> {
  try {
    const raw: Invoice[] = JSON.parse(localStorage.getItem(INVOICES_STORAGE_KEY) || '[]');
    const inv = raw.find((i) => i.order_id === orderId || i.id === orderId);
    if (!inv) return null;

    if (user && user.role === 'customer' && inv.user_id !== user.id) {
      return null;
    }
    return inv;
  } catch {
    return null;
  }
}
