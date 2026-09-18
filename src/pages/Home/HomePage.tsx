import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SearchBar } from '../../components/SearchBar/SearchBar';
import { CategoryCard } from '../../components/CategoryCard/CategoryCard';
import { ProductGrid } from '../../components/ProductGrid/ProductGrid';
import { VERIFIED_CATEGORIES } from '../../data/categories';
import { storeCatalog } from '../../services/storeCatalog';
import { Sparkles, ArrowRight, ShieldCheck, Truck, RefreshCw } from 'lucide-react';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [activeBanner, setActiveBanner] = useState(0);
  const [productsList, setProductsList] = useState(() => storeCatalog.getProducts(false));

  useEffect(() => {
    const handleCatalogUpdate = () => {
      setProductsList(storeCatalog.getProducts(false));
    };
    window.addEventListener('charms_hub_catalog_changed', handleCatalogUpdate);
    return () => window.removeEventListener('charms_hub_catalog_changed', handleCatalogUpdate);
  }, []);

  const mysteryScoopProducts = productsList.filter((p) => p.is_mystery_scoop);
  const kashmiriEarringProducts = productsList.filter((p) => p.is_kashmiri_earring);
  const allOtherProducts = productsList.filter(
    (p) => !p.is_mystery_scoop && !p.is_kashmiri_earring
  );

  const banners = [
    {
      id: 'banner-claws',
      title: 'Must Have Floral Hair Claws',
      subtitle: 'Vibrant tropical plumeria & pastel claws with non-slip grip',
      tag: 'TRENDING BESTSELLER',
      bgGradient: 'from-amber-100 via-rose-100 to-orange-100 dark:from-[#5B0E14] dark:to-[#7A1921]',
      imageUrl: '/products/hair-accessories/hawaiian-flower-claws-small.jpg',
      actionLink: '/products?category=hair-accessories',
      actionText: 'Shop Hair Claws',
    },
    {
      id: 'banner-bracelets',
      title: 'Tennis Bracelet To Elevate Your Look',
      subtitle: 'Anti-tarnish, waterproof stainless steel jewelry starting at ₹150',
      tag: 'DAILY ESSENTIALS',
      bgGradient: 'from-pink-100 via-rose-50 to-purple-100 dark:from-[#3F070B] dark:to-[#5B0E14]',
      imageUrl: '/products/bracelets/the-silver-wave-bracelet.jpg',
      actionLink: '/products?category=bracelets',
      actionText: 'Explore Bracelets',
    },
    {
      id: 'banner-mystery',
      title: 'Anti-Tarnish Mystery Scoops',
      subtitle: 'Curated scoop filled with rings, lockets, earrings & secret charms',
      tag: 'FAN FAVORITE',
      bgGradient: 'from-teal-50 via-peach-100 to-rose-100 dark:from-[#7A1921] dark:to-[#5B0E14]',
      imageUrl: '/products/mystery-scoop/anti-tarnish-jewelry-mystery-scoop.webp',
      actionLink: '/products?category=mystery-scoop',
      actionText: 'Order a Mystery Scoop',
    },
  ];

  return (
    <div className="space-y-12 sm:space-y-16 pb-16">
      
      {/* Search Bar Section */}
      <section className="max-w-4xl mx-auto px-4 pt-4 sm:pt-6">
        <SearchBar />
      </section>

      {/* Categories Bubble Strip (matching video at 0:05 and 0:59) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#789A99] dark:text-[#F1E194]">
            Browse Categories
          </h3>
          <Link
            to="/categories"
            className="text-xs font-semibold text-[#789A99] dark:text-[#F1E194] hover:underline flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Horizontal Category Cards Carousel */}
        <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto pb-4 pt-1 scrollbar-none">
          {VERIFIED_CATEGORIES.slice(0, 8).map((cat) => (
            <CategoryCard key={cat.id} category={cat} compact />
          ))}
        </div>
      </section>

      {/* Promotional Hero Carousel Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-3xl overflow-hidden shadow-lg border border-[#F3DDD5] dark:border-[#7A1921]">
          <div className="relative min-h-[300px] sm:min-h-[380px] md:min-h-[440px] flex flex-col md:flex-row items-center justify-between p-6 sm:p-10 lg:p-14 bg-gradient-to-br transition-all duration-700">
            
            {/* Banner Text */}
            <div className="z-10 max-w-xl text-center md:text-left space-y-3 sm:space-y-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-widest bg-white/80 dark:bg-[#7A1921]/90 text-[#C2185B] dark:text-[#F1E194] shadow-xs">
                <Sparkles className="w-3 h-3" />
                {banners[activeBanner].tag}
              </span>
              <h1 className="font-serif-display text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#2B1810] dark:text-[#FCF7DC] leading-tight">
                {banners[activeBanner].title}
              </h1>
              <p className="text-xs sm:text-base text-gray-700 dark:text-stone-300 leading-relaxed">
                {banners[activeBanner].subtitle}
              </p>
              <div className="pt-2">
                <Link
                  to={banners[activeBanner].actionLink}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#789A99] hover:bg-[#587978] dark:bg-[#F1E194] dark:hover:bg-[#E3D1AC] text-white dark:text-[#3F070B] font-bold text-sm shadow-md hover:scale-105 active:scale-95 transition-all"
                >
                  <span>{banners[activeBanner].actionText}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Banner Image */}
            <div className="mt-6 md:mt-0 w-full md:w-1/2 flex justify-center">
              <div className="w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 rounded-3xl overflow-hidden shadow-2xl border-4 border-white/80 dark:border-[#7A1921]/80 transform rotate-1 hover:rotate-0 transition-transform duration-500">
                <img
                  src={banners[activeBanner].imageUrl}
                  alt={banners[activeBanner].title}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* Banner Dot Indicators */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 z-20">
            {banners.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActiveBanner(idx)}
                className={`h-2 rounded-full transition-all ${
                  activeBanner === idx
                    ? 'w-6 bg-[#789A99] dark:bg-[#F1E194]'
                    : 'w-2 bg-white/60 dark:bg-white/20'
                }`}
                aria-label={`Slide ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Value Proposition Strip */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-4 px-6 rounded-2xl bg-[#FFF8F5] dark:bg-[#5B0E14] border border-[#F3DDD5] dark:border-[#7A1921] text-xs font-semibold">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-[#FFD2C2] dark:bg-[#7A1921] text-[#789A99] dark:text-[#F1E194]">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-[#2B1810] dark:text-[#FCF7DC]">Free Shipping &gt; ₹499</div>
              <div className="text-gray-500 dark:text-stone-400 text-[11px]">Across India via express courier</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-[#FFD2C2] dark:bg-[#7A1921] text-[#789A99] dark:text-[#F1E194]">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-[#2B1810] dark:text-[#FCF7DC]">Anti-Tarnish Plating</div>
              <div className="text-gray-500 dark:text-stone-400 text-[11px]">Durable stainless steel craft</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-[#FFD2C2] dark:bg-[#7A1921] text-[#789A99] dark:text-[#F1E194]">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-[#2B1810] dark:text-[#FCF7DC]">Packaging Videos</div>
              <div className="text-gray-500 dark:text-stone-400 text-[11px]">Watch your order packed on Instagram</div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 1: Mystery Scoop Section (exact recreation from video 0:00 & 1:01) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ProductGrid
          products={mysteryScoopProducts}
          title="Mystery scoop"
          subtitle="Curated surprise scoops of handcrafted rings, anti-tarnish jewelry, and viral hairpins"
          badge="SURPRISE BOXES"
          showViewMore={false}
        />
      </section>

      {/* SECTION 2: Kashmiri Earrings Section (exact recreation from video 0:01 & 1:02) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <ProductGrid
          products={kashmiriEarringProducts}
          title="Kashmiri Earrings"
          subtitle="Handcrafted traditional chandelier jhumkas, pearl cascades, and heritage filigree designs"
          badge="HERITAGE CRAFT"
          itemsPerPage={6}
          onViewMoreClick={() => navigate('/products?category=earrings')}
        />
      </section>

      {/* SECTION 3: DISCOVER Our Products Section (exact recreation from video 0:03 & 1:03) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <ProductGrid
          products={allOtherProducts}
          title="Our Products"
          subtitle="Explore our curated collection of quality products, handpicked just for you"
          badge="DISCOVER"
          itemsPerPage={12}
        />
      </section>
    </div>
  );
};
