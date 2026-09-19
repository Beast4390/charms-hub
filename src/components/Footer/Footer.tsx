import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Instagram, Sparkles, ShieldCheck, Heart } from 'lucide-react';
import { getStoreConfig, STORE_CONFIG_KEYS } from '../../services/storeConfig';

export const Footer: React.FC = () => {
  const [supportEmail, setSupportEmail] = useState<string | null>(null);

  useEffect(() => {
    void getStoreConfig(STORE_CONFIG_KEYS.supportEmail).then((email) => {
      const normalizedEmail = email?.trim() || '';
      setSupportEmail(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ? normalizedEmail : null);
    });
  }, []);

  return (
    <footer className="bg-white dark:bg-[#3F070B] border-t border-[#F3DDD5] dark:border-[#7A1921] transition-colors duration-200 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Brand & About */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#FFD2C2] dark:bg-[#7A1921] flex items-center justify-center text-[#789A99] dark:text-[#F1E194]">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="font-serif-display font-bold text-2xl text-[#2B1810] dark:text-[#F1E194]">
                Charms Hub
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-stone-300 max-w-md leading-relaxed">
              Your destination for handcrafted Kashmiri earrings, anti-tarnish jewelry, whimsical mystery scoops, quirky stationery, organizers, and hair charms.
            </p>
            <div className="flex items-center gap-3 pt-2">
              {supportEmail ? (
                <a
                  href={`mailto:${supportEmail}`}
                  className="inline-flex items-center gap-2 text-xs font-semibold text-[#2B1810] dark:text-[#FCF7DC] bg-[#FFF1EC] dark:bg-[#7A1921] px-3.5 py-2 rounded-full hover:bg-[#FFD2C2] dark:hover:bg-[#8F1F28] transition"
                >
                  <Mail className="w-3.5 h-3.5 text-[#789A99] dark:text-[#F1E194]" />
                  <span>{supportEmail}</span>
                </a>
              ) : (
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-stone-400 bg-[#FFF1EC] dark:bg-[#7A1921] px-3.5 py-2 rounded-full">
                  <Mail className="w-3.5 h-3.5" />
                  <span>Support email unavailable</span>
                </span>
              )}
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 p-2 rounded-full text-pink-600 bg-pink-50 dark:bg-[#7A1921] hover:scale-105 transition"
                title="Follow on Instagram"
              >
                <Instagram className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#789A99] dark:text-[#F1E194] mb-4">
              Explore
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/" className="text-gray-600 dark:text-stone-300 hover:text-[#789A99] dark:hover:text-[#F1E194] transition">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/products" className="text-gray-600 dark:text-stone-300 hover:text-[#789A99] dark:hover:text-[#F1E194] transition">
                  All Products
                </Link>
              </li>
              <li>
                <Link to="/categories" className="text-gray-600 dark:text-stone-300 hover:text-[#789A99] dark:hover:text-[#F1E194] transition">
                  Categories
                </Link>
              </li>
              <li>
                <Link to="/products?category=mystery-scoop" className="text-gray-600 dark:text-stone-300 hover:text-[#789A99] dark:hover:text-[#F1E194] transition">
                  Mystery Scoops
                </Link>
              </li>
              <li>
                <Link to="/products?category=earrings" className="text-gray-600 dark:text-stone-300 hover:text-[#789A99] dark:hover:text-[#F1E194] transition">
                  Kashmiri Earrings
                </Link>
              </li>
            </ul>
          </div>

          {/* Customer Care / Policies */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#789A99] dark:text-[#F1E194] mb-4">
              Policies & Support
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/policy/privacy" className="text-gray-600 dark:text-stone-300 hover:text-[#789A99] dark:hover:text-[#F1E194] transition">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/policy/terms" className="text-gray-600 dark:text-stone-300 hover:text-[#789A99] dark:hover:text-[#F1E194] transition">
                  Terms and Conditions
                </Link>
              </li>
              <li>
                <Link to="/policy/returns" className="text-gray-600 dark:text-stone-300 hover:text-[#789A99] dark:hover:text-[#F1E194] transition">
                  Return Policy
                </Link>
              </li>
              <li>
                <Link to="/policy/refund" className="text-gray-600 dark:text-stone-300 hover:text-[#789A99] dark:hover:text-[#F1E194] transition">
                  Refund Policy
                </Link>
              </li>
              <li>
                <Link to="/policy/shipping" className="text-gray-600 dark:text-stone-300 hover:text-[#789A99] dark:hover:text-[#F1E194] transition">
                  Shipping Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-[#F3DDD5] dark:border-[#7A1921] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500 dark:text-stone-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Verified Charms Hub Storefront</span>
          </div>
          <div className="text-center sm:text-right">
            &copy; 2026 Charms Hub. All rights reserved. Built for X-Factor LevelX Hackathon.
          </div>
        </div>
      </div>
    </footer>
  );
};
