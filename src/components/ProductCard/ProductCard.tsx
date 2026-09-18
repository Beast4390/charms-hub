import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, Eye, ImageOff } from 'lucide-react';
import { Product, StoreAppearanceSettings } from '../../types';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { getStoreAppearance } from '../../services/appearanceService';

interface ProductCardProps {
  product: Product;
  appearanceOverride?: Partial<StoreAppearanceSettings>;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, appearanceOverride }) => {
  const { addToCart } = useCart();
  const { isAuthenticated, setPendingAction } = useAuth();
  const navigate = useNavigate();
  const [imageError, setImageError] = useState(false);
  const [appearance, setAppearance] = useState<StoreAppearanceSettings>(() => getStoreAppearance());

  useEffect(() => {
    const handleAppearanceChange = (e: Event) => {
      const customEvent = e as CustomEvent<StoreAppearanceSettings>;
      if (customEvent.detail) {
        setAppearance(customEvent.detail);
      } else {
        setAppearance(getStoreAppearance());
      }
    };
    window.addEventListener('charms_hub_appearance_changed', handleAppearanceChange);
    return () => window.removeEventListener('charms_hub_appearance_changed', handleAppearanceChange);
  }, []);

  const activeAppearance = { ...appearance, ...appearanceOverride };

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!product.in_stock) return;

    if (!isAuthenticated) {
      setPendingAction({
        action: 'add_to_cart',
        productId: product.id,
        quantity: 1,
        returnUrl: window.location.pathname,
        timestamp: Date.now(),
      });
      navigate(`/auth/login?redirect=${encodeURIComponent(window.location.pathname)}&action=add_to_cart&product=${product.id}`);
      return;
    }

    addToCart(product, 1);
  };

  const isImageValid = Boolean(product.reference_verified && product.image_url && !imageError);

  // Appearance style mapping
  const bgClass =
    activeAppearance.card_bg === 'cream'
      ? 'bg-[#FDF6F0] dark:bg-[#4D0B11]'
      : activeAppearance.card_bg === 'framed'
      ? 'bg-[#FFF8F5] dark:bg-[#520C12]'
      : 'bg-white dark:bg-[#5B0E14]';

  const borderClass =
    activeAppearance.card_border === 'none'
      ? 'border-0'
      : activeAppearance.card_border === 'border-2'
      ? 'border-2 border-[#F3DDD5] dark:border-[#7A1921]'
      : 'border border-[#F3DDD5] dark:border-[#7A1921]';

  const shadowClass =
    activeAppearance.card_shadow === 'shadow-xl'
      ? 'shadow-xl hover:shadow-2xl'
      : activeAppearance.card_shadow === 'shadow-md'
      ? 'shadow-md hover:shadow-lg'
      : 'shadow-xs hover:shadow-xl';

  const radiusClass = activeAppearance.card_radius || 'rounded-2xl';

  const aspectClass =
    activeAppearance.image_aspect === 'aspect-4/3'
      ? 'aspect-[4/3]'
      : activeAppearance.image_aspect === 'aspect-3/4'
      ? 'aspect-[3/4]'
      : 'aspect-square';

  const densityPadding =
    activeAppearance.card_density === 'compact'
      ? 'p-2.5 sm:p-3'
      : activeAppearance.card_density === 'spacious'
      ? 'p-5 sm:p-6'
      : 'p-3.5 sm:p-4';

  const buttonStyleClass =
    activeAppearance.button_style === 'pill'
      ? 'rounded-full'
      : activeAppearance.button_style === 'outline'
      ? 'rounded-xl border-2 border-[#FFD2C2] dark:border-[#7A1921] bg-transparent hover:bg-[#FFD2C2]/30 dark:hover:bg-[#7A1921]/50'
      : 'rounded-xl bg-[#FFD2C2] hover:bg-[#F5B8A3] dark:bg-[#7A1921] dark:hover:bg-[#8F1F28]';

  return (
    <div
      className={`group relative flex flex-col ${bgClass} ${radiusClass} ${borderClass} ${shadowClass} overflow-hidden transition-all duration-300`}
    >
      {/* Product Image Link */}
      <Link
        to={`/products/${product.id}`}
        className={`relative ${aspectClass} w-full overflow-hidden bg-[#FFF1EC] dark:bg-[#3F070B] block`}
      >
        {isImageValid ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-[#FDF4EE] dark:bg-[#4D0B11]">
            <ImageOff className="w-8 h-8 text-stone-400 dark:text-stone-500 mb-1.5" />
            <span className="text-xs font-bold text-stone-600 dark:text-stone-300">
              Product image unavailable
            </span>
            <span className="text-[10px] text-stone-400 dark:text-stone-400 mt-0.5">
              Pending reference verification
            </span>
          </div>
        )}

        {/* Out of Stock Overlay */}
        {!product.in_stock && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center p-2 z-10">
            <span className="bg-[#D32F2F] text-white text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full shadow-md">
              Out of Stock
            </span>
          </div>
        )}

        {/* Quick view button on hover */}
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-20">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              navigate(`/products/${product.id}`);
            }}
            className="p-2 rounded-full bg-white/90 dark:bg-[#7A1921]/90 text-[#2B1810] dark:text-[#F1E194] shadow-md hover:scale-110 transition-transform"
            title="View Details"
            aria-label="View Product Details"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      </Link>

      {/* Details info */}
      <div className={`${densityPadding} flex flex-col flex-1 justify-between`}>
        <div>
          {product.category_name && (
            <span
              className={`text-[10px] uppercase font-bold tracking-wider ${
                activeAppearance.badge_style === 'vibrant'
                  ? 'bg-[#789A99] text-white px-2 py-0.5 rounded-md inline-block'
                  : activeAppearance.badge_style === 'pill'
                  ? 'bg-[#FFD2C2]/70 dark:bg-[#7A1921] px-2 py-0.5 rounded-full inline-block text-[#2B1810] dark:text-[#F1E194]'
                  : 'text-[#789A99] dark:text-[#E3D1AC]'
              }`}
            >
              {product.category_name}
            </span>
          )}
          <Link
            to={`/products/${product.id}`}
            className="block text-sm font-semibold text-[#2B1810] dark:text-[#FCF7DC] group-hover:text-[#789A99] dark:group-hover:text-[#F1E194] transition-colors line-clamp-2 mt-1"
            title={product.name}
          >
            {product.name}
          </Link>
        </div>

        <div className="mt-3">
          {/* Price Row */}
          <div className="flex items-baseline flex-wrap gap-1.5">
            <span
              className={`text-base sm:text-lg ${
                activeAppearance.price_style === 'bold'
                  ? 'font-black tracking-tight text-[#2B1810] dark:text-[#F1E194]'
                  : activeAppearance.price_style === 'highlight'
                  ? 'font-extrabold text-[#789A99] dark:text-[#F1E194]'
                  : 'font-extrabold text-[#2B1810] dark:text-[#F1E194]'
              }`}
            >
              ₹{product.price}
            </span>
            {product.mrp && product.mrp > product.price && (
              <span className="text-xs text-gray-400 line-through">
                ₹{product.mrp}
              </span>
            )}
            {product.discount_percent && product.discount_percent > 0 && (
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                ({product.discount_percent}% OFF)
              </span>
            )}
          </div>

          {/* Add to Cart button */}
          <button
            onClick={handleQuickAdd}
            disabled={!product.in_stock}
            className={`w-full mt-3 py-2 px-3 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs text-[#2B1810] dark:text-[#F1E194] ${buttonStyleClass} ${
              product.in_stock
                ? 'cursor-pointer'
                : 'bg-gray-100 dark:bg-stone-800 text-gray-400 dark:text-stone-500 cursor-not-allowed border-0'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>{product.in_stock ? 'Add to Cart' : 'Out of Stock'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
