import { ActivityLog, UserRole } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';

/**
 * Audit logging. Identity (user_id / user_email / role) is authoritative:
 * a database trigger derives it from the authenticated session on every
 * insert, so client-supplied identity fields cannot forge audit entries.
 */
export async function logActivity(params: {
  userId: string;
  userEmail: string;
  role: UserRole;
  eventType: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}): Promise<ActivityLog | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  const candidate: ActivityLog = {
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

  // Best-effort: audit failures must never break the user flow. The insert
  // is checked and logged; identity fields are corrected server-side.
  const { data, error } = await supabase.from('activity_logs').insert([candidate]).select('*').maybeSingle();
  if (error || !data) {
    console.warn('Activity log insert failed:', error?.message);
    return null;
  }
  return data as unknown as ActivityLog;
}

export async function getActivityLogs(filter?: {
  role?: UserRole;
  eventType?: string;
  userId?: string;
  entityType?: string;
}): Promise<ActivityLog[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  let query = supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(100);
  if (filter?.role) query = query.eq('role', filter.role);
  if (filter?.eventType) query = query.eq('event_type', filter.eventType);
  if (filter?.userId) query = query.eq('user_id', filter.userId);
  if (filter?.entityType) query = query.eq('entity_type', filter.entityType);

  const { data, error } = await query;
  if (error) {
    console.error('Activity log query failed:', error.message);
    return [];
  }
  return (data ?? []) as unknown as ActivityLog[];
}

/** Legacy no-op: audit logs are immutable for clients; kept for API
 *  compatibility with older callers. */
export async function clearActivityLogs(): Promise<void> {
  try {
    localStorage.removeItem('charms_hub_activity_logs');
  } catch (err) {
    console.error('Failed to clear legacy local logs:', err);
  }
}
