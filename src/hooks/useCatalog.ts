import { useCallback, useEffect, useState } from 'react';
import { storeCatalog, CatalogStatus } from '../services/storeCatalog';
import { Product } from '../types';

export interface UseCatalogResult {
  products: Product[];
  loading: boolean;
  error: string | null;
  cloudLoaded: boolean;
  /** Re-runs the authoritative cloud load (e.g. from an error banner). */
  reload: () => void;
}

/**
 * Subscribes a component to the cloud-backed catalog. Reads stay
 * synchronous against the storeCatalog cache (instant first paint from
 * cache, corrected by the authoritative cloud load via the
 * charms_hub_catalog_changed event).
 */
export function useCatalog(includeArchived = false): UseCatalogResult {
  const [products, setProducts] = useState<Product[]>(() => storeCatalog.getProducts(includeArchived));
  const [status, setStatus] = useState<CatalogStatus>(() => storeCatalog.getCatalogStatus());

  const refresh = useCallback(() => {
    setProducts(storeCatalog.getProducts(includeArchived));
    setStatus(storeCatalog.getCatalogStatus());
  }, [includeArchived]);

  useEffect(() => {
    refresh();
    window.addEventListener('charms_hub_catalog_changed', refresh);
    void storeCatalog.ensureLoaded().finally(refresh);
    return () => window.removeEventListener('charms_hub_catalog_changed', refresh);
  }, [refresh]);

  const reload = useCallback(() => {
    void storeCatalog.loadFromCloud().finally(refresh);
  }, [refresh]);

  return {
    products,
    loading: status.loading,
    error: status.error,
    cloudLoaded: status.cloudLoaded,
    reload,
  };
}
