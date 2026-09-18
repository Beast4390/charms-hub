import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Product } from '../../types';
import { ShoppingBag, ArrowRight, ImageOff } from 'lucide-react';
import { useCart } from '../../context/CartContext';

interface ChatProductCardProps {
  product: Product;
  onNavigate?: () => void;
}

export const ChatProductCard: React.FC<ChatProductCardProps> = ({ product, onNavigate }) => {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [imageError, setImageError] = useState(false);

  const handleOpen = () => {
    if (onNavigate) onNavigate();
    navigate(`/products/${product.id}`);
  };

  const isImageValid = Boolean(product.reference_verified && product.image_url && !imageError);

  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white dark:bg-[#7A1921] border border-[#F3DDD5] dark:border-[#8F1F28] shadow-xs hover:shadow-md transition">
      {isImageValid ? (
        <img
          src={product.image_url}
          alt={product.name}
          className="w-14 h-14 object-cover rounded-lg shrink-0 cursor-pointer"
          onClick={handleOpen}
          onError={() => setImageError(true)}
        />
      ) : (
        <div
          onClick={handleOpen}
          className="w-14 h-14 rounded-lg bg-[#FDF4EE] dark:bg-[#4D0B11] flex flex-col items-center justify-center shrink-0 cursor-pointer border border-[#F3DDD5] dark:border-[#7A1921]"
        >
          <ImageOff className="w-5 h-5 text-stone-400" />
          <span className="text-[8px] text-stone-400 font-medium mt-0.5">No img</span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h4
          onClick={handleOpen}
          className="text-xs font-bold text-[#2B1810] dark:text-[#FCF7DC] truncate hover:text-[#789A99] dark:hover:text-[#F1E194] cursor-pointer"
        >
          {product.name}
        </h4>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs font-extrabold text-[#2B1810] dark:text-[#F1E194]">
            ₹{product.price}
          </span>
          {product.mrp && product.mrp > product.price && (
            <span className="text-[10px] text-gray-400 line-through">
              ₹{product.mrp}
            </span>
          )}
          {!product.in_stock ? (
            <span className="text-[9px] font-bold text-red-500 bg-red-50 dark:bg-red-950/50 px-1.5 py-0.5 rounded-sm">
              Out of Stock
            </span>
          ) : (
            <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
              In Stock
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1 shrink-0">
        <button
          onClick={handleOpen}
          className="p-1.5 rounded-lg bg-[#FFD2C2]/50 hover:bg-[#FFD2C2] dark:bg-[#5B0E14] dark:hover:bg-[#3F070B] text-[#2B1810] dark:text-[#F1E194] text-[10px] font-bold flex items-center gap-1 transition"
          title="View Product"
        >
          <span>View</span>
          <ArrowRight className="w-3 h-3" />
        </button>
        {product.in_stock && (
          <button
            onClick={() => addToCart(product, 1)}
            className="p-1.5 rounded-lg bg-[#789A99] hover:bg-[#587978] dark:bg-[#F1E194] dark:hover:bg-[#E3D1AC] text-white dark:text-[#3F070B] text-[10px] font-bold flex items-center justify-center transition"
            title="Quick Add"
          >
            <ShoppingBag className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};
