import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { storeCatalog } from '../../services/storeCatalog';
import { Sparkles, Mail, Lock, ArrowRight, UserCheck, Shield, ShoppingBag } from 'lucide-react';
import { UserRole } from '../../types';

export const LoginPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, pendingAction, clearPendingAction } = useAuth();
  const { addToCart } = useCart();
  const navigate = useNavigate();

  const redirectParam = searchParams.get('redirect');
  const actionParam = searchParams.get('action');

  const handlePostAuthRedirect = () => {
    if (pendingAction) {
      const prod = storeCatalog.getProductById(pendingAction.productId);
      if (prod) {
        addToCart(prod, pendingAction.quantity, pendingAction.variant);
      }
      const destination = pendingAction.action === 'buy_now' ? '/cart' : pendingAction.returnUrl || '/products';
      clearPendingAction();
      navigate(destination, { replace: true });
      return;
    }

    if (redirectParam) {
      navigate(redirectParam, { replace: true });
    } else {
      navigate('/account', { replace: true });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await signIn(email, password);
    setLoading(false);
    if (res.success) {
      handlePostAuthRedirect();
    } else {
      setError(res.error || 'Failed to sign in');
    }
  };

  const handleQuickDemoLogin = async (role: UserRole) => {
    setError('');
    setLoading(true);
    const demoEmail =
      role === 'shop_owner'
        ? 'owner@charmshub.ai'
        : role === 'developer'
        ? 'developer@charmshub.ai'
        : 'shopper@charmshub.ai';

    const res = await signIn(demoEmail, 'demo1234', role);
    setLoading(false);
    if (res.success) {
      handlePostAuthRedirect();
    } else {
      setError(res.error || 'Failed to sign in as demo role');
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#5B0E14] border border-[#F3DDD5] dark:border-[#7A1921] shadow-lg space-y-6">
        
        {/* Auth Gate Announcement Banner */}
        {pendingAction && (
          <div className="p-3.5 bg-[#FFF1EC] dark:bg-[#7A1921]/60 border border-[#FFD2C2] dark:border-[#8F1F28] rounded-2xl flex items-start gap-2.5 text-xs text-[#2B1810] dark:text-[#FCF7DC]">
            <ShoppingBag className="w-4 h-4 text-[#789A99] dark:text-[#F1E194] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Authentication Required</p>
              <p className="text-[11px] opacity-90 mt-0.5">
                Sign in to add your item to the bag and proceed with checkout. Your selection will be resumed automatically!
              </p>
            </div>
          </div>
        )}

        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-[#FFD2C2] dark:bg-[#7A1921] flex items-center justify-center text-[#789A99] dark:text-[#F1E194] mx-auto shadow-xs">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="font-serif-display text-2xl font-bold text-[#2B1810] dark:text-[#FCF7DC]">
            Welcome to Charms Hub
          </h1>
          <p className="text-xs text-gray-500 dark:text-stone-300">
            Sign in to access your orders, invoices, and role-based workspace.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-300 text-xs">
            {error}
          </div>
        )}

        {/* Standard Sign In Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-gray-700 dark:text-stone-300 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#F3DDD5] dark:border-[#7A1921] bg-[#FFF8F5] dark:bg-[#3F070B] text-[#2B1810] dark:text-[#FCF7DC] focus:outline-hidden focus:ring-1 focus:ring-[#789A99]"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-gray-700 dark:text-stone-300 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#F3DDD5] dark:border-[#7A1921] bg-[#FFF8F5] dark:bg-[#3F070B] text-[#2B1810] dark:text-[#FCF7DC] focus:outline-hidden focus:ring-1 focus:ring-[#789A99]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-[#789A99] hover:bg-[#587978] dark:bg-[#F1E194] dark:hover:bg-[#E3D1AC] text-white dark:text-[#3F070B] font-bold text-xs flex items-center justify-center gap-2 transition shadow-md cursor-pointer"
          >
            <span>{loading ? 'Signing in...' : 'Sign In'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Fast 1-Click Role Testing / Hackathon Review */}
        <div className="pt-2 border-t border-[#F3DDD5] dark:border-[#7A1921]/60 space-y-2.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-center text-gray-500 dark:text-stone-400">
            Quick 1-Click Role Access
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleQuickDemoLogin('customer')}
              className="py-2 px-1 rounded-xl bg-[#FFF8F5] dark:bg-[#3F070B] border border-[#F3DDD5] dark:border-[#7A1921] text-[11px] font-bold text-[#2B1810] dark:text-[#FCF7DC] hover:border-[#789A99] transition flex flex-col items-center gap-1 cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5 text-[#789A99]" />
              <span>Customer</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemoLogin('shop_owner')}
              className="py-2 px-1 rounded-xl bg-[#FFF8F5] dark:bg-[#3F070B] border border-[#F3DDD5] dark:border-[#7A1921] text-[11px] font-bold text-[#2B1810] dark:text-[#FCF7DC] hover:border-[#789A99] transition flex flex-col items-center gap-1 cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-[#E91E63]" />
              <span>Shop Owner</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemoLogin('developer')}
              className="py-2 px-1 rounded-xl bg-[#FFF8F5] dark:bg-[#3F070B] border border-[#F3DDD5] dark:border-[#7A1921] text-[11px] font-bold text-[#2B1810] dark:text-[#FCF7DC] hover:border-[#789A99] transition flex flex-col items-center gap-1 cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5 text-[#F1E194]" />
              <span>Developer</span>
            </button>
          </div>
        </div>

        <div className="text-center pt-2 text-xs text-gray-500 dark:text-stone-400">
          Don&apos;t have an account?{' '}
          <Link
            to={`/auth/register${redirectParam ? `?redirect=${encodeURIComponent(redirectParam)}` : ''}`}
            className="font-bold text-[#789A99] dark:text-[#F1E194] hover:underline"
          >
            Create one now
          </Link>
        </div>
      </div>
    </div>
  );
};
