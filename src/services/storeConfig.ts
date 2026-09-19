import { supabase, isSupabaseConfigured } from './supabase';

/** Owner-editable store configuration (public read, admin write via RLS). */
export const STORE_CONFIG_KEYS = {
  upiMerchantId: 'upi_merchant_id',
  supportWhatsApp: 'support_whatsapp',
  supportEmail: 'support_email',
  supportPhone: 'support_phone',
  storeDisplayName: 'store_display_name',
  instagramUrl: 'instagram_url',
  upiEnabled: 'upi_enabled',
  codEnabled: 'cod_enabled',
  freeShippingThreshold: 'free_shipping_threshold',
  shippingFlatFee: 'shipping_flat_fee',
} as const;

export interface PaymentMethods {
  upi: boolean;
  cod: boolean;
}

/** Which payment methods the owner currently enables (defaults: both). */
export async function getPaymentMethods(): Promise<PaymentMethods> {
  if (!isSupabaseConfigured || !supabase) return { upi: true, cod: true };
  const { data, error } = await supabase
    .from('store_config')
    .select('key,value')
    .in('key', [STORE_CONFIG_KEYS.upiEnabled, STORE_CONFIG_KEYS.codEnabled]);
  if (error) {
    console.error('Failed to read payment method config:', error.message);
    return { upi: true, cod: true };
  }
  const map = Object.fromEntries((data ?? []).map((r) => [r.key as string, r.value as string]));
  return {
    upi: (map[STORE_CONFIG_KEYS.upiEnabled] ?? 'true') === 'true',
    cod: (map[STORE_CONFIG_KEYS.codEnabled] ?? 'true') === 'true',
  };
}

/**
 * WhatsApp support link. The number comes ONLY from owner-managed
 * configuration — there is no hardcoded placeholder number in the app.
 * Without configuration the generic share-by-text entry point is used
 * so no unverified number is ever presented as the business contact.
 */
export async function getWhatsAppLink(message?: string): Promise<string> {
  const number = await getStoreConfig(STORE_CONFIG_KEYS.supportWhatsApp);
  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  if (number && number.trim()) {
    return `https://wa.me/${number.trim().replace(/[^\d]/g, '')}${text}`;
  }
  return `https://api.whatsapp.com/send${text}`;
}

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
