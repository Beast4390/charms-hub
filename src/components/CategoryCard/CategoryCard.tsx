import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Category } from '../../types';

interface CategoryCardProps {
  category: Category;
  compact?: boolean;
}

export const CategoryCard: React.FC<CategoryCardProps> = ({ category, compact = false }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/products?category=${category.slug}`);
  };

  if (compact) {
    return (
      <button
        onClick={handleClick}
        className="flex flex-col items-center gap-2 text-center group cursor-pointer shrink-0 focus:outline-hidden"
      >
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl p-1 bg-white dark:bg-[#7A1921] border border-[#F3DDD5] dark:border-[#8F1F28] shadow-xs group-hover:shadow-md group-hover:scale-105 group-hover:border-[#789A99] dark:group-hover:border-[#F1E194] transition-all duration-200 overflow-hidden">
          <img
            src={category.image_url}
            alt={category.name}
            className="w-full h-full object-cover rounded-xl group-hover:scale-110 transition-transform duration-300"
            loading="lazy"
          />
        </div>
        <span className="text-xs sm:text-xs font-semibold text-[#2B1810] dark:text-[#FCF7DC] group-hover:text-[#789A99] dark:group-hover:text-[#F1E194] transition-colors max-w-[80px] truncate">
          {category.name}
        </span>
      </button>
    );
  }

  return (
    <div
      onClick={handleClick}
      className="group relative rounded-2xl bg-white dark:bg-[#5B0E14] border border-[#F3DDD5] dark:border-[#7A1921] p-3 sm:p-4 shadow-xs hover:shadow-lg transition-all duration-300 cursor-pointer overflow-hidden flex flex-col justify-between"
    >
      <div className="aspect-square w-full rounded-xl overflow-hidden bg-[#FFF1EC] dark:bg-[#3F070B] mb-3">
        <img
          src={category.image_url}
          alt={category.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm sm:text-base font-bold text-[#2B1810] dark:text-[#F1E194] group-hover:text-[#789A99] dark:group-hover:text-[#FCF7DC] transition-colors">
            {category.name}
          </h3>
          {category.item_count && (
            <span className="text-[11px] font-semibold text-[#789A99] dark:text-[#E3D1AC] bg-[#FFD2C2]/40 dark:bg-[#7A1921] px-2 py-0.5 rounded-full">
              {category.item_count} items
            </span>
          )}
        </div>
        {category.description && (
          <p className="text-xs text-gray-500 dark:text-stone-300 line-clamp-2 mt-1">
            {category.description}
          </p>
        )}
      </div>
    </div>
  );
};
