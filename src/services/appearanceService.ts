import { StoreAppearanceSettings } from '../types';

const APPEARANCE_STORAGE_KEY = 'charms_hub_appearance_settings';

export const DEFAULT_APPEARANCE: StoreAppearanceSettings = {
  card_bg: 'white',
  card_radius: 'rounded-2xl',
  card_border: 'border',
  card_shadow: 'shadow-xs',
  card_density: 'standard',
  image_aspect: 'aspect-square',
  badge_style: 'subtle',
  price_style: 'standard',
  button_style: 'filled',
  updated_at: new Date().toISOString(),
  updated_by: 'system_default',
};

export function getStoreAppearance(): StoreAppearanceSettings {
  try {
    const saved = localStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_APPEARANCE, ...JSON.parse(saved) };
    }
  } catch (err) {
    console.error('Failed to parse appearance settings:', err);
  }
  return DEFAULT_APPEARANCE;
}

export function saveStoreAppearance(
  settings: Partial<StoreAppearanceSettings>,
  updatedBy = 'shop_owner'
): StoreAppearanceSettings {
  const current = getStoreAppearance();
  const updated: StoreAppearanceSettings = {
    ...current,
    ...settings,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy,
  };

  try {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(updated));
    // Dispatch custom event for immediate reactive rerendering across components
    window.dispatchEvent(new CustomEvent('charms_hub_appearance_changed', { detail: updated }));
  } catch (err) {
    console.error('Failed to save appearance settings:', err);
  }

  return updated;
}

export function resetStoreAppearance(updatedBy = 'developer'): StoreAppearanceSettings {
  const resetSettings: StoreAppearanceSettings = {
    ...DEFAULT_APPEARANCE,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy,
  };

  try {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(resetSettings));
    window.dispatchEvent(new CustomEvent('charms_hub_appearance_changed', { detail: resetSettings }));
  } catch (err) {
    console.error('Failed to reset appearance settings:', err);
  }

  return resetSettings;
}

export const updateStoreAppearance = saveStoreAppearance;
