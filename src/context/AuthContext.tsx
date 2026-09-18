import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { UserProfile, UserRole, PendingShoppingAction } from '../types';
import { logActivity } from '../services/activityLogger';

interface AuthContextType {
  user: UserProfile | null;
  role: UserRole;
  loading: boolean;
  signIn: (email: string, password?: string, roleOverride?: UserRole) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password?: string, fullName?: string, requestedRole?: UserRole) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  updateProfile: (profile: Partial<UserProfile>) => void;
  switchRole: (newRole: UserRole) => void;
  isAuthenticated: boolean;
  pendingAction: PendingShoppingAction | null;
  setPendingAction: (action: PendingShoppingAction | null) => void;
  clearPendingAction: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PENDING_ACTION_KEY = 'charms_hub_pending_shopping_action';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('charms_hub_auth_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          role: parsed.role || 'customer',
        };
      }
      return null;
    } catch {
      return null;
    }
  });

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

  useEffect(() => {
    const initAuth = async () => {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data } = await supabase.auth.getSession();
          if (data.session?.user) {
            const sbUser = data.session.user;
            const existingRole = (sbUser.user_metadata?.role as UserRole) || 'customer';
            const profile: UserProfile = {
              id: sbUser.id,
              email: sbUser.email || '',
              role: existingRole,
              full_name: sbUser.user_metadata?.full_name || 'Charms Hub User',
            };
            setUser(profile);
            localStorage.setItem('charms_hub_auth_user', JSON.stringify(profile));
          }
        } catch (err) {
          console.warn('Supabase session check error:', err);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const detectRoleFromEmail = (email: string, requestedRole?: UserRole): UserRole => {
    if (requestedRole) return requestedRole;
    const lower = email.toLowerCase();
    if (lower.includes('developer') || lower.includes('admin@') || lower.includes('dev@')) {
      return 'developer';
    }
    if (lower.includes('owner') || lower.includes('shop@') || lower.includes('store@')) {
      return 'shop_owner';
    }
    return 'customer';
  };

  const signIn = async (email: string, password?: string, roleOverride?: UserRole) => {
    setLoading(true);
    try {
      const assignedRole = detectRoleFromEmail(email, roleOverride);

      if (isSupabaseConfigured && supabase && password) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          setLoading(false);
          return { success: false, error: error.message };
        }
        if (data.user) {
          const role = (data.user.user_metadata?.role as UserRole) || assignedRole;
          const profile: UserProfile = {
            id: data.user.id,
            email: data.user.email || email,
            role,
            full_name: data.user.user_metadata?.full_name || email.split('@')[0],
          };
          setUser(profile);
          localStorage.setItem('charms_hub_auth_user', JSON.stringify(profile));

          await logActivity({
            userId: profile.id,
            userEmail: profile.email,
            role: profile.role,
            eventType: 'user_login',
            entityType: 'auth',
            entityId: profile.id,
            metadata: { method: 'supabase_auth' },
          });

          setLoading(false);
          return { success: true };
        }
      }

      // Local / Offline-Resilient fallback
      const localUser: UserProfile = {
        id: 'usr_' + Date.now(),
        email,
        role: assignedRole,
        full_name: email.split('@')[0],
      };
      setUser(localUser);
      localStorage.setItem('charms_hub_auth_user', JSON.stringify(localUser));

      await logActivity({
        userId: localUser.id,
        userEmail: localUser.email,
        role: localUser.role,
        eventType: 'user_login',
        entityType: 'auth',
        entityId: localUser.id,
        metadata: { method: 'resilient_local_auth', assigned_role: localUser.role },
      });

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
    requestedRole?: UserRole
  ) => {
    setLoading(true);
    try {
      const assignedRole = detectRoleFromEmail(email, requestedRole);

      if (isSupabaseConfigured && supabase && password) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, role: assignedRole },
          },
        });
        if (error) {
          setLoading(false);
          return { success: false, error: error.message };
        }
        if (data.user) {
          const profile: UserProfile = {
            id: data.user.id,
            email: data.user.email || email,
            role: assignedRole,
            full_name: fullName || email.split('@')[0],
          };
          setUser(profile);
          localStorage.setItem('charms_hub_auth_user', JSON.stringify(profile));

          await logActivity({
            userId: profile.id,
            userEmail: profile.email,
            role: profile.role,
            eventType: 'user_register',
            entityType: 'auth',
            entityId: profile.id,
            metadata: { method: 'supabase_auth' },
          });

          setLoading(false);
          return { success: true };
        }
      }

      // Local mock fallback
      const localUser: UserProfile = {
        id: 'usr_' + Date.now(),
        email,
        role: assignedRole,
        full_name: fullName || email.split('@')[0],
      };
      setUser(localUser);
      localStorage.setItem('charms_hub_auth_user', JSON.stringify(localUser));

      await logActivity({
        userId: localUser.id,
        userEmail: localUser.email,
        role: localUser.role,
        eventType: 'user_register',
        entityType: 'auth',
        entityId: localUser.id,
        metadata: { method: 'resilient_local_auth', role: localUser.role },
      });

      setLoading(false);
      return { success: true };
    } catch (err) {
      setLoading(false);
      return { success: false, error: err instanceof Error ? err.message : 'Registration failed' };
    }
  };

  const signOut = async () => {
    if (user) {
      await logActivity({
        userId: user.id,
        userEmail: user.email,
        role: user.role,
        eventType: 'user_logout',
        entityType: 'auth',
        entityId: user.id,
      });
    }

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Error signing out of Supabase:', err);
      }
    }
    setUser(null);
    localStorage.removeItem('charms_hub_auth_user');
  };

  const updateProfile = (updates: Partial<UserProfile>) => {
    if (!user) return;
    const updated = { ...user, ...updates };
    setUser(updated);
    localStorage.setItem('charms_hub_auth_user', JSON.stringify(updated));
  };

  const switchRole = (newRole: UserRole) => {
    if (!user) {
      // Create guest demo user with this role
      const demoUser: UserProfile = {
        id: `demo_${newRole}_${Date.now()}`,
        email: `${newRole}@charmshub.ai`,
        role: newRole,
        full_name: newRole === 'shop_owner' ? 'Shop Owner' : newRole === 'developer' ? 'Lead Developer' : 'Valued Shopper',
      };
      setUser(demoUser);
      localStorage.setItem('charms_hub_auth_user', JSON.stringify(demoUser));
      return;
    }

    const updated: UserProfile = {
      ...user,
      role: newRole,
    };
    setUser(updated);
    localStorage.setItem('charms_hub_auth_user', JSON.stringify(updated));

    logActivity({
      userId: user.id,
      userEmail: user.email,
      role: newRole,
      eventType: 'role_switched',
      entityType: 'auth',
      entityId: user.id,
      metadata: { previous_role: user.role, new_role: newRole },
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
        switchRole,
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
