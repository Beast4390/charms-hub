import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { VERIFIED_CATEGORIES } from '../../data/categories';
import { ProductCard } from '../../components/ProductCard/ProductCard';
import { SearchBar } from '../../components/SearchBar/SearchBar';
import { useCatalog } from '../../hooks/useCatalog';
import { Filter, SlidersHorizontal, ArrowUpDown, X, Sparkles, AlertTriangle } from 'lucide-react';

export const ProductsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const categoryQuery = searchParams.get('category') || '';
  const searchQuery = searchParams.get('search') || '';

  const { products: productsList, loading, error, reload } = useCatalog(false);
  const [selectedCategory, setSelectedCategory] = useState<string>(categoryQuery);
  const [searchTerm, setSearchTerm] = useState<string>(searchQuery);
  const [sortBy, setSortBy] = useState<string>('featured');
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [priceRange, setPriceRange] = useState<number>(1000);
  const [mobileFilterOpen, setMobileFilterOpen] = useState<boolean>(false);

  useEffect(() => {
    setSelectedCategory(searchParams.get('category') || '');
    setSearchTerm(searchParams.get('search') || '');
  }, [searchParams]);

  const handleCategorySelect = (slug: string) => {
    const next = selectedCategory === slug ? '' : slug;
    setSelectedCategory(next);
    if (next) {
      searchParams.set('category', next);
    } else {
      searchParams.delete('category');
    }
    setSearchParams(searchParams);
  };

  const handleClearFilters = () => {
    setSelectedCategory('');
    setSearchTerm('');
    setInStockOnly(false);
    setPriceRange(1000);
    setSortBy('featured');
    navigate('/products');
  };

  const filteredProducts = useMemo(() => {
    return productsList.filter((p) => {
      // Category filter (match category slug or category_name or tags)
      if (selectedCategory) {
        const catObj = VERIFIED_CATEGORIES.find((c) => c.slug === selectedCategory);
        if (catObj && p.category_id !== catObj.id) {
          return false;
        }
      }

      // Search term filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matches =
          p.name.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query) ||
          p.category_name?.toLowerCase().includes(query) ||
          p.tags?.some((t) => t.toLowerCase().includes(query));
        if (!matches) return false;
      }

      // Price limit
      if (p.price > priceRange) {
        return false;
      }

      // In-stock
      if (inStockOnly && !p.in_stock) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'price-low') return a.price - b.price;
      if (sortBy === 'price-high') return b.price - a.price;
      if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
      return 0; // 'featured' preserves original verified ordering
    });
  }, [productsList, selectedCategory, searchTerm, priceRange, inStockOnly, sortBy]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Search Bar header */}
      <div className="max-w-2xl mx-auto">
        <SearchBar
          initialQuery={searchTerm}
          onSearchSubmit={(q) => {
            setSearchTerm(q);
            searchParams.set('search', q);
            setSearchParams(searchParams);
          }}
        />
      </div>

      {/* Page Title & Category Badges Strip */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="font-serif-display text-2xl sm:text-3xl font-bold text-[#2B1810] dark:text-[#FCF7DC]">
              {selectedCategory
                ? VERIFIED_CATEGORIES.find((c) => c.slug === selectedCategory)?.name || 'Products'
                : 'All Verified Products'}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-stone-300 mt-1">
              Showing {filteredProducts.length} authentic Charms Hub items
            </p>
          </div>

          {/* Controls Right */}
          <div className="flex items-center gap-3">
            {/* Mobile Filter Trigger */}
            <button
              onClick={() => setMobileFilterOpen(true)}
              className="md:hidden flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-[#5B0E14] border border-[#F3DDD5] dark:border-[#7A1921] text-xs font-bold text-[#2B1810] dark:text-[#FCF7DC]"
            >
              <Filter className="w-4 h-4 text-[#789A99] dark:text-[#F1E194]" />
              <span>Filters</span>
            </button>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2 bg-white dark:bg-[#5B0E14] border border-[#F3DDD5] dark:border-[#7A1921] rounded-xl px-3 py-1.5 shadow-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#789A99] dark:text-[#F1E194]" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="text-xs font-semibold bg-transparent text-[#2B1810] dark:text-[#FCF7DC] focus:outline-hidden cursor-pointer"
              >
                <option value="featured" className="bg-white text-[#2B1810] dark:bg-[#5B0E14] dark:text-[#FCF7DC]">Featured First</option>
                <option value="price-low" className="bg-white text-[#2B1810] dark:bg-[#5B0E14] dark:text-[#FCF7DC]">Price: Low to High</option>
                <option value="price-high" className="bg-white text-[#2B1810] dark:bg-[#5B0E14] dark:text-[#FCF7DC]">Price: High to Low</option>
                <option value="name-asc" className="bg-white text-[#2B1810] dark:bg-[#5B0E14] dark:text-[#FCF7DC]">Alphabetical (A-Z)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Categories Pills Carousel */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => handleCategorySelect('')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all ${
              !selectedCategory
                ? 'bg-[#789A99] text-white dark:bg-[#F1E194] dark:text-[#3F070B] shadow-xs'
                : 'bg-white dark:bg-[#5B0E14] text-[#2B1810] dark:text-[#FCF7DC] border border-[#F3DDD5] dark:border-[#7A1921] hover:bg-[#FFD2C2]/40'
            }`}
          >
            All Categories
          </button>
          {VERIFIED_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategorySelect(cat.slug)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all ${
                selectedCategory === cat.slug
                  ? 'bg-[#789A99] text-white dark:bg-[#F1E194] dark:text-[#3F070B] shadow-xs'
                  : 'bg-white dark:bg-[#5B0E14] text-[#2B1810] dark:text-[#FCF7DC] border border-[#F3DDD5] dark:border-[#7A1921] hover:bg-[#FFD2C2]/40'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main layout: Sidebar (Desktop) + Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        
        {/* Desktop Sidebar Filters */}
        <div className="hidden md:block md:col-span-1 space-y-6">
          <div className="p-5 rounded-2xl bg-white dark:bg-[#5B0E14] border border-[#F3DDD5] dark:border-[#7A1921] shadow-xs space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#F3DDD5] dark:border-[#7A1921]">
              <div className="flex items-center gap-2 font-bold text-sm text-[#2B1810] dark:text-[#FCF7DC]">
                <SlidersHorizontal className="w-4 h-4 text-[#789A99] dark:text-[#F1E194]" />
                <span>Filters</span>
              </div>
              {(selectedCategory || searchTerm || inStockOnly || priceRange < 1000) && (
                <button
                  onClick={handleClearFilters}
                  className="text-[11px] font-bold text-[#C2185B] dark:text-[#F1E194] hover:underline"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Price Filter Slider */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-2 text-[#2B1810] dark:text-[#FCF7DC]">
                <span>Max Price</span>
                <span className="font-bold text-[#789A99] dark:text-[#F1E194]">₹{priceRange}</span>
              </div>
              <input
                type="range"
                min="99"
                max="1000"
                step="25"
                value={priceRange}
                onChange={(e) => setPriceRange(Number(e.target.value))}
                className="w-full accent-[#789A99] dark:accent-[#F1E194] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                <span>₹99</span>
                <span>₹1000</span>
              </div>
            </div>

            {/* In-Stock Toggle */}
            <div className="pt-2">
              <label className="flex items-center gap-3 cursor-pointer text-xs font-semibold text-[#2B1810] dark:text-[#FCF7DC]">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => setInStockOnly(e.target.checked)}
                  className="w-4 h-4 rounded text-[#789A99] accent-[#789A99] dark:accent-[#F1E194]"
                />
                <span>In-Stock Items Only</span>
              </label>
            </div>

            {/* Category selection list */}
            <div className="pt-2 border-t border-[#F3DDD5] dark:border-[#7A1921]">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#789A99] dark:text-[#F1E194] mb-3">
                Categories
              </h4>
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {VERIFIED_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => handleCategorySelect(cat.slug)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition flex items-center justify-between ${
                      selectedCategory === cat.slug
                        ? 'bg-[#FFD2C2] dark:bg-[#7A1921] font-bold text-[#2B1810] dark:text-[#F1E194]'
                        : 'text-gray-700 dark:text-stone-300 hover:bg-gray-50 dark:hover:bg-[#7A1921]/40'
                    }`}
                  >
                    <span className="truncate">{cat.name}</span>
                    {cat.item_count && (
                      <span className="text-[10px] text-gray-400 dark:text-stone-400">
                        {cat.item_count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Products Grid Area */}
        <div className="md:col-span-3">
          {loading && filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-[#5B0E14] rounded-2xl border border-[#F3DDD5] dark:border-[#7A1921] p-8 gap-3">
              <span className="w-3 h-3 rounded-full bg-[#789A99] dark:bg-[#F1E194] animate-ping" />
              <p className="text-xs font-semibold text-gray-500 dark:text-stone-400">
                Loading the verified catalog…
              </p>
            </div>
          ) : error && !loading && filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-amber-50 dark:bg-amber-950/60 rounded-2xl border border-amber-200 dark:border-amber-800 p-8 gap-3 text-xs text-amber-800 dark:text-amber-200">
              <AlertTriangle className="w-6 h-6" />
              <p className="font-semibold text-center">{error}</p>
              <button
                onClick={reload}
                className="px-4 py-2 rounded-full bg-amber-600 text-white font-bold hover:bg-amber-700 transition cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-[#5B0E14] rounded-2xl border border-[#F3DDD5] dark:border-[#7A1921] p-8">
              <Sparkles className="w-8 h-8 text-[#789A99] dark:text-[#F1E194] mx-auto mb-3" />
              <h3 className="text-base font-bold text-[#2B1810] dark:text-[#FCF7DC]">
                No verified products found
              </h3>
              <p className="text-xs text-gray-500 dark:text-stone-300 mt-1 max-w-sm mx-auto">
                We couldn&apos;t find any items matching your current filters. Try relaxing your search or price criteria.
              </p>
              <button
                onClick={handleClearFilters}
                className="mt-4 px-5 py-2 rounded-full bg-[#FFD2C2] hover:bg-[#F5B8A3] dark:bg-[#7A1921] dark:hover:bg-[#8F1F28] text-xs font-bold text-[#2B1810] dark:text-[#F1E194] transition"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
              {filteredProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Filters Drawer */}
      {mobileFilterOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden md:hidden">
          <div
            onClick={() => setMobileFilterOpen(false)}
            className="absolute inset-0 bg-black/50 backdrop-blur-xs"
          />
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-xs bg-white dark:bg-[#5B0E14] p-5 shadow-2xl flex flex-col justify-between">
              <div className="space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-[#F3DDD5] dark:border-[#7A1921]">
                  <h3 className="font-bold text-sm text-[#2B1810] dark:text-[#FCF7DC]">
                    Filter Products
                  </h3>
                  <button onClick={() => setMobileFilterOpen(false)}>
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>

                {/* Price Slider */}
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-2 text-[#2B1810] dark:text-[#FCF7DC]">
                    <span>Max Price</span>
                    <span className="font-bold text-[#789A99] dark:text-[#F1E194]">₹{priceRange}</span>
                  </div>
                  <input
                    type="range"
                    min="99"
                    max="1000"
                    step="25"
                    value={priceRange}
                    onChange={(e) => setPriceRange(Number(e.target.value))}
                    className="w-full accent-[#789A99] dark:accent-[#F1E194]"
                  />
                </div>

                {/* In Stock */}
                <div>
                  <label className="flex items-center gap-3 text-xs font-semibold text-[#2B1810] dark:text-[#FCF7DC]">
                    <input
                      type="checkbox"
                      checked={inStockOnly}
                      onChange={(e) => setInStockOnly(e.target.checked)}
                      className="w-4 h-4 rounded accent-[#789A99]"
                    />
                    <span>In-Stock Only</span>
                  </label>
                </div>

                {/* Categories */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#789A99] dark:text-[#F1E194] mb-2">
                    Category
                  </h4>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {VERIFIED_CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => handleCategorySelect(cat.slug)}
                        className={`w-full text-left px-2 py-1.5 rounded-lg text-xs ${
                          selectedCategory === cat.slug
                            ? 'bg-[#FFD2C2] dark:bg-[#7A1921] font-bold text-[#2B1810] dark:text-[#F1E194]'
                            : 'text-gray-700 dark:text-stone-300'
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[#F3DDD5] dark:border-[#7A1921] flex gap-2">
                <button
                  onClick={handleClearFilters}
                  className="flex-1 py-2 rounded-xl border border-[#F3DDD5] text-xs font-semibold text-[#2B1810] dark:text-[#FCF7DC]"
                >
                  Clear
                </button>
                <button
                  onClick={() => setMobileFilterOpen(false)}
                  className="flex-1 py-2 rounded-xl bg-[#789A99] text-white text-xs font-bold"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
