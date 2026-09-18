import React, { useState } from 'react';
import { ProductCard } from '../ProductCard/ProductCard';
import { Product } from '../../types';
import { Sparkles, ChevronDown } from 'lucide-react';

interface ProductGridProps {
  products: Product[];
  itemsPerPage?: number;
  showViewMore?: boolean;
  onViewMoreClick?: () => void;
  title?: string;
  subtitle?: string;
  badge?: string;
}

export const ProductGrid: React.FC<ProductGridProps> = ({
  products,
  itemsPerPage = 12,
  showViewMore = true,
  onViewMoreClick,
  title,
  subtitle,
  badge,
}) => {
  const [displayCount, setDisplayCount] = useState(itemsPerPage);

  const visibleProducts = products.slice(0, displayCount);
  const hasMore = displayCount < products.length;

  const handleLoadMore = () => {
    if (onViewMoreClick) {
      onViewMoreClick();
    } else {
      setDisplayCount((prev) => Math.min(prev + itemsPerPage, products.length));
    }
  };

  return (
    <div className="w-full">
      {/* Optional Header Section */}
      {(title || subtitle || badge) && (
        <div className="text-center mb-8">
          {badge && (
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-widest text-[#789A99] dark:text-[#F1E194] bg-[#FFD2C2]/40 dark:bg-[#7A1921] px-3 py-1 rounded-full mb-2">
              <Sparkles className="w-3 h-3" />
              {badge}
            </span>
          )}
          {title && (
            <h2 className="font-serif-display text-2xl sm:text-3xl md:text-4xl font-bold text-[#2B1810] dark:text-[#FCF7DC] tracking-tight">
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="mt-2 text-sm text-gray-600 dark:text-stone-300 max-w-xl mx-auto">
              {subtitle}
            </p>
          )}
        </div>
      )}

      {/* Grid */}
      {products.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-[#5B0E14] rounded-2xl border border-[#F3DDD5] dark:border-[#7A1921] p-8">
          <p className="text-base text-gray-500 dark:text-stone-300 font-medium">
            No products match the selected filters.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Try clearing filters or search for something else.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
            {visibleProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {/* View More / Counter button */}
          {showViewMore && hasMore && (
            <div className="mt-10 flex flex-col items-center justify-center gap-3">
              <button
                onClick={handleLoadMore}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white dark:bg-[#5B0E14] border-2 border-[#789A99] dark:border-[#F1E194] text-[#2B1810] dark:text-[#FCF7DC] font-bold text-sm hover:bg-[#FFD2C2]/30 dark:hover:bg-[#7A1921] transition-all shadow-xs hover:scale-105 active:scale-95 cursor-pointer"
              >
                <span>View More</span>
                <ChevronDown className="w-4 h-4 text-[#789A99] dark:text-[#F1E194]" />
              </button>
              <span className="text-xs text-gray-500 dark:text-stone-400 font-medium">
                Showing {visibleProducts.length} of {products.length} products
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
};
