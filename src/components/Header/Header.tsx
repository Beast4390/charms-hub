import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShoppingBag, User, Sun, Moon, Menu, X, Sparkles, LayoutDashboard, Shield } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

export const Header: React.FC = () => {
  const { totalItems, openCart } = useCart();
  const { theme, toggleTheme } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#5B0E14]/95 backdrop-blur-md border-b border-[#F3DDD5] dark:border-[#7A1921] transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          
          {/* Mobile menu button */}
          <div className="flex items-center md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-[#2B1810] dark:text-[#FCF7DC] hover:bg-[#FFD2C2]/40 dark:hover:bg-[#7A1921] transition"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Logo / Brand */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-[#FFD2C2] dark:bg-[#7A1921] flex items-center justify-center text-[#789A99] dark:text-[#F1E194] shadow-xs group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-serif-display font-bold text-xl md:text-2xl tracking-tight text-[#2B1810] dark:text-[#F1E194]">
                Charms Hub
              </span>
              <span className="text-[9px] uppercase tracking-widest font-bold text-[#789A99] dark:text-[#E3D1AC] -mt-1">
                Aesthetic Jewelry &amp; Gifts
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-7">
            <Link
              to="/"
              className={`text-sm font-semibold transition-colors ${
                isActive('/')
                  ? 'text-[#789A99] dark:text-[#F1E194] underline decoration-2 underline-offset-8'
                  : 'text-[#2B1810] dark:text-[#FCF7DC] hover:text-[#789A99] dark:hover:text-[#F1E194]'
              }`}
            >
              Home
            </Link>
            <Link
              to="/products"
              className={`text-sm font-semibold transition-colors ${
                isActive('/products')
                  ? 'text-[#789A99] dark:text-[#F1E194] underline decoration-2 underline-offset-8'
                  : 'text-[#2B1810] dark:text-[#FCF7DC] hover:text-[#789A99] dark:hover:text-[#F1E194]'
              }`}
            >
              Products
            </Link>
            <Link
              to="/categories"
              className={`text-sm font-semibold transition-colors ${
                isActive('/categories')
                  ? 'text-[#789A99] dark:text-[#F1E194] underline decoration-2 underline-offset-8'
                  : 'text-[#2B1810] dark:text-[#FCF7DC] hover:text-[#789A99] dark:hover:text-[#F1E194]'
              }`}
            >
              Categories
            </Link>

            {/* Role-based Privileged Links */}
            {(user?.role === 'shop_owner' || user?.role === 'developer') && (
              <Link
                to="/owner"
                className={`text-sm font-bold transition-colors flex items-center gap-1.5 px-3 py-1 rounded-full ${
                  isActive('/owner')
                    ? 'bg-[#E91E63] text-white'
                    : 'bg-[#FFD2C2]/40 dark:bg-[#7A1921] text-[#E91E63] dark:text-[#F1E194] hover:bg-[#FFD2C2]'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Shop Owner</span>
              </Link>
            )}

            {user?.role === 'developer' && (
              <Link
                to="/developer"
                className={`text-sm font-bold transition-colors flex items-center gap-1.5 px-3 py-1 rounded-full ${
                  isActive('/developer')
                    ? 'bg-[#789A99] text-white'
                    : 'bg-[#789A99]/15 text-[#789A99] dark:text-[#F1E194] hover:bg-[#789A99]/30'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Dev Console</span>
              </Link>
            )}
          </nav>

          {/* Action Icons Right */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-full text-[#2B1810] dark:text-[#F1E194] hover:bg-[#FFD2C2]/40 dark:hover:bg-[#7A1921] transition shadow-xs cursor-pointer"
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? (
                <Moon className="w-5 h-5 text-[#2B1810]" />
              ) : (
                <Sun className="w-5 h-5 text-[#F1E194]" />
              )}
            </button>

            {/* Account / Auth */}
            <Link
              to={isAuthenticated ? '/account' : '/auth/login'}
              className="p-2 sm:px-3 sm:py-2 rounded-full text-[#2B1810] dark:text-[#FCF7DC] hover:bg-[#FFD2C2]/40 dark:hover:bg-[#7A1921] transition flex items-center gap-1.5 border border-transparent hover:border-[#F3DDD5] dark:hover:border-[#7A1921]"
              title={isAuthenticated ? `Account (${user?.full_name})` : 'Sign in'}
            >
              <User className="w-5 h-5 text-[#789A99] dark:text-[#F1E194]" />
              {isAuthenticated && (
                <div className="hidden lg:flex flex-col text-left">
                  <span className="text-xs font-semibold max-w-[80px] truncate leading-tight">
                    {user?.full_name?.split(' ')[0]}
                  </span>
                  <span className="text-[9px] uppercase font-extrabold text-[#789A99] dark:text-[#F1E194] leading-tight">
                    {user?.role === 'shop_owner' ? 'Owner' : user?.role === 'developer' ? 'Dev' : 'Member'}
                  </span>
                </div>
              )}
            </Link>

            {/* Cart Icon with Counter */}
            <button
              onClick={openCart}
              className="relative p-2.5 rounded-full bg-[#FFD2C2]/50 dark:bg-[#7A1921] text-[#2B1810] dark:text-[#F1E194] hover:bg-[#FFD2C2] dark:hover:bg-[#8F1F28] transition shadow-xs group cursor-pointer"
              aria-label="Open Shopping Cart"
            >
              <ShoppingBag className="w-5 h-5 group-hover:scale-105 transition-transform" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#C2185B] dark:bg-[#F1E194] text-white dark:text-[#3F070B] text-[10px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white dark:border-[#5B0E14] shadow-sm animate-bounce">
                  {totalItems > 99 ? '99+' : totalItems}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#F3DDD5] dark:border-[#7A1921] bg-white dark:bg-[#5B0E14] px-4 pt-3 pb-6 space-y-2">
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className={`block px-3 py-2 rounded-xl text-base font-medium ${
              isActive('/')
                ? 'bg-[#FFD2C2] dark:bg-[#7A1921] text-[#2B1810] dark:text-[#F1E194] font-bold'
                : 'text-[#2B1810] dark:text-[#FCF7DC] hover:bg-gray-50 dark:hover:bg-[#7A1921]/50'
            }`}
          >
            Home
          </Link>
          <Link
            to="/products"
            onClick={() => setMobileMenuOpen(false)}
            className={`block px-3 py-2 rounded-xl text-base font-medium ${
              isActive('/products')
                ? 'bg-[#FFD2C2] dark:bg-[#7A1921] text-[#2B1810] dark:text-[#F1E194] font-bold'
                : 'text-[#2B1810] dark:text-[#FCF7DC] hover:bg-gray-50 dark:hover:bg-[#7A1921]/50'
            }`}
          >
            All Products
          </Link>
          <Link
            to="/categories"
            onClick={() => setMobileMenuOpen(false)}
            className={`block px-3 py-2 rounded-xl text-base font-medium ${
              isActive('/categories')
                ? 'bg-[#FFD2C2] dark:bg-[#7A1921] text-[#2B1810] dark:text-[#F1E194] font-bold'
                : 'text-[#2B1810] dark:text-[#FCF7DC] hover:bg-gray-50 dark:hover:bg-[#7A1921]/50'
            }`}
          >
            Categories
          </Link>

          {(user?.role === 'shop_owner' || user?.role === 'developer') && (
            <Link
              to="/owner"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-xl text-base font-bold bg-[#E91E63]/15 text-[#E91E63] dark:text-[#F1E194]"
            >
              Shop Owner Dashboard
            </Link>
          )}

          {user?.role === 'developer' && (
            <Link
              to="/developer"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-xl text-base font-bold bg-[#789A99]/15 text-[#789A99] dark:text-[#F1E194]"
            >
              Developer Console
            </Link>
          )}

          <Link
            to={isAuthenticated ? '/account' : '/auth/login'}
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-xl text-base font-medium text-[#2B1810] dark:text-[#FCF7DC] hover:bg-gray-50 dark:hover:bg-[#7A1921]/50"
          >
            {isAuthenticated ? 'My Account & Invoices' : 'Sign In'}
          </Link>
        </div>
      )}
    </header>
  );
};
