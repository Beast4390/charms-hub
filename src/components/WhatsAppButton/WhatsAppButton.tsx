import React, { useState } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { getWhatsAppLink } from '../../services/storeConfig';

export const WhatsAppButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const { cart, subtotal } = useCart();

  const handleSend = () => {
    let orderDetails = '';
    if (cart.length > 0) {
      orderDetails = `\n\nItems in my Cart:\n` + cart.map(i => `- ${i.product.name} (x${i.quantity}) - ₹${i.product.price * i.quantity}`).join('\n') + `\nTotal: ₹${subtotal}`;
    }
    const fullText = encodeURIComponent(
      (message || 'Hello Charms Hub! I would like to inquire about your products.') + orderDetails
    );
    void getWhatsAppLink(decodeURIComponent(fullText)).then((url) => window.open(url, '_blank'));
    setIsOpen(false);
    setMessage('');
  };

  return (
    <div className="fixed bottom-24 right-6 z-40">
      {isOpen && (
        <div className="mb-3 w-80 bg-white dark:bg-[#5B0E14] rounded-2xl shadow-2xl border border-[#F3DDD5] dark:border-[#7A1921] p-4 text-[#2B1810] dark:text-[#FCF7DC] animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-[#F3DDD5] dark:border-[#7A1921]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                <MessageCircle className="w-4 h-4" />
              </div>
              <span className="font-bold text-sm">Charms Hub WhatsApp</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-stone-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-stone-300 my-2">
            Ask questions, inquire about orders, or send order packaging requests directly to our team.
          </p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message or order inquiry..."
            rows={2}
            className="w-full text-xs p-2.5 rounded-xl border border-[#F3DDD5] dark:border-[#7A1921] bg-[#FFF8F5] dark:bg-[#3F070B] focus:outline-hidden focus:ring-1 focus:ring-emerald-500 resize-none text-[#2B1810] dark:text-[#FCF7DC]"
          />
          <button
            onClick={handleSend}
            className="w-full mt-2 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Chat on WhatsApp</span>
          </button>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-13 h-13 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer"
        title="Chat on WhatsApp"
        aria-label="Chat on WhatsApp"
      >
        <MessageCircle className="w-7 h-7" />
      </button>
    </div>
  );
};
