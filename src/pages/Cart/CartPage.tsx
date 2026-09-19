import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { createOrder } from '../../services/orderService';
import { downloadInvoicePDF } from '../../services/invoiceGenerator';
import { getStoreConfig, STORE_CONFIG_KEYS } from '../../services/storeConfig';
import { Order, Invoice } from '../../types';
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  Sparkles,
  ArrowRight,
  MessageCircle,
  Truck,
  ShieldCheck,
  Instagram,
  CheckCircle2,
  Download,
  FileText,
  UserCheck,
  AlertCircle,
} from 'lucide-react';

export const CartPage: React.FC = () => {
  const {
    cart,
    removeFromCart,
    updateQuantity,
    clearCart,
    subtotal,
    totalItems,
    freeShippingThreshold,
    amountNeededForFreeShipping,
    isFreeShipping,
  } = useCart();
  const { user, isAuthenticated, setPendingAction } = useAuth();
  const navigate = useNavigate();

  const [customerName, setCustomerName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [houseBuilding, setHouseBuilding] = useState('');
  const [street, setStreet] = useState('');
  const [area, setArea] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('Maharashtra');
  const [pincode, setPincode] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cod'>('online');
  const [upiReference, setUpiReference] = useState('');
  const [merchantUpiId, setMerchantUpiId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [createdInvoice, setCreatedInvoice] = useState<Invoice | null>(null);

  // Merchant UPI ID comes from the owner-managed store configuration
  // (never hardcoded). A missing value simply hides the UPI details block.
  useEffect(() => {
    void getStoreConfig(STORE_CONFIG_KEYS.upiMerchantId).then(setMerchantUpiId);
  }, []);

  // Replay protection: one stable key per checkout session, so a retry
  // after a network hiccup can never create a second order.
  const idempotencyKey = useRef<string>(
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `cart_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
  );

  const shippingCost = isFreeShipping ? 0 : 50;
  const grandTotal = subtotal + shippingCost;

  const handleAuthRedirect = () => {
    setPendingAction({
      action: 'buy_now',
      productId: cart[0]?.product.id || '',
      quantity: 1,
      returnUrl: '/cart',
      timestamp: Date.now(),
    });
    navigate('/auth/login?redirect=/cart');
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrderError('');
    if (cart.length === 0) return;

    if (!isAuthenticated || !user) {
      handleAuthRedirect();
      return;
    }

    // Required-field validation before the secure order transaction
    if (!customerName.trim() || !phone.trim() || !houseBuilding.trim() || !street.trim() || !area.trim() || !city.trim() || !pincode.trim()) {
      setOrderError('Please fill in all required delivery fields (name, phone, house/building, street, area, city, and pincode).');
      return;
    }

    setSubmitting(true);

    try {
      // Secure server-side transaction: the database fetches current prices,
      // validates stock/availability and computes ALL monetary values.
      // Client-side totals below are estimates only.
      const result = await createOrder({
        items: cart.map((i) => ({
          product_id: i.product.id,
          quantity: i.quantity,
          selected_variant: i.selected_variant,
        })),
        paymentMethod: paymentMethod === 'cod' ? 'Cash on Delivery' : 'UPI',
        paymentReference: paymentMethod === 'online' ? upiReference.trim() : undefined,
        shippingDetails: {
          fullName: customerName.trim() || user.full_name || 'Customer',
          phone: phone.trim(),
          email: user.email,
          house_building: houseBuilding.trim(),
          street: street.trim(),
          area: area.trim(),
          city: city.trim(),
          state: stateName,
          pincode: pincode.trim(),
          landmark: instagramHandle ? `IG: @${instagramHandle}` : undefined,
        },
        idempotencyKey: idempotencyKey.current,
      });

      if (result.success && result.order) {
        setCreatedOrder(result.order);
        setCreatedInvoice(result.invoice || null);
        clearCart();

        // Authoritative stored values (never the pre-checkout estimates)
        const itemsSummary = (result.order.items || [])
          .map(
            (item, idx) =>
              `${idx + 1}. ${item.product_name_snapshot} (Qty: ${item.quantity}) - ₹${item.line_total}`
          )
          .join('\n');
        const storedSubtotal = result.order.subtotal;
        const storedShipping = result.order.shipping_amount;
        const storedTotal = result.order.total_amount;

        const message = `🛍️ *NEW ORDER - CHARMS HUB*
Order ID: #${result.order.order_number}
Invoice ID: #${result.invoice?.invoice_number || 'INV-PENDING'}

*Customer Details:*
• Name: ${result.order.customer_name}
• Phone: ${phone}
• Address: ${houseBuilding}, ${street}, ${area}, ${city} - ${pincode}
${instagramHandle ? `• Instagram: @${instagramHandle.replace('@', '')} (Tag packaging video!)` : ''}

*Order Items:*
${itemsSummary}

*Payment Summary:*
• Subtotal: ₹${storedSubtotal}
• Shipping: ${storedShipping === 0 ? 'FREE' : `₹${storedShipping}`}
• Total Amount: *₹${storedTotal}*
Payment Status: ${result.order.payment_status}
Status: ${result.order.status}`;

        // Open WhatsApp only when the owner has configured a valid support number.
        const configuredWhatsApp = await getStoreConfig(STORE_CONFIG_KEYS.supportWhatsApp);
        const whatsappNumber = configuredWhatsApp?.trim().replace(/[^\d]/g, '') || '';
        if (whatsappNumber.length >= 7 && whatsappNumber.length <= 15) {
          window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank');
        }
      } else {
        setOrderError(result.error || 'Failed to place order. Please try again.');
      }
    } catch (err: any) {
      setOrderError(err?.message || 'Error occurred while creating order');
    } finally {
      setSubmitting(false);
    }
  };


  const handleDownloadInvoice = async () => {
    if (createdInvoice) {
      try {
        await downloadInvoicePDF(createdInvoice);
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Invoice download failed.');
      }
    }
  };

  if (createdOrder) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-md animate-bounce">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-[#789A99] dark:text-[#F1E194]">
            Order #{createdOrder.order_number}
          </span>
          <h1 className="font-serif-display text-3xl font-bold text-[#2B1810] dark:text-[#FCF7DC]">
            Order Confirmed!
          </h1>
          <p className="text-sm text-gray-600 dark:text-stone-300 max-w-md mx-auto">
            Your order has been recorded securely in Charms Hub. An invoice has been automatically generated for your purchase.
          </p>
        </div>

        {/* Invoice Download Action Card */}
        {createdInvoice && (
          <div className="p-5 rounded-2xl bg-[#FFF8F5] dark:bg-[#5B0E14] border border-[#F3DDD5] dark:border-[#7A1921] max-w-md mx-auto text-left space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#789A99] dark:text-[#F1E194]" />
                  <span className="text-xs font-bold text-[#2B1810] dark:text-[#FCF7DC]">
                    Invoice #{createdInvoice.invoice_number}
                  </span>
                </div>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                  Generated
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-stone-300">
                Invoice with items breakdown, shipping details, and your stored order totals.
              </p>
            <button
              onClick={handleDownloadInvoice}
              className="w-full py-2.5 px-4 rounded-xl bg-[#789A99] hover:bg-[#587978] text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-sm cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF Invoice</span>
            </button>
          </div>
        )}

        {instagramHandle && (
          <div className="p-4 rounded-2xl bg-[#FFF8F5] dark:bg-[#5B0E14] border border-[#F3DDD5] dark:border-[#7A1921] max-w-md mx-auto flex items-center gap-3 text-left">
            <Instagram className="w-6 h-6 text-pink-600 shrink-0" />
            <div className="text-xs">
              <span className="font-bold text-[#2B1810] dark:text-[#FCF7DC] block">
                Packaging Video Requested
              </span>
              <span className="text-gray-500 dark:text-stone-400">
                Keep an eye out on our Instagram Story for @{instagramHandle.replace('@', '')}&apos;s package!
              </span>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-center gap-3 pt-4">
          <Link
            to="/products"
            className="px-6 py-3 rounded-full bg-[#789A99] text-white font-bold text-xs hover:bg-[#587978] transition shadow-md"
          >
            Continue Shopping
          </Link>
          <Link
            to="/account"
            className="px-6 py-3 rounded-full bg-white dark:bg-[#5B0E14] border border-[#F3DDD5] dark:border-[#7A1921] text-[#2B1810] dark:text-[#FCF7DC] font-bold text-xs hover:bg-[#FFD2C2]/40 transition"
          >
            View My Orders &amp; Invoices
          </Link>
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-5">
        <div className="w-20 h-20 rounded-full bg-[#FFF1EC] dark:bg-[#7A1921] flex items-center justify-center mx-auto text-[#789A99] dark:text-[#F1E194]">
          <ShoppingBag className="w-10 h-10" />
        </div>
        <div>
          <h1 className="font-serif-display text-2xl sm:text-3xl font-bold text-[#2B1810] dark:text-[#FCF7DC]">
            Your Shopping Bag is Empty
          </h1>
          <p className="text-sm text-gray-500 dark:text-stone-300 mt-2 max-w-md mx-auto">
            Discover our collection of handcrafted Kashmiri earrings, anti-tarnish jewelry, and viral mystery scoops!
          </p>
        </div>
        <div className="pt-2">
          <Link
            to="/products"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-[#789A99] hover:bg-[#587978] text-white font-bold text-sm shadow-md transition hover:scale-105"
          >
            <span>Explore Products</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="font-serif-display text-2xl sm:text-3xl font-bold text-[#2B1810] dark:text-[#FCF7DC]">
          Your Shopping Bag ({totalItems} Items)
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-stone-300 mt-1">
          Review your items and complete your delivery details below.
        </p>
      </div>

      {/* Auth Gate Notification Banner if not logged in */}
      {!isAuthenticated && (
        <div className="p-4 rounded-2xl bg-[#FFF1EC] dark:bg-[#7A1921]/60 border border-[#FFD2C2] dark:border-[#8F1F28] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-[#E91E63] shrink-0" />
            <div>
              <p className="font-bold text-[#2B1810] dark:text-[#FCF7DC]">
                Sign in required to finalize order
              </p>
              <p className="text-[11px] text-gray-600 dark:text-stone-300">
                Please sign in to enable automatic invoice creation and live order tracking.
              </p>
            </div>
          </div>
          <button
            onClick={handleAuthRedirect}
            className="px-4 py-2 rounded-xl bg-[#789A99] hover:bg-[#587978] text-white font-bold text-xs shrink-0 cursor-pointer shadow-xs"
          >
            Sign In Now
          </button>
        </div>
      )}

      {/* Free shipping banner */}
      <div className="p-4 rounded-2xl bg-[#FFF1EC] dark:bg-[#5B0E14] border border-[#F3DDD5] dark:border-[#7A1921] space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-[#2B1810] dark:text-[#FCF7DC]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#789A99] dark:text-[#F1E194]" />
            {isFreeShipping ? (
              <span className="text-emerald-600 dark:text-emerald-400">
                You have qualified for FREE SHIPPING!
              </span>
            ) : (
              <span>Add ₹{amountNeededForFreeShipping} more to get FREE SHIPPING (Above ₹{freeShippingThreshold})</span>
            )}
          </div>
          <span className="text-[11px] text-gray-500">Min: ₹{freeShippingThreshold}</span>
        </div>
        <div className="w-full h-2 bg-gray-200 dark:bg-[#7A1921] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#789A99] to-emerald-500 dark:from-[#F1E194] dark:to-emerald-400 transition-all duration-500"
            style={{ width: `${Math.min(100, (subtotal / freeShippingThreshold) * 100)}%` }}
          />
        </div>
      </div>

      {/* 2-Column Layout: Cart Items (Left) + Shipping & Order Info (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Left: Cart Items Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-[#5B0E14] rounded-2xl border border-[#F3DDD5] dark:border-[#7A1921] overflow-hidden shadow-xs divide-y divide-[#F3DDD5] dark:divide-[#7A1921]">
            {cart.map((item) => (
              <div key={item.product.id} className="p-4 sm:p-5 flex gap-4 items-center">
                <img
                  src={item.product.image_url}
                  alt={item.product.name}
                  className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-xl shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#789A99] dark:text-[#E3D1AC]">
                    {item.product.category_name}
                  </span>
                  <h3 className="text-sm sm:text-base font-bold text-[#2B1810] dark:text-[#FCF7DC] line-clamp-1">
                    {item.product.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-extrabold text-[#2B1810] dark:text-[#F1E194]">
                      ₹{item.product.price}
                    </span>
                    {item.product.mrp && (
                      <span className="text-xs text-gray-400 line-through">
                        ₹{item.product.mrp}
                      </span>
                    )}
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center border border-[#F3DDD5] dark:border-[#7A1921] rounded-lg overflow-hidden bg-[#FFF8F5] dark:bg-[#3F070B]">
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        className="p-1.5 hover:bg-[#FFD2C2]/40 dark:hover:bg-[#7A1921] transition cursor-pointer"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-3.5 h-3.5 text-gray-600 dark:text-stone-300" />
                      </button>
                      <span className="px-3 text-xs font-bold text-[#2B1810] dark:text-[#FCF7DC]">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        className="p-1.5 hover:bg-[#FFD2C2]/40 dark:hover:bg-[#7A1921] transition cursor-pointer"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-3.5 h-3.5 text-gray-600 dark:text-stone-300" />
                      </button>
                    </div>

                    <span className="text-xs font-bold text-[#2B1810] dark:text-[#FCF7DC]">
                      Total: ₹{item.product.price * item.quantity}
                    </span>

                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                      title="Remove product"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-xs">
            <Link to="/products" className="text-[#789A99] dark:text-[#F1E194] font-bold hover:underline">
              &larr; Add more products
            </Link>
            <button
              onClick={clearCart}
              className="text-gray-400 hover:text-red-500 transition font-semibold cursor-pointer"
            >
              Clear entire cart
            </button>
          </div>
        </div>

        {/* Right: Checkout & Delivery Form */}
        <div className="space-y-6">
          <form
            onSubmit={handlePlaceOrder}
            className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#5B0E14] border border-[#F3DDD5] dark:border-[#7A1921] shadow-md space-y-5"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#F3DDD5] dark:border-[#7A1921]">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#789A99] dark:text-[#F1E194]" />
                <h2 className="font-bold text-sm text-[#2B1810] dark:text-[#FCF7DC]">
                  Delivery &amp; Packaging Details
                </h2>
              </div>
              {isAuthenticated && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1">
                  <UserCheck className="w-3 h-3" />
                  Verified
                </span>
              )}
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700 dark:text-stone-300 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Priya Sharma"
                  className="w-full p-2.5 rounded-xl border border-[#F3DDD5] dark:border-[#7A1921] bg-[#FFF8F5] dark:bg-[#3F070B] text-[#2B1810] dark:text-[#FCF7DC] focus:outline-hidden focus:ring-1 focus:ring-[#789A99]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-stone-300 mb-1">
                  Phone / WhatsApp Number *
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="10-digit mobile number"
                  className="w-full p-2.5 rounded-xl border border-[#F3DDD5] dark:border-[#7A1921] bg-[#FFF8F5] dark:bg-[#3F070B] text-[#2B1810] dark:text-[#FCF7DC] focus:outline-hidden focus:ring-1 focus:ring-[#789A99]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-stone-300 mb-1">
                  House / Building / Flat *
                </label>
                <input
                  type="text"
                  required
                  value={houseBuilding}
                  onChange={(e) => setHouseBuilding(e.target.value)}
                  placeholder="e.g. B-402, Sunrise Apartments"
                  className="w-full p-2.5 rounded-xl border border-[#F3DDD5] dark:border-[#7A1921] bg-[#FFF8F5] dark:bg-[#3F070B] text-[#2B1810] dark:text-[#FCF7DC] focus:outline-hidden focus:ring-1 focus:ring-[#789A99]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-stone-300 mb-1">
                  Street / Road *
                </label>
                <input
                  type="text"
                  required
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="e.g. MG Road, Near City Mall"
                  className="w-full p-2.5 rounded-xl border border-[#F3DDD5] dark:border-[#7A1921] bg-[#FFF8F5] dark:bg-[#3F070B] text-[#2B1810] dark:text-[#FCF7DC] focus:outline-hidden focus:ring-1 focus:ring-[#789A99]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-stone-300 mb-1">
                  Area / Locality *
                </label>
                <input
                  type="text"
                  required
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="e.g. Andheri West"
                  className="w-full p-2.5 rounded-xl border border-[#F3DDD5] dark:border-[#7A1921] bg-[#FFF8F5] dark:bg-[#3F070B] text-[#2B1810] dark:text-[#FCF7DC] focus:outline-hidden focus:ring-1 focus:ring-[#789A99]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-stone-300 mb-1">
                    City *
                  </label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Mumbai"
                    className="w-full p-2.5 rounded-xl border border-[#F3DDD5] dark:border-[#7A1921] bg-[#FFF8F5] dark:bg-[#3F070B] text-[#2B1810] dark:text-[#FCF7DC] focus:outline-hidden focus:ring-1 focus:ring-[#789A99]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 dark:text-stone-300 mb-1">
                    Pincode *
                  </label>
                  <input
                    type="text"
                    required
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    placeholder="e.g. 400001"
                    className="w-full p-2.5 rounded-xl border border-[#F3DDD5] dark:border-[#7A1921] bg-[#FFF8F5] dark:bg-[#3F070B] text-[#2B1810] dark:text-[#FCF7DC] focus:outline-hidden focus:ring-1 focus:ring-[#789A99]"
                  />
                </div>
              </div>

              {/* Instagram Handle Input */}
              <div className="pt-2 border-t border-[#F3DDD5] dark:border-[#7A1921]">
                <label className="block font-bold text-[#C2185B] dark:text-[#F1E194] mb-1 flex items-center gap-1.5">
                  <Instagram className="w-3.5 h-3.5" />
                  <span>Instagram Handle (Optional - For Packaging Story)</span>
                </label>
                <input
                  type="text"
                  value={instagramHandle}
                  onChange={(e) => setInstagramHandle(e.target.value)}
                  placeholder="@your_instagram_handle"
                  className="w-full p-2.5 rounded-xl border border-[#F3DDD5] dark:border-[#7A1921] bg-[#FFF8F5] dark:bg-[#3F070B] text-[#2B1810] dark:text-[#FCF7DC] focus:outline-hidden focus:ring-1 focus:ring-pink-400"
                />
                <span className="text-[10px] text-gray-400 mt-1 block">
                  We will tag you when packing your order live on Instagram Stories!
                </span>
              </div>

              {/* Payment Method Selector */}
              <div className="pt-2 border-t border-[#F3DDD5] dark:border-[#7A1921] space-y-2">
                <label className="block font-bold text-gray-700 dark:text-stone-300">
                  Payment Method *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('online')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                      paymentMethod === 'online'
                        ? 'border-[#789A99] bg-[#789A99]/15 text-[#2B1810] dark:text-[#F1E194]'
                        : 'border-[#F3DDD5] dark:border-[#7A1921] text-gray-500 hover:border-gray-400'
                    }`}
                  >
                    <span>UPI</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cod')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                      paymentMethod === 'cod'
                        ? 'border-[#789A99] bg-[#789A99]/15 text-[#2B1810] dark:text-[#F1E194]'
                        : 'border-[#F3DDD5] dark:border-[#7A1921] text-gray-500 hover:border-gray-400'
                    }`}
                  >
                    <span>Cash on Delivery</span>
                  </button>
                </div>

                {/* UPI Payment Section */}
                {paymentMethod === 'online' && (
                  <div className="p-3 rounded-xl bg-[#FFF8F5] dark:bg-[#3F070B] border border-[#F3DDD5] dark:border-[#7A1921] space-y-2">
                    {merchantUpiId ? (
                      <div className="text-[11px] text-gray-600 dark:text-stone-300">
                        <span className="font-bold text-[#2B1810] dark:text-[#FCF7DC]">Pay to UPI ID: </span>
                        <span className="font-mono font-bold select-all">{merchantUpiId}</span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-amber-700 dark:text-amber-300">
                        The UPI ID will be shared with you on WhatsApp after the order is placed.
                      </div>
                    )}
                    <div>
                      <label className="block font-bold text-gray-700 dark:text-stone-300 mb-1">
                        UPI Transaction / Reference ID (optional)
                      </label>
                      <input
                        type="text"
                        value={upiReference}
                        onChange={(e) => setUpiReference(e.target.value)}
                        placeholder="e.g. 4235XXXXXX21 (after paying)"
                        className="w-full p-2.5 rounded-xl border border-[#F3DDD5] dark:border-[#7A1921] bg-white dark:bg-[#3F070B] text-[#2B1810] dark:text-[#FCF7DC] focus:outline-hidden focus:ring-1 focus:ring-[#789A99]"
                      />
                    </div>
                    <p className="text-[10px] text-gray-500 dark:text-stone-400">
                      UPI payments are marked <strong>Pending Verification</strong> until our team confirms
                      receipt. No automatic payment confirmation is claimed.
                    </p>
                  </div>
                )}

                {paymentMethod === 'cod' && (
                  <div className="p-3 rounded-xl bg-[#FFF8F5] dark:bg-[#3F070B] border border-[#F3DDD5] dark:border-[#7A1921]">
                    <p className="text-[11px] text-gray-600 dark:text-stone-300">
                      Pay in cash to the courier when your package arrives. No advance payment required.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Order Error Banner */}
            {orderError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-300 text-xs">
                {orderError}
              </div>
            )}

            {/* Price Breakdown (estimates — final totals are computed server-side) */}
            <div className="pt-4 border-t border-[#F3DDD5] dark:border-[#7A1921] space-y-2 text-xs">
              <div className="flex justify-between text-gray-600 dark:text-stone-300">
                <span>Items Subtotal</span>
                <span>₹{subtotal}</span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-stone-300">
                <span>Estimated Courier Shipping</span>
                <span className={shippingCost === 0 ? 'text-emerald-600 font-bold' : ''}>
                  {shippingCost === 0 ? 'FREE' : `₹${shippingCost}`}
                </span>
              </div>
              <div className="flex justify-between text-sm font-extrabold text-[#2B1810] dark:text-[#FCF7DC] pt-2 border-t border-[#F3DDD5] dark:border-[#7A1921]">
                <span>Total Payable (estimated)</span>
                <span className="text-base text-[#789A99] dark:text-[#F1E194]">₹{grandTotal}</span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition shadow-md cursor-pointer disabled:opacity-50"
            >
              <MessageCircle className="w-4 h-4" />
              <span>{submitting ? 'Creating Order & Invoice...' : 'Confirm Order & Generate Invoice'}</span>
            </button>

            <div className="flex items-center justify-center gap-2 text-[11px] text-gray-500 dark:text-stone-400 text-center">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>100% Genuine Handcrafted &amp; Anti-Tarnish Jewelry</span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
