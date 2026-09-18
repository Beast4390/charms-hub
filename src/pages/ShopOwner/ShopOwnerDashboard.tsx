import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { storeCatalog } from '../../services/storeCatalog';
import { getAllOrders, updateOrderStatus, getInvoiceByOrderId } from '../../services/orderService';
import { downloadInvoicePDF } from '../../services/invoiceGenerator';
import { getStoreAppearance, updateStoreAppearance, resetStoreAppearance } from '../../services/appearanceService';
import { getActivityLogs } from '../../services/activityLogger';
import { ProductCard } from '../../components/ProductCard/ProductCard';
import { VERIFIED_CATEGORIES } from '../../data/categories';
import { Product, Order, Invoice, StoreAppearanceSettings, ActivityLog } from '../../types';
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Palette,
  Clock,
  RefreshCw,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Download,
  Eye,
  Sliders,
  Shield,
  Save,
  RotateCcw,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

export const ShopOwnerDashboard: React.FC = () => {
  const { user, isAuthenticated, switchRole } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'catalog' | 'orders' | 'appearance' | 'logs'>('catalog');
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [appearance, setAppearance] = useState<StoreAppearanceSettings>(() => getStoreAppearance());
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Edit / Add Product Modal state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [ragSyncing, setRagSyncing] = useState(false);

  // Form state for Add / Edit
  const [productForm, setProductForm] = useState<Partial<Product>>({
    name: '',
    category_id: 'earrings',
    category_name: 'Kashmiri Earrings',
    price: 250,
    mrp: 350,
    discount_percent: 28,
    image_url: '/products/earrings/green-kashmiri-jhumka.jpg',
    description: 'Handcrafted authentic Kashmiri jewelry with high grade finish.',
    in_stock: true,
    reference_verified: true,
    tags: ['kashmiri', 'handmade', 'earrings'],
  });

  useEffect(() => {
    if (!isAuthenticated || !user) {
      navigate('/auth/login');
      return;
    }
    if (user.role !== 'shop_owner' && user.role !== 'developer') {
      // Allow switching or view warning
    }
  }, [isAuthenticated, user, navigate]);

  const loadAllData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const allProds = storeCatalog.getProducts(true);
      setProducts(allProds);

      const allOrd = await getAllOrders(user);
      setOrders(allOrd);

      const actLogs = await getActivityLogs(user);
      setLogs(actLogs);

      setAppearance(getStoreAppearance());
    } catch (err) {
      console.error('Error loading shop owner data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [user]);

  const showStatus = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // Catalog Actions
  const handleToggleStock = (product: Product) => {
    const ok = storeCatalog.updateProductStock(product.id, !product.in_stock);
    if (ok) {
      setProducts(storeCatalog.getProducts(true));
      showStatus(`Stock status updated for ${product.name}`);
    }
  };

  const handleDeleteProduct = (product: Product) => {
    if (window.confirm(`Are you sure you want to remove "${product.name}" from the store catalog?`)) {
      const ok = storeCatalog.deleteProduct(product.id);
      if (ok) {
        setProducts(storeCatalog.getProducts(true));
        showStatus(`Product "${product.name}" deleted`);
      }
    }
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name || !productForm.price || !productForm.image_url) {
      showStatus('Please provide product name, price, and image URL', 'error');
      return;
    }

    if (editingProduct) {
      const updated = storeCatalog.updateProduct(editingProduct.id, productForm);
      if (updated) {
        setProducts(storeCatalog.getProducts(true));
        setEditingProduct(null);
        showStatus(`Product updated: ${updated.name}`);
      }
    } else {
      const slug = (productForm.name || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      const newProd = {
        name: productForm.name!,
        slug,
        category_id: productForm.category_id || 'earrings',
        category_name:
          VERIFIED_CATEGORIES.find((c) => c.id === productForm.category_id)?.name ||
          productForm.category_name ||
          'Accessories',
        price: Number(productForm.price),
        mrp: Number(productForm.mrp || productForm.price),
        discount_percent: productForm.mrp
          ? Math.round(((Number(productForm.mrp) - Number(productForm.price)) / Number(productForm.mrp)) * 100)
          : 0,
        image_url: productForm.image_url!,
        description: productForm.description || '',
        in_stock: productForm.in_stock ?? true,
        reference_verified: true as const,
        source: 'website' as const,
        tags: productForm.tags || ['charms-hub', 'verified'],
      };

      const created = storeCatalog.addProduct(newProd);
      setProducts(storeCatalog.getProducts(true));
      setIsAddModalOpen(false);
      showStatus(`New product added: ${created.name}`);
    }
  };

  const handleTriggerRagSync = async () => {
    setRagSyncing(true);
    try {
      const res = await storeCatalog.triggerRagSync();
      if (res.success) {
        showStatus(`RAG Synced: ${res.synced_products_count} verified items indexed for AI Chatbot`);
      }
    } catch {
      showStatus('RAG Sync encountered an error', 'error');
    } finally {
      setRagSyncing(false);
    }
  };

  // Order Actions
  const handleUpdateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    if (!user) return;
    const res = await updateOrderStatus(orderId, newStatus, user);
    if (res.success) {
      const updatedList = await getAllOrders(user);
      setOrders(updatedList);
      showStatus(`Order #${orderId.slice(0, 8)} status set to ${newStatus}`);
    } else {
      showStatus(res.error || 'Failed to update order status', 'error');
    }
  };

  const handleDownloadInvoice = async (orderId: string) => {
    if (!user) return;
    const inv = await getInvoiceByOrderId(orderId, user);
    if (inv) {
      downloadInvoicePDF(inv);
    } else {
      showStatus('Invoice not found for this order', 'error');
    }
  };

  // Appearance Actions
  const handleSaveAppearance = async () => {
    try {
      await updateStoreAppearance(appearance, user?.full_name || 'shop_owner');
      showStatus('Storefront design theme saved & published successfully!');
    } catch {
      showStatus('Failed to update appearance settings', 'error');
    }
  };

  const handleResetAppearance = async () => {
    if (window.confirm('Reset store appearance to official Charms Hub defaults?')) {
      const def = await resetStoreAppearance(user?.full_name || 'developer');
      setAppearance(def);
      showStatus('Appearance reset to official defaults');
    }
  };


  // Sample product for live preview
  const samplePreviewProduct: Product = products[0] || {
    id: 'preview-1',
    name: 'Teal Peacock Kashmiri Jhumka',
    price: 260,
    mrp: 350,
    discount_percent: 26,
    category_id: 'earrings',
    category_name: 'Kashmiri Earrings',
    image_url: '/products/earrings/teal-peacock-kashmiri-jhumka.jpg',
    description: 'Authentic Kashmiri earring handcrafted with enamel and glass beads.',
    in_stock: true,
    reference_verified: true,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-white dark:bg-[#5B0E14] border border-[#F3DDD5] dark:border-[#7A1921] shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[#FFD2C2] dark:bg-[#7A1921] text-[#E91E63] dark:text-[#F1E194]">
              <LayoutDashboard className="w-5 h-5" />
            </span>
            <h1 className="font-serif-display text-2xl sm:text-3xl font-bold text-[#2B1810] dark:text-[#FCF7DC]">
              Shop Owner Dashboard
            </h1>
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#E91E63] text-white">
              Privileged
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-stone-300 mt-1">
            Manage your verified catalog, process customer orders, customize storefront appearance, and inspect RAG sync.
          </p>
        </div>

        {/* Quick Actions & Role indicator */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleTriggerRagSync}
            disabled={ragSyncing}
            className="px-4 py-2 rounded-xl bg-[#FFF8F5] dark:bg-[#3F070B] border border-[#F3DDD5] dark:border-[#7A1921] text-[#2B1810] dark:text-[#FCF7DC] text-xs font-bold flex items-center gap-1.5 hover:border-[#789A99] transition cursor-pointer disabled:opacity-50"
            title="Synchronize Catalog with AI Assistant"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#789A99] ${ragSyncing ? 'animate-spin' : ''}`} />
            <span>{ragSyncing ? 'Syncing RAG...' : 'Sync AI Catalog'}</span>
          </button>

          <Link
            to="/products"
            className="px-4 py-2 rounded-xl bg-[#789A99] hover:bg-[#587978] text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Live Storefront</span>
          </Link>
        </div>
      </div>

      {/* Role Notice & Switcher if role not shop_owner */}
      {user?.role !== 'shop_owner' && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
            <AlertCircle className="w-4 h-4" />
            <span>
              You are currently logged in as <strong>{user?.role}</strong>. Switch to <strong>Shop Owner</strong> for full operational capabilities.
            </span>
          </div>
          <button
            onClick={() => switchRole('shop_owner')}
            className="px-3 py-1 rounded-xl bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 cursor-pointer"
          >
            Switch to Shop Owner
          </button>
        </div>
      )}

      {/* Status Alert */}
      {statusMessage && (
        <div
          className={`p-4 rounded-2xl text-xs flex items-center gap-2 ${
            statusMessage.type === 'error'
              ? 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/60 dark:text-red-300'
              : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300'
          }`}
        >
          {statusMessage.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex border-b border-[#F3DDD5] dark:border-[#7A1921] space-x-2 sm:space-x-4 overflow-x-auto">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition cursor-pointer whitespace-nowrap ${
            activeTab === 'catalog'
              ? 'border-[#789A99] text-[#789A99] dark:text-[#F1E194] dark:border-[#F1E194]'
              : 'border-transparent text-gray-500 hover:text-[#2B1810] dark:text-stone-400'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Product Catalog ({products.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition cursor-pointer whitespace-nowrap ${
            activeTab === 'orders'
              ? 'border-[#789A99] text-[#789A99] dark:text-[#F1E194] dark:border-[#F1E194]'
              : 'border-transparent text-gray-500 hover:text-[#2B1810] dark:text-stone-400'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Orders &amp; Invoices ({orders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('appearance')}
          className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition cursor-pointer whitespace-nowrap ${
            activeTab === 'appearance'
              ? 'border-[#789A99] text-[#789A99] dark:text-[#F1E194] dark:border-[#F1E194]'
              : 'border-transparent text-gray-500 hover:text-[#2B1810] dark:text-stone-400'
          }`}
        >
          <Palette className="w-4 h-4" />
          <span>Store Appearance</span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition cursor-pointer whitespace-nowrap ${
            activeTab === 'logs'
              ? 'border-[#789A99] text-[#789A99] dark:text-[#F1E194] dark:border-[#F1E194]'
              : 'border-transparent text-gray-500 hover:text-[#2B1810] dark:text-stone-400'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Audit Logs ({logs.length})</span>
        </button>
      </div>

      {/* TAB 1: PRODUCT CATALOG */}
      {activeTab === 'catalog' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-serif-display text-lg sm:text-xl font-bold text-[#2B1810] dark:text-[#FCF7DC]">
                Store Product Catalog
              </h2>
              <p className="text-xs text-gray-500 dark:text-stone-400">
                Live products with verified reference photos and real-time inventory controls.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingProduct(null);
                setProductForm({
                  name: '',
                  category_id: 'earrings',
                  category_name: 'Kashmiri Earrings',
                  price: 250,
                  mrp: 350,
                  image_url: '/products/earrings/green-kashmiri-jhumka.jpg',
                  description: 'Authentic handcrafted Kashmiri jewelry.',
                  in_stock: true,
                  reference_verified: true,
                });
                setIsAddModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-[#789A99] hover:bg-[#587978] text-white font-bold text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Verified Product</span>
            </button>
          </div>

          {/* Product Table */}
          <div className="bg-white dark:bg-[#5B0E14] rounded-2xl border border-[#F3DDD5] dark:border-[#7A1921] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#FFF8F5] dark:bg-[#3F070B] border-b border-[#F3DDD5] dark:border-[#7A1921] text-[#2B1810] dark:text-[#FCF7DC]">
                    <th className="p-3 font-bold">Product</th>
                    <th className="p-3 font-bold">Category</th>
                    <th className="p-3 font-bold">Price / MRP</th>
                    <th className="p-3 font-bold">Stock Status</th>
                    <th className="p-3 font-bold">Verification</th>
                    <th className="p-3 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3DDD5] dark:divide-[#7A1921]/60">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-stone-50 dark:hover:bg-[#7A1921]/40 transition">
                      <td className="p-3 flex items-center gap-3">
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="w-12 h-12 object-cover rounded-lg border border-[#F3DDD5] dark:border-[#7A1921] shrink-0"
                        />
                        <div>
                          <p className="font-bold text-[#2B1810] dark:text-[#FCF7DC] line-clamp-1">
                            {p.name}
                          </p>
                          <p className="text-[10px] text-gray-400 font-mono">ID: {p.id}</p>
                        </div>
                      </td>
                      <td className="p-3 text-gray-600 dark:text-stone-300">{p.category_name}</td>
                      <td className="p-3 font-bold text-[#2B1810] dark:text-[#F1E194]">
                        ₹{p.price}{' '}
                        {p.mrp && p.mrp > p.price && (
                          <span className="text-[10px] text-gray-400 line-through">₹{p.mrp}</span>
                        )}
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => handleToggleStock(p)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer transition ${
                            p.in_stock
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          }`}
                        >
                          {p.in_stock ? 'In Stock' : 'Out of Stock'}
                        </button>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300 text-[10px] font-bold border border-teal-200 dark:border-teal-800">
                          {p.reference_verified ? 'Verified Photo' : 'Unverified'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setEditingProduct(p);
                              setProductForm(p);
                              setIsAddModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg border border-[#F3DDD5] dark:border-[#7A1921] hover:bg-[#FFD2C2]/40 transition text-gray-600 dark:text-stone-300 cursor-pointer"
                            title="Edit Product"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(p)}
                            className="p-1.5 rounded-lg border border-red-200 hover:bg-red-50 dark:hover:bg-red-950 text-red-500 transition cursor-pointer"
                            title="Delete Product"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ORDERS & INVOICES */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-serif-display text-lg sm:text-xl font-bold text-[#2B1810] dark:text-[#FCF7DC]">
                Customer Orders &amp; Invoices
              </h2>
              <p className="text-xs text-gray-500 dark:text-stone-400">
                View orders, update fulfillment status, and download tax invoices.
              </p>
            </div>
          </div>

          {orders.length === 0 ? (
            <div className="p-12 rounded-3xl bg-white dark:bg-[#5B0E14] border border-[#F3DDD5] dark:border-[#7A1921] text-center space-y-2">
              <ShoppingBag className="w-8 h-8 text-gray-400 mx-auto" />
              <p className="font-bold text-sm text-[#2B1810] dark:text-[#FCF7DC]">No customer orders yet</p>
              <p className="text-xs text-gray-500">Orders placed through the storefront or WhatsApp will appear here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((o) => (
                <div
                  key={o.id}
                  className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#5B0E14] border border-[#F3DDD5] dark:border-[#7A1921] shadow-xs space-y-4 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#F3DDD5] dark:border-[#7A1921]/60">
                    <div>
                      <span className="font-bold text-sm text-[#2B1810] dark:text-[#FCF7DC]">
                        Order #{o.order_number}
                      </span>
                      <p className="text-[11px] text-gray-500">
                        {new Date(o.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Status Dropdown */}
                      <select
                        value={o.status}
                        onChange={(e) => handleUpdateOrderStatus(o.id, e.target.value as Order['status'])}
                        className="px-3 py-1.5 rounded-xl border border-[#F3DDD5] dark:border-[#7A1921] bg-[#FFF8F5] dark:bg-[#3F070B] font-bold text-xs text-[#2B1810] dark:text-[#FCF7DC]"
                      >
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="processing">Processing</option>
                        <option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>

                      <button
                        onClick={() => handleDownloadInvoice(o.id)}
                        className="px-3 py-1.5 rounded-xl bg-[#789A99] hover:bg-[#587978] text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>PDF Invoice</span>
                      </button>
                    </div>
                  </div>

                  {/* Customer Info & Items */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="font-bold text-[#2B1810] dark:text-[#FCF7DC]">Customer Information:</p>
                      <p className="text-gray-600 dark:text-stone-300">Name: {o.customer_name || 'Customer'}</p>
                      <p className="text-gray-600 dark:text-stone-300">Email: {o.customer_email || 'N/A'}</p>
                      <p className="text-gray-600 dark:text-stone-300">Phone: {o.shipping_details?.phone || 'N/A'}</p>
                      {o.shipping_details?.landmark && (
                        <p className="text-pink-600 font-bold">{o.shipping_details.landmark}</p>
                      )}
                      {o.shipping_details && (
                        <p className="text-gray-500 mt-1">
                          Address: {o.shipping_details.street}, {o.shipping_details.city} - {o.shipping_details.pincode}
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="font-bold text-[#2B1810] dark:text-[#FCF7DC] mb-1">Purchased Items:</p>
                      <div className="space-y-1.5">
                        {o.items.map((item, i) => (
                          <div key={i} className="flex justify-between text-gray-600 dark:text-stone-300">
                            <span>
                              {item.product_name_snapshot} &times; {item.quantity}
                            </span>
                            <span className="font-bold">₹{item.line_total || item.unit_price * item.quantity}</span>
                          </div>
                        ))}
                        <div className="pt-2 border-t border-[#F3DDD5] dark:border-[#7A1921] flex justify-between font-bold text-[#2B1810] dark:text-[#FCF7DC]">
                          <span>Grand Total (incl. shipping)</span>
                          <span className="text-sm text-[#789A99] dark:text-[#F1E194]">₹{o.total_amount}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: STORE APPEARANCE CUSTOMIZER */}
      {activeTab === 'appearance' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Controls column */}
          <div className="lg:col-span-2 space-y-6">
            <div className="p-6 rounded-3xl bg-white dark:bg-[#5B0E14] border border-[#F3DDD5] dark:border-[#7A1921] shadow-xs space-y-6">
              <div>
                <h2 className="font-serif-display text-xl font-bold text-[#2B1810] dark:text-[#FCF7DC]">
                  Storefront Design System &amp; Tokens
                </h2>
                <p className="text-xs text-gray-500 dark:text-stone-400 mt-0.5">
                  Customize card surfaces, borders, shadows, corner radii, and button styles. Changes apply site-wide immediately upon saving.
                </p>
              </div>

              {/* Card Background */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#2B1810] dark:text-[#FCF7DC]">
                  Card Background Surface
                </label>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {[
                    { id: 'white', label: 'Clean White' },
                    { id: 'cream', label: 'Warm Cream (#FDF6F0)' },
                    { id: 'framed', label: 'Framed Tint' },
                  ].map((bg) => (
                    <button
                      key={bg.id}
                      type="button"
                      onClick={() => setAppearance({ ...appearance, card_bg: bg.id as any })}
                      className={`p-2.5 rounded-xl border font-bold text-center transition cursor-pointer ${
                        appearance.card_bg === bg.id
                          ? 'border-[#789A99] bg-[#789A99]/10 text-[#789A99] dark:text-[#F1E194]'
                          : 'border-[#F3DDD5] dark:border-[#7A1921] text-gray-600 dark:text-stone-300'
                      }`}
                    >
                      {bg.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Card Border */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#2B1810] dark:text-[#FCF7DC]">
                  Card Border Style
                </label>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {[
                    { id: 'none', label: 'No Border' },
                    { id: 'border', label: 'Subtle 1px Border' },
                    { id: 'border-2', label: 'Thick 2px Accent' },
                  ].map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setAppearance({ ...appearance, card_border: b.id as any })}
                      className={`p-2.5 rounded-xl border font-bold text-center transition cursor-pointer ${
                        appearance.card_border === b.id
                          ? 'border-[#789A99] bg-[#789A99]/10 text-[#789A99] dark:text-[#F1E194]'
                          : 'border-[#F3DDD5] dark:border-[#7A1921] text-gray-600 dark:text-stone-300'
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Card Corner Radius */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#2B1810] dark:text-[#FCF7DC]">
                  Card Corner Radius
                </label>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  {[
                    { id: 'rounded-none', label: 'Square (0px)' },
                    { id: 'rounded-xl', label: 'Soft (12px)' },
                    { id: 'rounded-2xl', label: 'Modern (16px)' },
                    { id: 'rounded-3xl', label: 'Playful (24px)' },
                  ].map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setAppearance({ ...appearance, card_radius: r.id as any })}
                      className={`p-2 rounded-xl border font-bold text-center transition cursor-pointer ${
                        appearance.card_radius === r.id
                          ? 'border-[#789A99] bg-[#789A99]/10 text-[#789A99] dark:text-[#F1E194]'
                          : 'border-[#F3DDD5] dark:border-[#7A1921] text-gray-600 dark:text-stone-300'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Shadow Intensity */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#2B1810] dark:text-[#FCF7DC]">
                  Elevation &amp; Shadow
                </label>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {[
                    { id: 'shadow-xs', label: 'Gentle Flat (xs)' },
                    { id: 'shadow-md', label: 'Medium Depth (md)' },
                    { id: 'shadow-xl', label: 'Floating (xl)' },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setAppearance({ ...appearance, card_shadow: s.id as any })}
                      className={`p-2.5 rounded-xl border font-bold text-center transition cursor-pointer ${
                        appearance.card_shadow === s.id
                          ? 'border-[#789A99] bg-[#789A99]/10 text-[#789A99] dark:text-[#F1E194]'
                          : 'border-[#F3DDD5] dark:border-[#7A1921] text-gray-600 dark:text-stone-300'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Button Style & Density */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-[#2B1810] dark:text-[#FCF7DC]">
                    Action Button Shape
                  </label>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {[
                      { id: 'rounded', label: 'Rounded' },
                      { id: 'pill', label: 'Pill' },
                      { id: 'outline', label: 'Outline' },
                    ].map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setAppearance({ ...appearance, button_style: b.id as any })}
                        className={`p-2 rounded-xl border font-bold text-center transition cursor-pointer ${
                          appearance.button_style === b.id
                            ? 'border-[#789A99] bg-[#789A99]/10 text-[#789A99] dark:text-[#F1E194]'
                            : 'border-[#F3DDD5] dark:border-[#7A1921] text-gray-600 dark:text-stone-300'
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-[#2B1810] dark:text-[#FCF7DC]">
                    Card Content Density
                  </label>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {[
                      { id: 'compact', label: 'Compact' },
                      { id: 'normal', label: 'Standard' },
                      { id: 'spacious', label: 'Spacious' },
                    ].map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setAppearance({ ...appearance, card_density: d.id as any })}
                        className={`p-2 rounded-xl border font-bold text-center transition cursor-pointer ${
                          appearance.card_density === d.id
                            ? 'border-[#789A99] bg-[#789A99]/10 text-[#789A99] dark:text-[#F1E194]'
                            : 'border-[#F3DDD5] dark:border-[#7A1921] text-gray-600 dark:text-stone-300'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-4 border-t border-[#F3DDD5] dark:border-[#7A1921]">
                <button
                  type="button"
                  onClick={handleSaveAppearance}
                  className="px-6 py-2.5 rounded-xl bg-[#789A99] hover:bg-[#587978] text-white font-bold text-xs flex items-center gap-2 transition shadow-md cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Publish Appearance Changes</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetAppearance}
                  className="px-4 py-2.5 rounded-xl border border-[#F3DDD5] dark:border-[#7A1921] hover:bg-stone-50 dark:hover:bg-[#7A1921] text-[#2B1810] dark:text-[#FCF7DC] font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset to Defaults</span>
                </button>
              </div>
            </div>
          </div>

          {/* Live Interactive Preview */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#2B1810] dark:text-[#FCF7DC]">
              <Sparkles className="w-4 h-4 text-[#789A99] dark:text-[#F1E194]" />
              <span>Live Card Preview</span>
            </div>
            <div className="p-4 rounded-3xl bg-[#FFF8F5] dark:bg-[#3F070B] border border-[#F3DDD5] dark:border-[#7A1921]">
              <ProductCard product={samplePreviewProduct} appearanceOverride={appearance} />
            </div>
            <p className="text-[11px] text-gray-400 text-center">
              This card reflects your selected tokens live. Save above to apply across the entire shop.
            </p>
          </div>
        </div>
      )}

      {/* TAB 4: AUDIT LOGS */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif-display text-lg font-bold text-[#2B1810] dark:text-[#FCF7DC]">
              Store Security &amp; Activity Audit Logs
            </h2>
            <span className="text-xs text-gray-400">Total Entries: {logs.length}</span>
          </div>

          <div className="bg-white dark:bg-[#5B0E14] rounded-2xl border border-[#F3DDD5] dark:border-[#7A1921] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#FFF8F5] dark:bg-[#3F070B] border-b border-[#F3DDD5] dark:border-[#7A1921] text-[#2B1810] dark:text-[#FCF7DC]">
                    <th className="p-3 font-bold">Timestamp</th>
                    <th className="p-3 font-bold">Event Type</th>
                    <th className="p-3 font-bold">User Role</th>
                    <th className="p-3 font-bold">Entity</th>
                    <th className="p-3 font-bold">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3DDD5] dark:divide-[#7A1921]/60">
                  {logs.slice(0, 50).map((l) => (
                    <tr key={l.id} className="hover:bg-stone-50 dark:hover:bg-[#7A1921]/40">
                      <td className="p-3 font-mono text-gray-400 text-[11px]">
                        {new Date(l.created_at).toLocaleTimeString('en-IN')}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full font-bold bg-[#FFD2C2]/40 text-[#2B1810] dark:bg-[#7A1921] dark:text-[#F1E194]">
                          {l.event_type}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-[#789A99] dark:text-[#F1E194]">{l.role}</td>
                      <td className="p-3 text-gray-600 dark:text-stone-300">
                        {l.entity_type} ({l.entity_id?.slice(0, 8)})
                      </td>
                      <td className="p-3 text-gray-500 font-mono text-[11px]">
                        {l.metadata ? JSON.stringify(l.metadata).slice(0, 60) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-lg bg-white dark:bg-[#5B0E14] rounded-3xl border border-[#F3DDD5] dark:border-[#7A1921] p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#F3DDD5] dark:border-[#7A1921]">
              <h3 className="font-serif-display text-lg font-bold text-[#2B1810] dark:text-[#FCF7DC]">
                {editingProduct ? 'Edit Product' : 'Add New Verified Product'}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-base font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div>
                <label className="block font-bold text-gray-700 dark:text-stone-300 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={productForm.name || ''}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  placeholder="e.g. Royal Kashmiri Emerald Earring"
                  className="w-full p-2.5 rounded-xl border border-[#F3DDD5] dark:border-[#7A1921] bg-[#FFF8F5] dark:bg-[#3F070B] text-[#2B1810] dark:text-[#FCF7DC]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-stone-300 mb-1">
                    Selling Price (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    value={productForm.price || ''}
                    onChange={(e) => setProductForm({ ...productForm, price: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-[#F3DDD5] dark:border-[#7A1921] bg-[#FFF8F5] dark:bg-[#3F070B] text-[#2B1810] dark:text-[#FCF7DC]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 dark:text-stone-300 mb-1">
                    MRP (₹)
                  </label>
                  <input
                    type="number"
                    value={productForm.mrp || ''}
                    onChange={(e) => setProductForm({ ...productForm, mrp: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-[#F3DDD5] dark:border-[#7A1921] bg-[#FFF8F5] dark:bg-[#3F070B] text-[#2B1810] dark:text-[#FCF7DC]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-stone-300 mb-1">
                  Category *
                </label>
                <select
                  value={productForm.category_id || 'earrings'}
                  onChange={(e) => {
                    const cat = VERIFIED_CATEGORIES.find((c) => c.id === e.target.value);
                    setProductForm({
                      ...productForm,
                      category_id: e.target.value,
                      category_name: cat?.name || 'Accessories',
                    });
                  }}
                  className="w-full p-2.5 rounded-xl border border-[#F3DDD5] dark:border-[#7A1921] bg-[#FFF8F5] dark:bg-[#3F070B] text-[#2B1810] dark:text-[#FCF7DC]"
                >
                  {VERIFIED_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-stone-300 mb-1">
                  Verified Image URL *
                </label>
                <input
                  type="text"
                  required
                  value={productForm.image_url || ''}
                  onChange={(e) => setProductForm({ ...productForm, image_url: e.target.value })}
                  placeholder="/products/earrings/... or https://..."
                  className="w-full p-2.5 rounded-xl border border-[#F3DDD5] dark:border-[#7A1921] bg-[#FFF8F5] dark:bg-[#3F070B] text-[#2B1810] dark:text-[#FCF7DC]"
                />
                <span className="text-[10px] text-gray-400 mt-1 block">
                  PRIMARY RULE: The image MUST correspond authentically to the named product.
                </span>
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-stone-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={productForm.description || ''}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-[#F3DDD5] dark:border-[#7A1921] bg-[#FFF8F5] dark:bg-[#3F070B] text-[#2B1810] dark:text-[#FCF7DC]"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="stockCheck"
                  checked={productForm.in_stock ?? true}
                  onChange={(e) => setProductForm({ ...productForm, in_stock: e.target.checked })}
                  className="w-4 h-4 rounded text-[#789A99]"
                />
                <label htmlFor="stockCheck" className="font-bold text-gray-700 dark:text-stone-300">
                  Product is In Stock &amp; Available
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F3DDD5] dark:border-[#7A1921]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#F3DDD5] dark:border-[#7A1921] text-gray-500 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#789A99] hover:bg-[#587978] text-white font-bold cursor-pointer"
                >
                  {editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
