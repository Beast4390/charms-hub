import { supabase, isSupabaseConfigured } from './supabase';

/** Owner-editable store configuration (public read, admin write via RLS). */
export const STORE_CONFIG_KEYS = {
  upiMerchantId: 'upi_merchant_id',
  supportWhatsApp: 'support_whatsapp',
  storeDisplayName: 'store_display_name',
} as const;

export async function getStoreConfig(key: string): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('store_config')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) {
    console.error(`Failed to read store config "${key}":`, error.message);
    return null;
  }
  return (data?.value as string) ?? null;
}

export async function getAllStoreConfig(): Promise<Record<string, string>> {
  if (!isSupabaseConfigured || !supabase) return {};
  const { data, error } = await supabase.from('store_config').select('key,value');
  if (error) {
    console.error('Failed to read store config:', error.message);
    return {};
  }
  return Object.fromEntries((data ?? []).map((r) => [r.key as string, r.value as string]));
}

export async function upsertStoreConfig(
  key: string,
  value: string,
  updatedBy: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Cloud services are not configured.' };
  }
  if (!key.trim() || !value.trim()) {
    return { success: false, error: 'Both a configuration key and value are required.' };
  }
  const { error } = await supabase
    .from('store_config')
    .upsert({ key: key.trim(), value: value.trim(), updated_by: updatedBy, updated_at: new Date().toISOString() });
  if (error) return { success: false, error: error.message };
  return { success: true };
}
