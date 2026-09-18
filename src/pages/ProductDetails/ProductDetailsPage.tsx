import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { VERIFIED_PRODUCTS } from '../../data/verifiedProducts';
import { storeCatalog } from '../../services/storeCatalog';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { ProductCard } from '../../components/ProductCard/ProductCard';
import {
  ShoppingBag,
  MessageCircle,
  ShieldCheck,
  Truck,
  RotateCcw,
  Sparkles,
  ChevronRight,
  Plus,
  Minus,
  CheckCircle2,
  Instagram,
  ImageOff,
  ExternalLink,
} from 'lucide-react';

export const ProductDetailsPage: React.FC = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { isAuthenticated, setPendingAction } = useAuth();
  const [quantity, setQuantity] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'desc' | 'care' | 'shipping'>('desc');
  const [addedBanner, setAddedBanner] = useState(false);
  const [imageError, setImageError] = useState(false);

  const [product, setProduct] = useState(() =>
    storeCatalog.getProductById(productId || '') || VERIFIED_PRODUCTS.find((p) => p.id === productId)
  );
  const [catalogStatus, setCatalogStatus] = useState(() => storeCatalog.getCatalogStatus());

  useEffect(() => {
    const updateProductData = () => {
      const p = storeCatalog.getProductById(productId || '') || VERIFIED_PRODUCTS.find((item) => item.id === productId);
      setProduct(p);
      setCatalogStatus(storeCatalog.getCatalogStatus());
    };
    updateProductData();
    void storeCatalog.ensureLoaded().finally(updateProductData);
    window.addEventListener('charms_hub_catalog_changed', updateProductData);
    return () => window.removeEventListener('charms_hub_catalog_changed', updateProductData);
  }, [productId]);

  const [activeImage, setActiveImage] = useState<string>(product?.image_url || '');

  useEffect(() => {
    if (product) {
      setActiveImage(product.image_url || '');
      setImageError(false);
      setQuantity(1);
    }
  }, [product]);

  if (!product) {
    if (catalogStatus.loading) {
      return (
        <div className="max-w-3xl mx-auto px-4 py-24 text-center space-y-4">
          <span className="inline-block w-3 h-3 rounded-full bg-[#789A99] dark:bg-[#F1E194] animate-ping" />
          <p className="text-xs font-semibold text-gray-500 dark:text-stone-400">
            Checking the verified catalog…
          </p>
        </div>
      );
    }
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center space-y-4">
        <h2 className="font-serif-display text-2xl font-bold text-[#2B1810] dark:text-[#FCF7DC]">
          Product Not Found
        </h2>
        <p className="text-sm text-gray-500 dark:text-stone-300">
          The item you are looking for does not exist or has been removed from our verified catalog.
        </p>
        <Link
          to="/products"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#789A99] text-white font-bold text-xs hover:bg-[#587978] transition"
        >
          Explore All Products
        </Link>
      </div>
    );
  }

  const allGalleryImages = [
    ...(product.image_url ? [product.image_url] : []),
    ...(product.additional_images || [])
  ];

  const isImageValid = Boolean(product.reference_verified && activeImage && !imageError);

  const allProducts = storeCatalog.getProducts(false);
  const relatedProducts = allProducts.filter(
    (p) => p.category_id === product.category_id && p.id !== product.id
  ).slice(0, 4);

  const handleAddToCart = () => {
    if (!product.in_stock) return;

    if (!isAuthenticated) {
      setPendingAction({
        action: 'add_to_cart',
        productId: product.id,
        quantity,
        returnUrl: window.location.pathname,
        timestamp: Date.now(),
      });
      navigate(`/auth/login?redirect=${encodeURIComponent(window.location.pathname)}&action=add_to_cart&product=${product.id}`);
      return;
    }

    addToCart(product, quantity);
    setAddedBanner(true);
    setTimeout(() => setAddedBanner(false), 3000);
  };

  const handleBuyNow = () => {
    if (!product.in_stock) return;

    if (!isAuthenticated) {
      setPendingAction({
        action: 'buy_now',
        productId: product.id,
        quantity,
        returnUrl: window.location.pathname,
        timestamp: Date.now(),
      });
      navigate(`/auth/login?redirect=${encodeURIComponent('/cart')}&action=buy_now&product=${product.id}`);
      return;
    }

    addToCart(product, quantity);
    navigate('/cart');
  };

  const handleWhatsAppInquiry = () => {
    const text = encodeURIComponent(
      `Hello Charms Hub! I want to inquire about purchasing:\n\n*${product.name}*\nPrice: ₹${product.price} (Qty: ${quantity})\nProduct Link: ${window.location.href}`
    );
    window.open(`https://wa.me/919876543210?text=${text}`, '_blank');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-10">
      
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs text-gray-500 dark:text-stone-400">
        <Link to="/" className="hover:text-[#789A99] dark:hover:text-[#F1E194]">
          Home
        </Link>
        <ChevronRight className="w-3 h-3" />
        <Link to="/products" className="hover:text-[#789A99] dark:hover:text-[#F1E194]">
          Products
        </Link>
        {product.category_name && (
          <>
            <ChevronRight className="w-3 h-3" />
            <Link
              to={`/products?category=${product.category_id.replace('cat-', '')}`}
              className="hover:text-[#789A99] dark:hover:text-[#F1E194]"
            >
              {product.category_name}
            </Link>
          </>
        )}
        <ChevronRight className="w-3 h-3" />
        <span className="text-[#2B1810] dark:text-[#FCF7DC] font-semibold truncate max-w-[180px] sm:max-w-xs">
          {product.name}
        </span>
      </nav>

      {/* Main Product Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 items-start">
        
        {/* Left: Product Image & Gallery */}
        <div className="space-y-4">
          <div className="relative rounded-3xl overflow-hidden bg-[#FFF1EC] dark:bg-[#3F070B] border border-[#F3DDD5] dark:border-[#7A1921] shadow-lg aspect-square">
            {isImageValid ? (
              <img
                src={activeImage}
                alt={product.name}
                className="w-full h-full object-cover transition-all duration-300"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-[#FDF4EE] dark:bg-[#4D0B11]">
                <ImageOff className="w-12 h-12 text-stone-400 dark:text-stone-500 mb-2" />
                <span className="text-sm font-bold text-stone-700 dark:text-stone-200">
                  Product image unavailable
                </span>
                <span className="text-xs text-stone-400 dark:text-stone-400 mt-1 max-w-xs">
                  This product has not yet been matched to an official Charms Hub verified image asset.
                </span>
              </div>
            )}

            {!product.in_stock && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-10">
                <span className="bg-[#D32F2F] text-white text-sm font-bold uppercase tracking-wider px-4 py-2 rounded-full shadow-lg">
                  Currently Out of Stock
                </span>
              </div>
            )}

            {/* Video packaging alert badge */}
            <div className="absolute top-4 left-4 bg-white/95 dark:bg-[#5B0E14]/95 backdrop-blur-xs px-3 py-1.5 rounded-full text-[11px] font-bold text-[#C2185B] dark:text-[#F1E194] shadow-xs flex items-center gap-1.5 z-10">
              <Instagram className="w-3.5 h-3.5 text-pink-600" />
              <span>Order packaging featured on Instagram</span>
            </div>
          </div>

          {/* Gallery Thumbnails */}
          {allGalleryImages.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {allGalleryImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setActiveImage(img);
                    setImageError(false);
                  }}
                  className={`relative w-16 h-16 rounded-xl overflow-hidden border-2 transition shrink-0 ${
                    activeImage === img
                      ? 'border-[#789A99] dark:border-[#F1E194] shadow-md'
                      : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt={`${product.name} thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Verification Status */}
          <div className="flex items-center justify-between text-xs px-3 py-2 rounded-xl bg-stone-50 dark:bg-[#4D0B11] border border-stone-200/60 dark:border-[#7A1921]">
            <div className="flex items-center gap-1.5 text-stone-600 dark:text-stone-300">
              <ShieldCheck className={`w-4 h-4 ${product.reference_verified ? 'text-emerald-500' : 'text-amber-500'}`} />
              <span className="font-medium">
                {product.reference_verified ? 'Verified Charms Hub Reference' : 'Image Pending Reference Check'}
              </span>
            </div>
            {product.source && (
              <span className="text-[11px] text-stone-400 dark:text-stone-400">
                Source: {product.source.replace('https://', '')}
              </span>
            )}
          </div>
        </div>

        {/* Right: Product Details & Purchase Actions */}
        <div className="space-y-6">
          <div>
            {product.category_name && (
              <span className="text-xs uppercase font-extrabold tracking-widest text-[#789A99] dark:text-[#E3D1AC]">
                {product.category_name}
              </span>
            )}
            <h1 className="font-serif-display text-2xl sm:text-3xl lg:text-4xl font-bold text-[#2B1810] dark:text-[#FCF7DC] mt-1">
              {product.name}
            </h1>
          </div>

          {/* Pricing Row */}
          <div className="flex items-baseline gap-3 p-4 rounded-2xl bg-[#FFF8F5] dark:bg-[#5B0E14] border border-[#F3DDD5] dark:border-[#7A1921]">
            <span className="text-3xl font-extrabold text-[#2B1810] dark:text-[#F1E194]">
              ₹{product.price}
            </span>
            {product.mrp && product.mrp > product.price && (
              <span className="text-base text-gray-400 line-through">
                ₹{product.mrp}
              </span>
            )}
            {product.discount_percent && product.discount_percent > 0 && (
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
                {product.discount_percent}% OFF
              </span>
            )}
          </div>

          {/* Tags */}
          {product.tags && product.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {product.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="text-[11px] font-semibold bg-[#FFD2C2]/40 dark:bg-[#7A1921] text-[#2B1810] dark:text-[#FCF7DC] px-2.5 py-1 rounded-full border border-[#F3DDD5] dark:border-[#8F1F28]"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Stock Status */}
          <div className="flex items-center gap-2 text-xs font-semibold">
            {product.in_stock ? (
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                In Stock &amp; Ready to Ship (Dispatched within 24-48 Hours)
              </span>
            ) : (
              <span className="text-red-500 font-bold">
                Currently Out of Stock. Inquire on WhatsApp for restocking dates!
              </span>
            )}
          </div>

          {/* Quantity Controls & Action Buttons */}
          {product.in_stock && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-4">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-stone-300">
                  Quantity:
                </span>
                <div className="flex items-center border border-[#F3DDD5] dark:border-[#7A1921] rounded-xl overflow-hidden bg-white dark:bg-[#3F070B]">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="p-2 hover:bg-[#FFD2C2]/40 dark:hover:bg-[#7A1921] transition"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-4 h-4 text-gray-600 dark:text-stone-300" />
                  </button>
                  <span className="px-4 text-sm font-bold text-[#2B1810] dark:text-[#FCF7DC]">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="p-2 hover:bg-[#FFD2C2]/40 dark:hover:bg-[#7A1921] transition"
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-4 h-4 text-gray-600 dark:text-stone-300" />
                  </button>
                </div>
              </div>

              {/* Added to cart toast alert */}
              {addedBanner && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Added {quantity} item(s) to your shopping bag!</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  onClick={handleAddToCart}
                  className="w-full py-3.5 px-4 rounded-xl bg-[#FFD2C2] hover:bg-[#F5B8A3] dark:bg-[#7A1921] dark:hover:bg-[#8F1F28] text-[#2B1810] dark:text-[#F1E194] font-bold text-sm flex items-center justify-center gap-2 transition shadow-xs cursor-pointer"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Add to Bag</span>
                </button>

                <button
                  onClick={handleBuyNow}
                  className="w-full py-3.5 px-4 rounded-xl bg-[#789A99] hover:bg-[#587978] dark:bg-[#F1E194] dark:hover:bg-[#E3D1AC] text-white dark:text-[#3F070B] font-bold text-sm flex items-center justify-center gap-2 transition shadow-md cursor-pointer"
                >
                  <span>Buy Now</span>
                </button>
              </div>

              {/* WhatsApp direct order */}
              <button
                onClick={handleWhatsAppInquiry}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-xs cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Order or Inquire Directly via WhatsApp</span>
              </button>
            </div>
          )}

          {/* Store Highlights Icons */}
          <div className="grid grid-cols-3 gap-2 pt-4 border-t border-[#F3DDD5] dark:border-[#7A1921] text-center">
            <div className="p-2.5 rounded-xl bg-[#FFF8F5] dark:bg-[#5B0E14]">
              <Truck className="w-4 h-4 text-[#789A99] dark:text-[#F1E194] mx-auto mb-1" />
              <span className="text-[11px] font-bold text-[#2B1810] dark:text-[#FCF7DC] block">
                Free Delivery
              </span>
              <span className="text-[10px] text-gray-500 dark:text-stone-400">
                Above ₹499
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#FFF8F5] dark:bg-[#5B0E14]">
              <ShieldCheck className="w-4 h-4 text-[#789A99] dark:text-[#F1E194] mx-auto mb-1" />
              <span className="text-[11px] font-bold text-[#2B1810] dark:text-[#FCF7DC] block">
                Anti-Tarnish
              </span>
              <span className="text-[10px] text-gray-500 dark:text-stone-400">
                Water Resistant
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#FFF8F5] dark:bg-[#5B0E14]">
              <RotateCcw className="w-4 h-4 text-[#789A99] dark:text-[#F1E194] mx-auto mb-1" />
              <span className="text-[11px] font-bold text-[#2B1810] dark:text-[#FCF7DC] block">
                Live Packaging
              </span>
              <span className="text-[10px] text-gray-500 dark:text-stone-400">
                Instagram Stories
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Product Information Tabs */}
      <div className="pt-8 border-t border-[#F3DDD5] dark:border-[#7A1921]">
        <div className="flex border-b border-[#F3DDD5] dark:border-[#7A1921] space-x-6">
          <button
            onClick={() => setActiveTab('desc')}
            className={`pb-3 text-sm font-bold transition border-b-2 ${
              activeTab === 'desc'
                ? 'border-[#789A99] text-[#789A99] dark:border-[#F1E194] dark:text-[#F1E194]'
                : 'border-transparent text-gray-500 dark:text-stone-400 hover:text-[#2B1810]'
            }`}
          >
            Description &amp; Specifications
          </button>
          <button
            onClick={() => setActiveTab('care')}
            className={`pb-3 text-sm font-bold transition border-b-2 ${
              activeTab === 'care'
                ? 'border-[#789A99] text-[#789A99] dark:border-[#F1E194] dark:text-[#F1E194]'
                : 'border-transparent text-gray-500 dark:text-stone-400 hover:text-[#2B1810]'
            }`}
          >
            Care Instructions
          </button>
          <button
            onClick={() => setActiveTab('shipping')}
            className={`pb-3 text-sm font-bold transition border-b-2 ${
              activeTab === 'shipping'
                ? 'border-[#789A99] text-[#789A99] dark:border-[#F1E194] dark:text-[#F1E194]'
                : 'border-transparent text-gray-500 dark:text-stone-400 hover:text-[#2B1810]'
            }`}
          >
            Shipping &amp; Return Policy
          </button>
        </div>

        <div className="py-6 text-sm text-gray-700 dark:text-stone-300 leading-relaxed max-w-3xl">
          {activeTab === 'desc' && (
            <div className="space-y-4">
              <p>{product.description}</p>
              {product.is_kashmiri_earring && (
                <div className="p-4 rounded-xl bg-[#FFF8F5] dark:bg-[#5B0E14] border border-[#F3DDD5] dark:border-[#7A1921] space-y-2">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-[#789A99] dark:text-[#F1E194]">
                    Handcrafted Kashmiri Artistry
                  </h4>
                  <p className="text-xs">
                    Each pair of Kashmiri earrings is individually handcrafted by skilled artisans featuring authentic filigree detailing, cascading seed pearls, and enamel highlights.
                  </p>
                </div>
              )}
              {product.is_mystery_scoop && (
                <div className="p-4 rounded-xl bg-[#FFF8F5] dark:bg-[#5B0E14] border border-[#F3DDD5] dark:border-[#7A1921] space-y-2">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-[#789A99] dark:text-[#F1E194]">
                    Mystery Scoop Guarantee
                  </h4>
                  <p className="text-xs">
                    Every scoop delivers verified value exceeding the scoop price! Items include anti-tarnish stainless steel rings, earrings, lockets, and aesthetic hair accessories packed fresh on live stream.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'care' && (
            <div className="space-y-3">
              <h4 className="font-bold text-sm text-[#2B1810] dark:text-[#FCF7DC]">
                How to Care for Your Charms Hub Jewelry:
              </h4>
              <ul className="list-disc pl-5 space-y-1.5 text-xs">
                <li>Avoid direct contact with heavy perfumes, alcohol-based sanitizers, and chlorine water.</li>
                <li>Store each piece separately in an airtight zip pouch or dry jewelry box to prevent scratching.</li>
                <li>Gently wipe with a soft microfiber cloth after wear to retain natural luster.</li>
                <li>For hair claws and stationery: keep away from excessive heat or prolonged direct sunlight.</li>
              </ul>
            </div>
          )}

          {activeTab === 'shipping' && (
            <div className="space-y-3 text-xs">
              <h4 className="font-bold text-sm text-[#2B1810] dark:text-[#FCF7DC]">
                Verified Delivery &amp; Unboxing Guidelines:
              </h4>
              <p>
                <strong>Delivery Timelines:</strong> Orders are dispatched within 24-48 business hours. Delivery across India typically takes 4 to 7 business days via express courier partners.
              </p>
              <p>
                <strong>Free Shipping:</strong> Automatically applied to all orders above ₹499 across India.
              </p>
              <p className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-900 dark:text-amber-200">
                <strong>Mandatory Unboxing Video Requirement:</strong> For any claims regarding damaged or missing items, a clear, continuous unboxing video (from opening the courier package till showing the item) recorded within 24 to 48 hours of delivery is mandatory.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Related Products Section */}
      {relatedProducts.length > 0 && (
        <div className="pt-10 border-t border-[#F3DDD5] dark:border-[#7A1921] space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-serif-display text-xl sm:text-2xl font-bold text-[#2B1810] dark:text-[#FCF7DC]">
              You May Also Like
            </h3>
            <Link
              to="/products"
              className="text-xs font-bold text-[#789A99] dark:text-[#F1E194] hover:underline"
            >
              View More &rarr;
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {relatedProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
