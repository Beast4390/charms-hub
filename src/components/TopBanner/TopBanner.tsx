import React from 'react';
import { Sparkles } from 'lucide-react';

export const TopBanner: React.FC = () => {
  return (
    <div className="w-full text-xs font-semibold select-none">
      {/* Free Shipping Strip */}
      <div className="bg-[#FFD2C2] dark:bg-[#5B0E14] text-[#2B1810] dark:text-[#F1E194] border-b border-[#F3DDD5] dark:border-[#7A1921] py-1.5 px-4 text-center tracking-wider text-[11px] font-bold uppercase transition-colors">
        <div className="flex items-center justify-center gap-2">
          <Sparkles className="w-3 h-3 text-[#789A99] dark:text-[#F1E194] animate-spin" style={{ animationDuration: '4s' }} />
          <span>ENJOY FREE SHIPPING ABOVE ₹499/- ONLY</span>
          <Sparkles className="w-3 h-3 text-[#789A99] dark:text-[#F1E194] animate-spin" style={{ animationDuration: '4s' }} />
        </div>
      </div>
    </div>
  );
};
