import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getOrdersByUser, getInvoiceByOrderId, cancelOrder } from '../../services/orderService';
import { downloadInvoicePDF, getInvoiceSignedUrl } from '../../services/invoiceGenerator';
import { logActivity } from '../../services/activityLogger';
import { OrderTimeline } from '../../components/OrderTimeline/OrderTimeline';
import { Order, Invoice } from '../../types';
import {
  User,
  Package,
  LogOut,
  Phone,
  Mail,
  ShoppingBag,
  Download,
  FileText,
  Shield,
  LayoutDashboard,
  Calendar,
  Truck,
  CheckCircle,
  Clock,
  ArrowRight,
} from 'lucide-react';

export const AccountPage: React.FC = () => {
  const { user, signOut, isAuthenticated, updateProfile } = useAuth();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<Order[]>([]);
  const [invoicesMap, setInvoicesMap] = useState<Record<string, Invoice>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      navigate('/auth/login');
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        const userOrders = await getOrdersByUser(user.id);
        setOrders(userOrders);

        // Fetch invoice for each order
        const map: Record<string, Invoice> = {};
        for (const order of userOrders) {
          const inv = await getInvoiceByOrderId(order.id, user);
          if (inv) {
            map[order.id] = inv;
          }
        }
        setInvoicesMap(map);
      } catch (err) {
        console.error('Failed to load user orders', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isAuthenticated, user, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({ full_name: fullName, phone });
    setEditing(false);
  };

  const handleDownloadInvoice = async (orderId: string) => {
    const inv = invoicesMap[orderId];
    if (inv) {
      try {
        await downloadInvoicePDF(inv, user!.role);
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Invoice download failed.');
      }
    } else {
      alert('Invoice is being generated for this order.');
    }
  };

  const handleShareInvoice = async (orderId: string) => {
    const inv = invoicesMap[orderId];
    if (!inv) {
      alert('Invoice is being generated for this order.');
      return;
    }
    try {
      const signedUrl = await getInvoiceSignedUrl(inv, user!.role);
      if (navigator.share) {
        await navigator.share({
          title: `Charms Hub Invoice ${inv.invoice_number}`,
          text: `Charms Hub Invoice ${inv.invoice_number} (Order ${inv.order_number})`,
          url: signedUrl,
        });
      } else {
        await navigator.clipboard.writeText(signedUrl);
        alert('Secure invoice link copied to clipboard. It expires in 5 minutes.');
      }
      // Sharing is logged only after the share/link-copy action succeeds.
      void logActivity({
        userId: user!.id,
        userEmail: user!.email,
        role: user!.role,
        eventType: 'invoice_shared',
        entityType: 'invoice',
        entityId: inv.id,
        metadata: { invoice_number: inv.invoice_number, order_number: inv.order_number },
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      alert(error instanceof Error ? error.message : 'Invoice sharing failed. Please try again.');
    }
  };

  const submitCancellation = async () => {
    if (!cancelTarget || !user) return;
    setCancelling(true);
    const res = await cancelOrder(cancelTarget.id, cancelReason);
    setCancelling(false);
    if (!res.success) {
      alert(res.error || 'Cancellation failed.');
      return;
    }
    setCancelTarget(null);
    setCancelReason('');
    // Reload orders so the cancelled state + timeline come from the cloud
    const refreshed = await getOrdersByUser(user.id);
    setOrders(refreshed);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header Profile Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#5B0E14] border border-[#F3DDD5] dark:border-[#7A1921] shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#FFD2C2] dark:bg-[#7A1921] flex items-center justify-center text-[#789A99] dark:text-[#F1E194] text-2xl font-bold font-serif-display shadow-xs">
            {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'C'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif-display text-xl sm:text-2xl font-bold text-[#2B1810] dark:text-[#FCF7DC]">
                {user?.full_name || 'Charms Hub Shopper'}
              </h1>
              <span
                className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${
                  user?.role === 'shop_owner'
                    ? 'bg-[#E91E63]/15 text-[#E91E63] border border-[#E91E63]/30'
                    : user?.role === 'developer'
                    ? 'bg-[#789A99]/20 text-[#789A99] dark:text-[#F1E194] border border-[#789A99]/30'
                    : 'bg-[#789A99]/15 text-[#789A99] dark:text-[#F1E194] border border-[#789A99]/30'
                }`}
              >
                {user?.role === 'shop_owner'
                  ? 'Shop Owner'
                  : user?.role === 'developer'
                  ? 'Developer'
                  : 'Customer'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-stone-300 mt-1">
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" />
                {user?.email}
              </span>
              {user?.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" />
                  {user.phone}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {user?.role === 'shop_owner' && (
            <Link
              to="/owner"
              className="px-4 py-2 rounded-full bg-[#E91E63] hover:bg-[#C2185B] text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Owner Dashboard</span>
            </Link>
          )}

          {user?.role === 'developer' && (
            <Link
              to="/developer"
              className="px-4 py-2 rounded-full bg-[#789A99] hover:bg-[#587978] text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Dev Console</span>
            </Link>
          )}

          <button
            onClick={() => setEditing(!editing)}
            className="px-4 py-2 rounded-full border border-[#F3DDD5] dark:border-[#7A1921] text-xs font-bold text-[#2B1810] dark:text-[#FCF7DC] hover:bg-[#FFD2C2]/40 transition cursor-pointer"
          >
            {editing ? 'Cancel' : 'Edit Profile'}
          </button>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-rose-100 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Role-based workspace links are rendered contextually in the header
          card above; roles are assigned server-side in user_profiles. */}

      {/* Profile Edit Form */}
      {editing && (
        <form
          onSubmit={handleSaveProfile}
          className="p-5 rounded-2xl bg-white dark:bg-[#5B0E14] border border-[#F3DDD5] dark:border-[#7A1921] space-y-4 text-xs"
        >
          <h3 className="font-bold text-sm text-[#2B1810] dark:text-[#FCF7DC]">
            Update Personal Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-gray-700 dark:text-stone-300 mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-[#F3DDD5] dark:border-[#7A1921] bg-[#FFF8F5] dark:bg-[#3F070B] text-[#2B1810] dark:text-[#FCF7DC]"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 dark:text-stone-300 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-[#F3DDD5] dark:border-[#7A1921] bg-[#FFF8F5] dark:bg-[#3F070B] text-[#2B1810] dark:text-[#FCF7DC]"
              />
            </div>
          </div>
          <button
            type="submit"
            className="px-5 py-2 rounded-xl bg-[#789A99] hover:bg-[#587978] text-white font-bold cursor-pointer"
          >
            Save Changes
          </button>
        </form>
      )}

      {/* Orders & Invoices Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-[#789A99] dark:text-[#F1E194]" />
            <h2 className="font-serif-display text-lg sm:text-xl font-bold text-[#2B1810] dark:text-[#FCF7DC]">
              My Orders &amp; Tax Invoices ({orders.length})
            </h2>
          </div>
          <Link
            to="/products"
            className="text-xs font-bold text-[#789A99] dark:text-[#F1E194] hover:underline"
          >
            Shop more items &rarr;
          </Link>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-gray-400">Loading orders...</div>
        ) : orders.length === 0 ? (
          <div className="p-12 rounded-3xl bg-white dark:bg-[#5B0E14] border border-[#F3DDD5] dark:border-[#7A1921] text-center space-y-4">
            <ShoppingBag className="w-10 h-10 text-gray-300 dark:text-stone-500 mx-auto" />
            <div>
              <p className="font-bold text-[#2B1810] dark:text-[#FCF7DC] text-sm">
                No orders placed yet
              </p>
              <p className="text-xs text-gray-500 dark:text-stone-300 mt-1">
                Explore our catalog of verified earrings, bracelets, and scoops!
              </p>
            </div>
            <Link
              to="/products"
              className="inline-block px-6 py-2.5 rounded-full bg-[#789A99] hover:bg-[#587978] text-white font-bold text-xs shadow-xs"
            >
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const invoice = invoicesMap[order.id];
              return (
                <div
                  key={order.id}
                  className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#5B0E14] border border-[#F3DDD5] dark:border-[#7A1921] shadow-xs space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#F3DDD5] dark:border-[#7A1921]/60 text-xs">
                    <div className="space-y-0.5">
                      <span className="font-bold text-[#2B1810] dark:text-[#FCF7DC] text-sm">
                        Order #{order.order_number}
                      </span>
                      <div className="flex items-center gap-2 text-gray-400 text-[11px]">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{new Date(order.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-3 py-1 rounded-full text-[11px] font-bold ${
                          order.status === 'Delivered'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : order.status === 'Shipped'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                            : order.status === 'Cancelled'
                            ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        {order.status.toUpperCase()}
                      </span>

                      {/* Download Invoice Button */}
                      <button
                        onClick={() => handleDownloadInvoice(order.id)}
                        className="px-3 py-1.5 rounded-full bg-[#FFD2C2]/40 dark:bg-[#7A1921] hover:bg-[#FFD2C2] text-[#2B1810] dark:text-[#F1E194] text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border border-[#F3DDD5] dark:border-[#8F1F28]"
                        title="Download Invoice"
                      >
                        <Download className="w-3.5 h-3.5 text-[#789A99] dark:text-[#F1E194]" />
                        <span>PDF Invoice</span>
                      </button>

                      {/* Share Invoice Button */}
                      {invoicesMap[order.id] && (
                        <button
                          onClick={() => handleShareInvoice(order.id)}
                          className="px-3 py-1.5 rounded-full bg-white dark:bg-[#7A1921] text-[#2B1810] dark:text-[#FCF7DC] text-xs font-bold transition cursor-pointer border border-[#F3DDD5] dark:border-[#8F1F28] hover:bg-[#FFF8F5]"
                          title="Share Invoice"
                        >
                          <span>Share</span>
                        </button>
                      )}

                      {/* Cancel Order (only before shipment) */}
                      {['Pending', 'Confirmed', 'Processing'].includes(order.status) && (
                        <button
                          onClick={() => { setCancelTarget(order); setCancelReason(''); }}
                          className="px-3 py-1.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 text-xs font-bold border border-rose-200 dark:border-rose-900 hover:bg-rose-100 transition cursor-pointer"
                        >
                          Cancel Order
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Cancellation Dialog */}
                  {cancelTarget?.id === order.id && (
                    <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 space-y-2.5">
                      <p className="text-xs font-bold text-rose-700 dark:text-rose-300">
                        Cancel order #{order.order_number}?
                      </p>
                      <p className="text-[11px] text-rose-600/90 dark:text-rose-300/90">
                        {order.payment_status === 'Pending Verification' || order.payment_status === 'Paid'
                          ? 'This prepaid order will be marked Refund Required and reviewed manually by our team.'
                          : 'This Cash on Delivery order requires no refund.'}
                      </p>
                      <textarea
                        rows={2}
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="Cancellation reason (required)"
                        className="w-full p-2.5 rounded-xl border border-rose-200 dark:border-rose-900 bg-white dark:bg-[#3F070B] text-xs text-[#2B1810] dark:text-[#FCF7DC]"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setCancelTarget(null)}
                          className="px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900 text-xs font-bold text-rose-700 dark:text-rose-300 cursor-pointer"
                        >
                          Keep Order
                        </button>
                        <button
                          onClick={submitCancellation}
                          disabled={cancelling || cancelReason.trim().length < 3}
                          className="px-4 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {cancelling ? 'Cancelling…' : 'Confirm Cancellation'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Status Timeline */}
                  <div className="pt-1">
                    <OrderTimeline order={order} />
                  </div>

                  {/* Item List */}
                  <div className="space-y-3">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-3">
                          {item.product_image_snapshot ? (
                            <img
                              src={item.product_image_snapshot}
                              alt={item.product_name_snapshot}
                              className="w-12 h-12 object-cover rounded-lg border border-[#F3DDD5] dark:border-[#7A1921]"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-stone-800 flex items-center justify-center">
                              <ShoppingBag className="w-4 h-4 text-gray-400" />
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-[#2B1810] dark:text-[#FCF7DC]">
                              {item.product_name_snapshot}
                            </p>
                            <p className="text-[11px] text-gray-500 dark:text-stone-400">
                              Qty: {item.quantity} &times; ₹{item.unit_price}
                            </p>
                          </div>
                        </div>
                        <span className="font-extrabold text-[#2B1810] dark:text-[#F1E194]">
                          ₹{item.line_total || item.unit_price * item.quantity}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Summary Footer */}
                  <div className="pt-3 border-t border-[#F3DDD5] dark:border-[#7A1921]/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="text-gray-500 dark:text-stone-400 text-[11px]">
                      {order.shipping_details ? (
                        <span>
                          Shipping to: {order.shipping_details.street}, {order.shipping_details.city} - {order.shipping_details.pincode}
                        </span>
                      ) : (
                        <span>Shipping address on file</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 dark:text-stone-400">Total Paid:</span>
                      <span className="text-sm font-extrabold text-[#2B1810] dark:text-[#F1E194]">
                        ₹{order.total_amount}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
