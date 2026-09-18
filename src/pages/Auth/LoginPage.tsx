import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { storeCatalog } from '../../services/storeCatalog';
import { supabase, isSupabaseConfigured } from '../../services/supabase';
import { Sparkles, Mail, Lock, ArrowRight, ShoppingBag, KeyRound } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
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
    setNotice('');
    setLoading(true);

    const res = await signIn(email, password);
    setLoading(false);
    if (res.success) {
      handlePostAuthRedirect();
    } else {
      setError(res.error || 'Failed to sign in');
    }
  };

  const handleForgotPassword = async () => {
    setError('');
    setNotice('');
    if (!email.trim()) {
      setError('Enter your email address above first, then tap "Forgot password?".');
      return;
    }
    if (!isSupabaseConfigured || !supabase) {
      setError('Password reset is unavailable: cloud services are not configured.');
      return;
    }
    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + '/auth/login',
    });
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
    } else {
      setNotice('Password reset link sent! Check your inbox and follow the email instructions.');
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

        {notice && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs">
            {notice}
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

          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={loading}
            className="w-full flex items-center justify-center gap-1.5 text-[11px] font-bold text-[#789A99] dark:text-[#F1E194] hover:underline cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Forgot password?</span>
          </button>
        </form>

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
