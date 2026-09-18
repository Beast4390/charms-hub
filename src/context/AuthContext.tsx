import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { UserProfile, UserRole, PendingShoppingAction } from '../types';
import { logActivity } from '../services/activityLogger';

interface AuthResult {
  success: boolean;
  error?: string;
  /** True when the account was created but the session is pending email confirmation. */
  needsEmailConfirmation?: boolean;
}

interface AuthContextType {
  user: UserProfile | null;
  role: UserRole;
  loading: boolean;
  /**
   * Supabase Auth is the single source of truth. The roleOverride parameter
   * is accepted for demo-login compatibility but is IGNORED — the role is
   * always read from the database-backed user_profiles row.
   */
  signIn: (email: string, password?: string, roleOverride?: UserRole) => Promise<AuthResult>;
  /**
   * Roles are assigned server-side (signup trigger defaults to 'customer').
   * requestedRole is accepted for signature compatibility but is IGNORED.
   */
  signUp: (email: string, password?: string, fullName?: string, requestedRole?: UserRole) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  updateProfile: (profile: Partial<UserProfile>) => void;
  isAuthenticated: boolean;
  pendingAction: PendingShoppingAction | null;
  setPendingAction: (action: PendingShoppingAction | null) => void;
  clearPendingAction: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PENDING_ACTION_KEY = 'charms_hub_pending_shopping_action';
// Legacy key written by the pre-Phase A local-fallback auth. Stale cached
// profiles (and their client-assigned roles) must never be trusted again.
const LEGACY_AUTH_CACHE_KEY = 'charms_hub_auth_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [pendingAction, setPendingActionState] = useState<PendingShoppingAction | null>(() => {
    try {
      const saved = sessionStorage.getItem(PENDING_ACTION_KEY);
      if (saved) {
        const parsed: PendingShoppingAction = JSON.parse(saved);
        // Expiry 30 mins
        if (Date.now() - parsed.timestamp < 30 * 60 * 1000) {
          return parsed;
        }
        sessionStorage.removeItem(PENDING_ACTION_KEY);
      }
      return null;
    } catch {
      return null;
    }
  });

  const setPendingAction = (action: PendingShoppingAction | null) => {
    setPendingActionState(action);
    if (action) {
      sessionStorage.setItem(PENDING_ACTION_KEY, JSON.stringify(action));
    } else {
      sessionStorage.removeItem(PENDING_ACTION_KEY);
    }
  };

  const clearPendingAction = () => {
    setPendingAction(null);
  };

  const applySession = useCallback(async (session: Session | null): Promise<UserProfile | null> => {
    if (!session?.user) {
      setUser(null);
      setLoading(false);
      return null;
    }

    const sbUser = session.user;
    // Least-privilege baseline from the verified JWT; DB values take precedence.
    let profile: UserProfile = {
      id: sbUser.id,
      email: sbUser.email || '',
      role: 'customer',
      full_name:
        (sbUser.user_metadata?.full_name as string) ||
        sbUser.email?.split('@')[0] ||
        'Charms Hub User',
    };

    if (supabase) {
      // Role and profile details come from the database-backed user_profiles
      // row — the authoritative authorization source (readable via RLS
      // "Users can view own profile").
      const { data, error } = await supabase
        .from('user_profiles')
        .select('role, full_name, phone, shipping_address')
        .eq('id', sbUser.id)
        .maybeSingle();

      if (!error && data) {
        profile = {
          ...profile,
          role: (data.role as UserRole) || 'customer',
          full_name: data.full_name || profile.full_name,
          phone: data.phone || undefined,
          shipping_address: data.shipping_address || undefined,
        };
      } else if (error) {
        console.warn('[Auth] user_profiles unavailable, using customer role:', error.message);
      }
    }

    setUser(profile);
    setLoading(false);
    return profile;
  }, []);

  useEffect(() => {
    // Purge the legacy local-auth cache from older app versions.
    try {
      localStorage.removeItem(LEGACY_AUTH_CACHE_KEY);
    } catch {
      /* ignore */
    }

    if (!isSupabaseConfigured || !supabase) {
      // Supabase Auth is authoritative; without it there is no authentication.
      setLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) applySession(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setLoading(false);
      } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
        applySession(session);
      }
      // INITIAL_SESSION is handled by the explicit getSession() call above.
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [applySession]);

  const signIn = async (email: string, password?: string, _roleOverride?: UserRole): Promise<AuthResult> => {
    setLoading(true);
    try {
      if (!supabase) {
        setLoading(false);
        return {
          success: false,
          error: 'Authentication is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable sign-in.',
        };
      }
      if (!password) {
        setLoading(false);
        return { success: false, error: 'Password is required.' };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error || !data.user || !data.session) {
        setLoading(false);
        return { success: false, error: error?.message || 'Sign in failed' };
      }

      // Apply the profile immediately (before onAuthStateChange fires) so
      // post-login navigation sees an authenticated user.
      const profile = await applySession(data.session);

      logActivity({
        userId: data.user.id,
        userEmail: data.user.email || email,
        role: profile?.role || 'customer',
        eventType: 'user_login',
        entityType: 'auth',
        entityId: data.user.id,
        metadata: { method: 'supabase_auth' },
      }).catch(() => undefined);

      setLoading(false);
      return { success: true };
    } catch (err) {
      setLoading(false);
      return { success: false, error: err instanceof Error ? err.message : 'Sign in failed' };
    }
  };

  const signUp = async (
    email: string,
    password?: string,
    fullName?: string,
    _requestedRole?: UserRole
  ): Promise<AuthResult> => {
    setLoading(true);
    try {
      if (!supabase) {
        setLoading(false);
        return {
          success: false,
          error: 'Authentication is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable registration.',
        };
      }
      if (!password || password.length < 6) {
        setLoading(false);
        return { success: false, error: 'Password must be at least 6 characters.' };
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName || '' },
        },
      });

      if (error) {
        setLoading(false);
        return { success: false, error: error.message };
      }

      if (!data.user) {
        setLoading(false);
        return { success: false, error: 'Registration failed. Please try again.' };
      }

      // Server-side trigger creates the user_profiles row (role 'customer').
      if (!data.session) {
        // Email confirmation is enabled on this project.
        setLoading(false);
        return { success: true, needsEmailConfirmation: true };
      }

      await applySession(data.session);

      logActivity({
        userId: data.user.id,
        userEmail: data.user.email || email,
        role: 'customer',
        eventType: 'user_register',
        entityType: 'auth',
        entityId: data.user.id,
        metadata: { method: 'supabase_auth' },
      }).catch(() => undefined);

      setLoading(false);
      return { success: true };
    } catch (err) {
      setLoading(false);
      return { success: false, error: err instanceof Error ? err.message : 'Registration failed' };
    }
  };

  const signOut = async () => {
    if (user) {
      logActivity({
        userId: user.id,
        userEmail: user.email,
        role: user.role,
        eventType: 'user_logout',
        entityType: 'auth',
        entityId: user.id,
      }).catch(() => undefined);
    }

    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Error signing out of Supabase:', err);
      }
    }
    setUser(null);
  };

  const updateProfile = (updates: Partial<UserProfile>) => {
    if (!user) return;
    const previous = user;

    // Optimistic update, reconciled with the database result.
    setUser({ ...user, ...updates });

    if (!supabase) return;

    const patch: Record<string, unknown> = {};
    if (updates.full_name !== undefined) patch.full_name = updates.full_name;
    if (updates.phone !== undefined) patch.phone = updates.phone;
    if (updates.shipping_address !== undefined) patch.shipping_address = updates.shipping_address;
    if (Object.keys(patch).length === 0) return;

    supabase
      .from('user_profiles')
      .update(patch)
      .eq('id', user.id)
      .select('role, full_name, phone, shipping_address')
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          console.warn('Profile update failed, reverting:', error?.message);
          setUser(previous);
          return;
        }
        setUser((prev) =>
          prev
            ? {
                ...prev,
                role: (data.role as UserRole) || prev.role,
                full_name: data.full_name || prev.full_name,
                phone: data.phone || prev.phone,
                shipping_address: data.shipping_address || prev.shipping_address,
              }
            : prev
        );
      });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || 'customer',
        loading,
        signIn,
        signUp,
        signOut,
        updateProfile,
        isAuthenticated: Boolean(user),
        pendingAction,
        setPendingAction,
        clearPendingAction,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
