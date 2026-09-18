import { supabase, isSupabaseConfigured } from './supabase';
import { KnowledgeItem } from '../types';

/** Owner knowledge-base management (RLS: admin write, public read active). */

export interface KnowledgeStatus {
  total: number;
  active: number;
  indexed: number;
  pending: number;
  failed: number;
  lastIndexedAt: string | null;
}

export async function listKnowledge(): Promise<KnowledgeItem[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('knowledge_base')
    .select('id,title,content,category,source,metadata,embedding_status,indexed_at,is_active,updated_at')
    .order('category', { ascending: true });
  if (error) {
    console.error('Failed to list knowledge:', error.message);
    return [];
  }
  return (data ?? []) as unknown as KnowledgeItem[];
}

export interface KnowledgeInput {
  title: string;
  content: string;
  category: string;
  source: string;
  is_active?: boolean;
}

function validateKnowledgeInput(input: Partial<KnowledgeInput>): string | null {
  if (!input.title?.trim()) return 'A title is required.';
  if (!input.content?.trim() || input.content.trim().length < 10) return 'Content must be at least 10 characters.';
  if (!input.category?.trim()) return 'A category is required.';
  if (!input.source?.trim()) return 'A source is required — knowledge must be traceable to verified information.';
  return null;
}

export async function addKnowledge(
  input: KnowledgeInput,
  id?: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) return { success: false, error: 'Cloud services are not configured.' };
  const invalid = validateKnowledgeInput(input);
  if (invalid) return { success: false, error: invalid };

  const knowledgeId = id ?? `kb-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const { error } = await supabase.from('knowledge_base').upsert({
    id: knowledgeId,
    title: input.title.trim(),
    content: input.content.trim(),
    category: input.category.trim(),
    source: input.source.trim(),
    is_active: input.is_active ?? true,
    embedding_status: 'pending',
    updated_at: new Date().toISOString(),
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function updateKnowledge(id: string, updates: Partial<KnowledgeInput>): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) return { success: false, error: 'Cloud services are not configured.' };
  const invalid = validateKnowledgeInput({ title: updates.title ?? 'x', content: updates.content ?? 'xxxxxxxxxxxx', category: updates.category ?? 'general', source: updates.source ?? 'x' });
  if (updates.title !== undefined && invalid) return { success: false, error: invalid };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.title !== undefined) patch.title = updates.title.trim();
  if (updates.content !== undefined) patch.content = updates.content.trim();
  if (updates.category !== undefined) patch.category = updates.category.trim();
  if (updates.source !== undefined) patch.source = updates.source.trim();
  if (updates.is_active !== undefined) patch.is_active = updates.is_active;
  // Content changes invalidate the stored embedding until re-indexed.
  if (updates.content !== undefined) patch.embedding_status = 'pending';

  const { error } = await supabase.from('knowledge_base').update(patch).eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function deleteKnowledge(id: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) return { success: false, error: 'Cloud services are not configured.' };
  const { error } = await supabase.from('knowledge_base').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/** Calls the embed-knowledge Edge Function (owner/dev only). */
export async function reindexKnowledge(force = false): Promise<{
  success: boolean;
  indexed?: number;
  failed?: number;
  error?: string;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Cloud services are not configured.' };
  }
  const { data, error } = await supabase.functions.invoke('embed-knowledge', {
    body: { force },
  });
  if (error) {
    // Surface the function's own message (e.g. missing GEMINI_API_KEY).
    const message = (error as any)?.context?.message || error.message;
    return { success: false, error: message };
  }
  const payload = data as { indexed?: number; failed?: number; error?: string };
  if (payload?.error) return { success: false, error: payload.error };
  return { success: true, indexed: payload?.indexed ?? 0, failed: payload?.failed ?? 0 };
}

export async function getKnowledgeStatus(): Promise<KnowledgeStatus> {
  const rows = await listKnowledge();
  const active = rows.filter((r) => r.is_active !== false);
  const indexedRows = rows.filter((r) => r.embedding_status === 'indexed');
  return {
    total: rows.length,
    active: active.length,
    indexed: indexedRows.length,
    pending: rows.filter((r) => r.embedding_status === 'pending').length,
    failed: rows.filter((r) => r.embedding_status === 'failed').length,
    lastIndexedAt: indexedRows.reduce<string | null>(
      (latest, r) => (r.indexed_at && (!latest || r.indexed_at > latest) ? r.indexed_at : latest),
      null,
    ),
  };
}
