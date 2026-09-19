import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight, MessageCircle, Sparkles } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { getWhatsAppLink } from '../../services/storeConfig';

export const CartDrawer: React.FC = () => {
  const {
    cart,
    isOpen,
    closeCart,
    removeFromCart,
    updateQuantity,
    subtotal,
    totalItems,
    freeShippingThreshold,
    amountNeededForFreeShipping,
    isFreeShipping,
  } = useCart();
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleCheckout = () => {
    closeCart();
    navigate('/cart');
  };

  const handleWhatsAppOrder = () => {
    let orderDetails = '';
    if (cart.length > 0) {
      orderDetails = `\n\nItems in my Cart:\n` + cart.map(i => `- ${i.product.name} (x${i.quantity}) - ₹${i.product.price * i.quantity}`).join('\n') + `\nTotal: ₹${subtotal}`;
    }
    const text = encodeURIComponent(
      `Hello Charms Hub! I would like to place an order for the items in my cart:` + orderDetails
    );
    void getWhatsAppLink(decodeURIComponent(text)).then((url) => window.open(url, '_blank'));
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={closeCart}
        className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white dark:bg-[#5B0E14] shadow-2xl flex flex-col border-l border-[#F3DDD5] dark:border-[#7A1921] animate-in slide-in-from-right duration-300">
          
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-[#F3DDD5] dark:border-[#7A1921] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-[#789A99] dark:text-[#F1E194]" />
              <h2 className="font-serif-display font-bold text-lg text-[#2B1810] dark:text-[#FCF7DC]">
                Your Shopping Bag ({totalItems})
              </h2>
            </div>
            <button
              onClick={closeCart}
              className="p-2 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-stone-200"
              aria-label="Close cart"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Free Shipping Progress Indicator */}
          <div className="bg-[#FFF1EC] dark:bg-[#3F070B] p-3.5 border-b border-[#F3DDD5] dark:border-[#7A1921]">
            <div className="flex items-center justify-between text-xs font-bold mb-1.5 text-[#2B1810] dark:text-[#FCF7DC]">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#789A99] dark:text-[#F1E194]" />
                {isFreeShipping ? (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    You unlocked FREE SHIPPING!
                  </span>
                ) : (
                  <span>
                    Add ₹{amountNeededForFreeShipping} more for FREE SHIPPING
                  </span>
                )}
              </div>
              <span className="text-[11px] text-gray-500">Min: ₹{freeShippingThreshold}</span>
            </div>
            <div className="w-full h-2 bg-gray-200 dark:bg-[#7A1921] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#789A99] to-emerald-500 dark:from-[#F1E194] dark:to-emerald-400 transition-all duration-500 rounded-full"
                style={{
                  width: `${Math.min(100, (subtotal / freeShippingThreshold) * 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Items List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 divide-y divide-[#F3DDD5] dark:divide-[#7A1921]">
            {cart.length === 0 ? (
              <div className="py-20 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-[#FFF1EC] dark:bg-[#7A1921] flex items-center justify-center mx-auto text-[#789A99] dark:text-[#F1E194]">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#2B1810] dark:text-[#FCF7DC]">
                    Your bag is empty
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-stone-300 mt-1 max-w-xs mx-auto">
                    Explore our Kashmiri earrings, anti-tarnish bracelets, and mystery scoops to fill your bag!
                  </p>
                </div>
                <button
                  onClick={() => {
                    closeCart();
                    navigate('/products');
                  }}
                  className="px-6 py-2.5 rounded-full bg-[#FFD2C2] hover:bg-[#F5B8A3] dark:bg-[#7A1921] dark:hover:bg-[#8F1F28] text-xs font-bold text-[#2B1810] dark:text-[#F1E194] transition cursor-pointer"
                >
                  Start Shopping
                </button>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.product.id} className="py-4 flex gap-3 first:pt-0">
                  <img
                    src={item.product.image_url}
                    alt={item.product.name}
                    className="w-18 h-18 sm:w-20 sm:h-20 object-cover rounded-xl shrink-0 bg-gray-50"
                  />
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs sm:text-sm font-semibold text-[#2B1810] dark:text-[#FCF7DC] line-clamp-2">
                        {item.product.name}
                      </h4>
                      <div className="text-xs font-bold text-[#789A99] dark:text-[#F1E194] mt-1">
                        ₹{item.product.price}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      {/* Quantity Controls */}
                      <div className="flex items-center border border-[#F3DDD5] dark:border-[#7A1921] rounded-lg overflow-hidden bg-[#FFF8F5] dark:bg-[#3F070B]">
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          className="p-1 hover:bg-[#FFD2C2]/40 dark:hover:bg-[#7A1921] transition"
                        >
                          <Minus className="w-3 h-3 text-gray-600 dark:text-stone-300" />
                        </button>
                        <span className="px-2 text-xs font-bold text-[#2B1810] dark:text-[#FCF7DC]">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          className="p-1 hover:bg-[#FFD2C2]/40 dark:hover:bg-[#7A1921] transition"
                        >
                          <Plus className="w-3 h-3 text-gray-600 dark:text-stone-300" />
                        </button>
                      </div>

                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="p-1.5 text-red-500 hover:text-red-700 transition"
                        title="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer & Checkout */}
          {cart.length > 0 && (
            <div className="p-4 sm:p-5 border-t border-[#F3DDD5] dark:border-[#7A1921] bg-white dark:bg-[#5B0E14] space-y-3">
              <div className="space-y-1.5 text-xs text-gray-600 dark:text-stone-300">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-bold text-sm text-[#2B1810] dark:text-[#FCF7DC]">
                    ₹{subtotal}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Estimated Delivery</span>
                  <span>{isFreeShipping ? 'FREE' : 'Calculated at Checkout'}</span>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  onClick={handleCheckout}
                  className="w-full py-3 px-4 rounded-xl bg-[#789A99] hover:bg-[#587978] dark:bg-[#F1E194] dark:hover:bg-[#E3D1AC] text-white dark:text-[#3F070B] font-bold text-sm flex items-center justify-center gap-2 transition shadow-md cursor-pointer"
                >
                  <span>Proceed to Cart & Details</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={handleWhatsAppOrder}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-xs cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Order Inquiry via WhatsApp</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
