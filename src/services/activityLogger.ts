import { ActivityLog, UserRole } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';

const STORAGE_KEY = 'charms_hub_activity_logs';

export async function logActivity(params: {
  userId: string;
  userEmail: string;
  role: UserRole;
  eventType: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}): Promise<ActivityLog> {
  const newLog: ActivityLog = {
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    user_id: params.userId,
    user_email: params.userEmail,
    role: params.role,
    event_type: params.eventType,
    entity_type: params.entityType,
    entity_id: params.entityId,
    metadata: params.metadata || {},
    created_at: new Date().toISOString(),
  };

  // 1. Try Supabase if configured
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('activity_logs').insert([newLog]);
    } catch (err) {
      console.warn('Failed to insert log to Supabase, saving to local audit store:', err);
    }
  }

  // 2. Always persist to resilient local audit store
  try {
    const existing: ActivityLog[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    // Keep last 500 logs
    const updated = [newLog, ...existing].slice(0, 500);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to persist activity log locally:', err);
  }

  return newLog;
}

export async function getActivityLogs(filter?: {
  role?: UserRole;
  eventType?: string;
  userId?: string;
  entityType?: string;
}): Promise<ActivityLog[]> {
  // 1. Try Supabase if configured
  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(100);
      if (filter?.role) query = query.eq('role', filter.role);
      if (filter?.eventType) query = query.eq('event_type', filter.eventType);
      if (filter?.userId) query = query.eq('user_id', filter.userId);
      if (filter?.entityType) query = query.eq('entity_type', filter.entityType);

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return data as ActivityLog[];
      }
    } catch (err) {
      console.warn('Supabase logs query failed, reading local store:', err);
    }
  }

  // 2. Read local audit store
  try {
    const raw: ActivityLog[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return raw.filter((log) => {
      if (filter?.role && log.role !== filter.role) return false;
      if (filter?.eventType && log.event_type !== filter.eventType) return false;
      if (filter?.userId && log.user_id !== filter.userId) return false;
      if (filter?.entityType && log.entity_type !== filter.entityType) return false;
      return true;
    });
  } catch {
    return [];
  }
}

export async function clearActivityLogs(): Promise<void> {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear logs:', err);
  }
}

