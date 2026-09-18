import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ShieldCheck, Truck, RotateCcw, FileText, AlertCircle, Mail, MessageCircle } from 'lucide-react';

export const PolicyPage: React.FC = () => {
  const { type = 'returns' } = useParams<{ type: string }>();

  const tabs = [
    { id: 'returns', label: 'Return Policy' },
    { id: 'refund', label: 'Refund Policy' },
    { id: 'shipping', label: 'Shipping Policy' },
    { id: 'privacy', label: 'Privacy Policy' },
    { id: 'terms', label: 'Terms & Conditions' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif-display text-2xl sm:text-3xl font-bold text-[#2B1810] dark:text-[#FCF7DC]">
          Customer Support &amp; Store Policies
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-stone-300 mt-1">
          Official guidelines for shopping, shipping, unboxing verification, and returns at Charms Hub.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-[#F3DDD5] dark:border-[#7A1921] scrollbar-none">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            to={`/policy/${tab.id}`}
            className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition ${
              type === tab.id
                ? 'bg-[#789A99] text-white dark:bg-[#F1E194] dark:text-[#3F070B] shadow-xs'
                : 'bg-white dark:bg-[#5B0E14] text-[#2B1810] dark:text-[#FCF7DC] border border-[#F3DDD5] dark:border-[#7A1921] hover:bg-[#FFD2C2]/30'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Content Body */}
      <div className="bg-white dark:bg-[#5B0E14] rounded-3xl border border-[#F3DDD5] dark:border-[#7A1921] p-6 sm:p-8 shadow-xs space-y-6 text-sm leading-relaxed text-gray-700 dark:text-stone-300">
        
        {/* Returns & Damaged Claims */}
        {(type === 'returns' || type === 'refund') && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 pb-3 border-b border-[#F3DDD5] dark:border-[#7A1921]">
              <RotateCcw className="w-5 h-5 text-[#789A99] dark:text-[#F1E194]" />
              <h2 className="font-serif-display text-xl font-bold text-[#2B1810] dark:text-[#FCF7DC]">
                {type === 'returns' ? 'Return Policy' : 'Refund Policy'}
              </h2>
            </div>

            {/* Crucial Verification Callout */}
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <span className="font-bold text-sm block">Mandatory 360° Unboxing Video Requirement</span>
                <p>
                  To ensure protection against transit damage or missing pieces, you <strong>must record a clear, uncut 360-degree video</strong> when unboxing your package from the courier seal until the product is inspected.
                </p>
                <p>
                  Claims without an unboxing video submitted within <strong>24 to 48 hours</strong> of delivery cannot be entertained.
                </p>
              </div>
            </div>

            <div className="space-y-4 text-xs sm:text-sm">
              <h3 className="font-bold text-[#2B1810] dark:text-[#FCF7DC]">
                1. Eligibility for Replacement / Refund:
              </h3>
              <p>
                Returns are accepted strictly in the following cases:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Item arrived damaged in transit (validated via unboxing video).</li>
                <li>Incorrect item delivered compared to your verified order.</li>
                <li>Missing item reported within 48 hours with continuous unboxing proof.</li>
              </ul>

              <h3 className="font-bold text-[#2B1810] dark:text-[#FCF7DC] pt-2">
                2. Non-Returnable Items:
              </h3>
              <p>
                Due to hygiene standards and custom artisanal curation:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Earrings (including Kashmiri and bridal jhumkas) for hygiene reasons unless arrived broken.</li>
                <li>Mystery scoops (items inside scoops are randomized surprises and cannot be exchanged individually).</li>
                <li>Items without original tags and plastic packaging pouches.</li>
              </ul>

              <h3 className="font-bold text-[#2B1810] dark:text-[#FCF7DC] pt-2">
                3. Refund Processing:
              </h3>
              <p>
                Approved refunds are processed to your original UPI / Bank account within 5 to 7 business days after inspection.
              </p>
            </div>
          </div>
        )}

        {/* Shipping Policy */}
        {type === 'shipping' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 pb-3 border-b border-[#F3DDD5] dark:border-[#7A1921]">
              <Truck className="w-5 h-5 text-[#789A99] dark:text-[#F1E194]" />
              <h2 className="font-serif-display text-xl font-bold text-[#2B1810] dark:text-[#FCF7DC]">
                Shipping &amp; Delivery Policy
              </h2>
            </div>

            <div className="space-y-4 text-xs sm:text-sm">
              <h3 className="font-bold text-[#2B1810] dark:text-[#FCF7DC]">
                1. Free Shipping Threshold:
              </h3>
              <p>
                Enjoy <strong>FREE SHIPPING across India</strong> on all orders with a cart value of <strong>₹499 or above</strong>. Standard courier charges (₹50) apply for orders below ₹499.
              </p>

              <h3 className="font-bold text-[#2B1810] dark:text-[#FCF7DC] pt-2">
                2. Dispatch &amp; Delivery Timelines:
              </h3>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><strong>Order Dispatch:</strong> All orders are packed and dispatched within 24 to 48 business hours.</li>
                <li><strong>Delivery Window:</strong> Standard courier delivery takes <strong>4 to 7 business days</strong> across India.</li>
                <li>Tracking links are shared directly on WhatsApp upon shipment.</li>
              </ul>

              <h3 className="font-bold text-[#2B1810] dark:text-[#FCF7DC] pt-2">
                3. Instagram Packaging Stories:
              </h3>
              <p>
                Want to watch your order being packaged live? Enter your Instagram handle during checkout or message us on WhatsApp, and our team will feature your order packing video on our daily Instagram Story!
              </p>
            </div>
          </div>
        )}

        {/* Privacy Policy */}
        {type === 'privacy' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 pb-3 border-b border-[#F3DDD5] dark:border-[#7A1921]">
              <ShieldCheck className="w-5 h-5 text-[#789A99] dark:text-[#F1E194]" />
              <h2 className="font-serif-display text-xl font-bold text-[#2B1810] dark:text-[#FCF7DC]">
                Privacy Policy
              </h2>
            </div>
            <div className="space-y-4 text-xs sm:text-sm">
              <p>
                At Charms Hub, we respect your privacy. Customer contact details (name, phone number, shipping address, and email) are used solely for processing your orders, delivering packages, and sharing tracking updates.
              </p>
              <p>
                We never sell or distribute your private personal data to third-party marketing companies.
              </p>
            </div>
          </div>
        )}

        {/* Terms & Conditions */}
        {type === 'terms' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 pb-3 border-b border-[#F3DDD5] dark:border-[#7A1921]">
              <FileText className="w-5 h-5 text-[#789A99] dark:text-[#F1E194]" />
              <h2 className="font-serif-display text-xl font-bold text-[#2B1810] dark:text-[#FCF7DC]">
                Terms &amp; Conditions
              </h2>
            </div>
            <div className="space-y-4 text-xs sm:text-sm">
              <p>
                By placing an order on Charms Hub, you agree to these terms:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Prices are in Indian Rupees (INR) and are inclusive of relevant taxes.</li>
                <li>Handcrafted jewelry may have minor natural variations that enhance its unique artisanal value.</li>
                <li>Orders are confirmed after WhatsApp verification or payment clearance.</li>
              </ul>
            </div>
          </div>
        )}

        {/* Contact Strip */}
        <div className="pt-6 border-t border-[#F3DDD5] dark:border-[#7A1921] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-[#789A99] dark:text-[#F1E194]" />
            <span>Support: cloudfeaxxxx@gmail.com</span>
          </div>
          <a
            href="https://wa.me/919876543210"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>Chat on WhatsApp Support</span>
          </a>
        </div>
      </div>
    </div>
  );
};
