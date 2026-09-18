import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, ArrowRight } from 'lucide-react';
import { VERIFIED_PRODUCTS } from '../../data/verifiedProducts';
import { VERIFIED_CATEGORIES } from '../../data/categories';
import { Product } from '../../types';

interface SearchBarProps {
  initialQuery?: string;
  onSearchSubmit?: (query: string) => void;
  isFloating?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  initialQuery = '',
  onSearchSubmit,
  isFloating = false,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const trimmed = query.trim().toLowerCase();

  const matchedProducts: Product[] = trimmed
    ? VERIFIED_PRODUCTS.filter(
        (p) =>
          p.name.toLowerCase().includes(trimmed) ||
          p.description.toLowerCase().includes(trimmed) ||
          p.tags?.some((t) => t.toLowerCase().includes(trimmed)) ||
          p.category_name?.toLowerCase().includes(trimmed)
      ).slice(0, 5)
    : [];

  const matchedCategories = trimmed
    ? VERIFIED_CATEGORIES.filter((c) =>
        c.name.toLowerCase().includes(trimmed)
      ).slice(0, 3)
    : [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmed) return;
    setIsOpen(false);
    if (onSearchSubmit) {
      onSearchSubmit(trimmed);
    } else {
      navigate(`/products?search=${encodeURIComponent(trimmed)}`);
    }
  };

  const handleSelectProduct = (product: Product) => {
    setIsOpen(false);
    navigate(`/products/${product.id}`);
  };

  const handleSelectCategory = (categorySlug: string) => {
    setIsOpen(false);
    navigate(`/products?category=${categorySlug}`);
  };

  return (
    <div ref={searchContainerRef} className={`relative w-full ${isFloating ? '' : 'max-w-2xl mx-auto'}`}>
      <form onSubmit={handleSubmit} className="relative flex items-center">
        <div className="absolute left-4 pointer-events-none text-[#789A99] dark:text-[#F1E194]">
          <Search className="w-5 h-5" />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search for products, categories, or brands..."
          className="w-full pl-12 pr-10 py-3 rounded-full bg-white dark:bg-[#3F070B] text-[#2B1810] dark:text-[#FCF7DC] border border-[#F3DDD5] dark:border-[#7A1921] focus:outline-hidden focus:ring-2 focus:ring-[#789A99] dark:focus:ring-[#F1E194] shadow-xs text-sm transition-all placeholder:text-gray-400 dark:placeholder:text-stone-400"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setIsOpen(false);
            }}
            className="absolute right-3.5 p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-stone-200"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </form>

      {/* Live search dropdown results */}
      {isOpen && trimmed && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#5B0E14] border border-[#F3DDD5] dark:border-[#7A1921] rounded-2xl shadow-xl overflow-hidden z-50 divide-y divide-[#F3DDD5] dark:divide-[#7A1921]">
          {matchedCategories.length > 0 && (
            <div className="p-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#789A99] dark:text-[#F1E194] mb-2 px-2">
                Categories
              </div>
              <div className="flex flex-wrap gap-2">
                {matchedCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => handleSelectCategory(cat.slug)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FFD2C2]/40 dark:bg-[#7A1921] text-xs font-semibold text-[#2B1810] dark:text-[#FCF7DC] hover:bg-[#FFD2C2] transition"
                  >
                    <span>{cat.name}</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {matchedProducts.length > 0 ? (
            <div className="p-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#789A99] dark:text-[#F1E194] my-1 px-3">
                Products ({matchedProducts.length})
              </div>
              <div className="space-y-1">
                {matchedProducts.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handleSelectProduct(p)}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-[#FFD2C2]/30 dark:hover:bg-[#7A1921] cursor-pointer transition"
                  >
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="w-12 h-12 object-cover rounded-lg shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[#2B1810] dark:text-[#FCF7DC] truncate">
                        {p.name}
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-bold text-[#2B1810] dark:text-[#F1E194]">
                          ₹{p.price}
                        </span>
                        {p.mrp && (
                          <span className="text-gray-400 line-through">
                            ₹{p.mrp}
                          </span>
                        )}
                        {!p.in_stock && (
                          <span className="text-red-500 font-semibold text-[10px]">
                            Out of Stock
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            matchedCategories.length === 0 && (
              <div className="p-6 text-center text-sm text-gray-500 dark:text-stone-300">
                No verified products found matching &ldquo;{query}&rdquo;.
                <div className="mt-2 text-xs text-[#789A99] dark:text-[#F1E194]">
                  Tip: Ask our AI Shopping Assistant at the bottom right for instant recommendations!
                </div>
              </div>
            )
          )}

          <div className="p-2 bg-[#FFF8F5] dark:bg-[#3F070B] text-center">
            <button
              onClick={handleSubmit}
              className="text-xs font-semibold text-[#789A99] dark:text-[#F1E194] hover:underline"
            >
              See all results for &ldquo;{query}&rdquo; &rarr;
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
