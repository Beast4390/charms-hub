import React from 'react';
import { VERIFIED_CATEGORIES } from '../../data/categories';
import { CategoryCard } from '../../components/CategoryCard/CategoryCard';
import { Sparkles } from 'lucide-react';

export const CategoriesPage: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-widest text-[#789A99] dark:text-[#F1E194] bg-[#FFD2C2]/40 dark:bg-[#7A1921] px-3 py-1 rounded-full mb-3">
          <Sparkles className="w-3 h-3" />
          DISCOVER COLLECTIONS
        </span>
        <h1 className="font-serif-display text-3xl sm:text-4xl font-bold text-[#2B1810] dark:text-[#FCF7DC]">
          All Product Categories
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-stone-300">
          Browse our full assortment of Kashmiri earrings, anti-tarnish bracelets, mystery scoops, hair accessories, stationery, and organizers.
        </p>
      </div>

      {/* Grid of full category cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {VERIFIED_CATEGORIES.map((cat) => (
          <CategoryCard key={cat.id} category={cat} />
        ))}
      </div>
    </div>
  );
};
