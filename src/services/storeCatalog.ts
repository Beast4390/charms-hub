import { VERIFIED_PRODUCTS } from '../data/verifiedProducts';
import { VERIFIED_CATEGORIES } from '../data/categories';
import { VERIFIED_KNOWLEDGE_BASE } from '../data/knowledgeBase';
import { PRODUCT_IMAGE_MAP, validateProductImage } from '../data/productImageMap';
import { Product, Category, KnowledgeItem } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';

// localStorage holds ONLY a read cache for instant first paint and
// development without cloud access. The Supabase products table is the
// authoritative source of truth; every successful cloud load replaces
// the in-memory catalog and rewrites this cache.
const PRODUCTS_CACHE_KEY = 'charms_hub_dynamic_products';
const CATEGORIES_STORAGE_KEY = 'charms_hub_dynamic_categories';
const KNOWLEDGE_STORAGE_KEY = 'charms_hub_dynamic_knowledge';
const RAG_SYNC_STORAGE_KEY = 'charms_hub_rag_last_sync';

export interface CatalogWriteResult<T = undefined> {
  success: boolean;
  product?: T extends undefined ? never : Product;
  error?: string;
}

export interface CatalogStatus {
  loading: boolean;
  error: string | null;
  cloudLoaded: boolean;
}

/** Columns mirrored to the products table (excludes client-only fields). */
function toDbRow(p: Product): Record<string, unknown> {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    price: p.price,
    mrp: p.mrp ?? null,
    discount_percent: p.discount_percent ?? null,
    category_id: p.category_id,
    category_name: p.category_name ?? null,
    image_url: p.image_url,
    additional_images: p.additional_images ?? [],
    in_stock: p.in_stock ?? true,
    featured: p.featured ?? false,
    is_active: p.is_active ?? true,
    archived_at: p.archived_at ?? null,
    source: p.source,
    reference_verified: p.reference_verified,
    is_mystery_scoop: p.is_mystery_scoop ?? false,
    is_kashmiri_earring: p.is_kashmiri_earring ?? false,
    tags: p.tags ?? [],
    created_at: p.created_at,
    updated_at: p.updated_at,
  };
}

/** Normalize a DB row or cached catalog entry into the client Product shape. */
function fromDbRow(row: Record<string, unknown> | Product): Product {
  const r = row as Record<string, unknown>;
  return {
    ...(r as unknown as Product),
    additional_images: (r.additional_images as string[]) || [],
    tags: (r.tags as string[]) || [],
    in_stock: r.in_stock !== false,
    featured: Boolean(r.featured),
    is_active: r.is_active !== false,
    is_mystery_scoop: Boolean(r.is_mystery_scoop),
    is_kashmiri_earring: Boolean(r.is_kashmiri_earring),
  };
}

function validateProductInput(data: Partial<Product>): string | null {
  if (!data.name || !data.name.trim()) return 'Product name is required.';
  const price = Number(data.price);
  if (!Number.isFinite(price) || price <= 0) return 'Price must be a positive number.';
  if (data.mrp != null && data.mrp !== ('' as unknown) && Number(data.mrp) < price) {
    return 'MRP cannot be lower than the selling price.';
  }
  if (!data.image_url || !String(data.image_url).trim()) return 'Image URL is required.';
  if (!data.category_id) return 'Category is required.';
  return null;
}

class StoreCatalogService {
  private products: Product[] = [];
  private categories: Category[] = [];
  private knowledgeBase: KnowledgeItem[] = [];
  private catalogLoading = false;
  private catalogError: string | null = null;
  private cloudLoaded = false;
  private loadPromise: Promise<{ ok: boolean; error?: string }> | null = null;

  constructor() {
    this.initCatalog();
  }

  private initCatalog() {
    // 1. Categories
    try {
      const savedCats = localStorage.getItem(CATEGORIES_STORAGE_KEY);
      this.categories = savedCats ? JSON.parse(savedCats) : [...VERIFIED_CATEGORIES];
    } catch {
      this.categories = [...VERIFIED_CATEGORIES];
    }

    // 2. Knowledge Base
    try {
      const savedKB = localStorage.getItem(KNOWLEDGE_STORAGE_KEY);
      this.knowledgeBase = savedKB ? JSON.parse(savedKB) : [...VERIFIED_KNOWLEDGE_BASE];
    } catch {
      this.knowledgeBase = [...VERIFIED_KNOWLEDGE_BASE];
    }

    // 3. Products — cache for instant first paint; the cloud load below
    //    (authoritative) replaces it and rewrites the cache.
    try {
      const cached = localStorage.getItem(PRODUCTS_CACHE_KEY);
      this.products = cached
        ? (JSON.parse(cached) as Product[]).map(fromDbRow)
        : VERIFIED_PRODUCTS.map((p) => ({ ...p, is_active: true, archived_at: null }));
    } catch {
      this.products = VERIFIED_PRODUCTS.map((p) => ({ ...p, is_active: true, archived_at: null }));
    }

    if (isSupabaseConfigured && supabase) {
      void this.loadFromCloud();
    }
  }

  /** Categories come from the cloud (authoritative), with live item counts
   *  computed from the current catalog instead of stale static numbers. */
  private async loadCategoriesFromCloud() {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });
    if (error || !data || data.length === 0) {
      if (error) console.warn('Cloud categories unavailable, using cached:', error.message);
      return;
    }
    this.categories = data.map((row) => ({
      id: row.id as string,
      name: row.name as string,
      slug: row.slug as string,
      description: (row.description as string) || undefined,
      image_url: (row.image_url as string) || '',
      featured: row.featured !== false,
      is_active: row.is_active !== false,
      item_count: this.products.filter((p) => p.category_id === row.id && p.is_active !== false).length,
    }));
    try {
      localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(this.categories));
    } catch { /* cache best-effort */ }
  }

  // --- Cloud synchronization ---

  public getCatalogStatus(): CatalogStatus {
    return { loading: this.catalogLoading, error: this.catalogError, cloudLoaded: this.cloudLoaded };
  }

  /** Single-flight initial cloud load; resolves immediately once loaded. */
  public ensureLoaded(): Promise<{ ok: boolean; error?: string }> {
    if (this.cloudLoaded) return Promise.resolve({ ok: true });
    if (!this.loadPromise) {
      this.loadPromise = this.loadFromCloud().finally(() => {
        this.loadPromise = null;
      });
    }
    return this.loadPromise;
  }

  public async loadFromCloud(): Promise<{ ok: boolean; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { ok: false, error: 'Supabase is not configured' };
    }

    this.catalogLoading = true;
    this.notifyChanges();

    try {
      const { data, error } = await supabase.from('products').select('*');
      if (error) throw new Error(error.message);

      if (data && data.length > 0) {
        // Cloud is the source of truth: replace the entire in-memory catalog.
        this.products = data.map((row) => fromDbRow(row as Record<string, unknown>));
        this.cloudLoaded = true;
        this.catalogError = null;
        this.saveProductsCache();
        void this.loadCategoriesFromCloud();
      } else {
        // Fresh project without the seed migration — keep the bundled
        // verified catalog visible rather than an empty storefront.
        this.products = VERIFIED_PRODUCTS.map((p) => ({ ...p, is_active: true, archived_at: null }));
        this.catalogError = 'Cloud catalog is empty; showing the bundled verified catalog.';
      }
      this.catalogLoading = false;
      this.notifyChanges();
      return { ok: true };
    } catch (err) {
      this.catalogLoading = false;
      this.catalogError = err instanceof Error ? err.message : 'Failed to load catalog from cloud';
      console.error('Cloud catalog load failed, serving cached catalog:', err);
      this.notifyChanges();
      return { ok: false, error: this.catalogError };
    }
  }

  private saveProductsCache() {
    try {
      localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(this.products));
    } catch (e) {
      console.error('Failed to persist product cache:', e);
    }
  }

  private notifyChanges() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('charms_hub_catalog_changed'));
    }
  }

  /** Applies a validated cloud write to memory, cache and subscribers. */
  private applyWrite(product: Product) {
    const idx = this.products.findIndex((p) => p.id === product.id);
    if (idx >= 0) this.products[idx] = product;
    else this.products.unshift(product);
    this.saveProductsCache();
    this.syncRAGKnowledge();
    this.notifyChanges();
  }

  // --- Public Product Methods (reads stay synchronous via the cache) ---

  public getProducts(includeArchived = false): Product[] {
    if (includeArchived) {
      return [...this.products];
    }
    return this.products.filter((p) => p.is_active !== false);
  }

  public getProductById(id: string): Product | undefined {
    return this.products.find((p) => p.id === id);
  }

  public async addProduct(
    productData: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'reference_verified'> & { reference_verified?: boolean }
  ): Promise<CatalogWriteResult<Product>> {
    if (!supabase) return { success: false, error: 'Cloud catalog unavailable (Supabase not configured).' };

    const invalid = validateProductInput(productData);
    if (invalid) return { success: false, error: invalid };

    const slug = productData.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    if (this.products.some((p) => p.slug === slug)) {
      return { success: false, error: `A product with the name "${productData.name}" already exists.` };
    }

    const id = `ch-prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    // Verification check: only mark true if verified against known sources.
    // Owner-uploaded imagery is never auto-verified.
    const isReferenceVerified = Boolean(
      productData.reference_verified || PRODUCT_IMAGE_MAP[id] === productData.image_url
    );

    const newProduct: Product = {
      ...productData,
      id,
      slug,
      is_active: true,
      reference_verified: isReferenceVerified,
      created_at: now,
      updated_at: now,
    };

    const { error } = await supabase.from('products').insert([toDbRow(newProduct)]);
    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'A product with this name already exists.' };
      }
      return { success: false, error: error.message };
    }

    this.applyWrite(newProduct);
    return { success: true, product: newProduct };
  }

  public async updateProduct(id: string, updates: Partial<Product>): Promise<CatalogWriteResult<Product>> {
    if (!supabase) return { success: false, error: 'Cloud catalog unavailable (Supabase not configured).' };

    const current = this.products.find((p) => p.id === id);
    if (!current) return { success: false, error: 'Product not found.' };

    const merged: Product = { ...current, ...updates, id: current.id, slug: current.slug };

    const invalid = validateProductInput(merged);
    if (invalid) return { success: false, error: invalid };

    // Recalculate discount whenever price and MRP exist.
    if (merged.mrp && merged.mrp > merged.price) {
      merged.discount_percent = Math.round(((merged.mrp - merged.price) / merged.mrp) * 100);
    }
    merged.updated_at = new Date().toISOString();

    const { error } = await supabase.from('products').update(toDbRow(merged)).eq('id', id);
    if (error) return { success: false, error: error.message };

    this.applyWrite(merged);
    return { success: true, product: merged };
  }

  public async archiveProduct(id: string): Promise<CatalogWriteResult> {
    return this.patchProduct(id, {
      is_active: false,
      archived_at: new Date().toISOString(),
    });
  }

  public async restoreProduct(id: string): Promise<CatalogWriteResult> {
    return this.patchProduct(id, {
      is_active: true,
      archived_at: null,
    });
  }

  public async updateProductStock(id: string, inStock: boolean): Promise<CatalogWriteResult> {
    return this.patchProduct(id, { in_stock: inStock });
  }

  public async updateProductPrice(id: string, price: number, mrp?: number, discount?: number): Promise<CatalogWriteResult> {
    const product = this.products.find((p) => p.id === id);
    if (!product) return { success: false, error: 'Product not found.' };
    if (!Number.isFinite(price) || price <= 0) return { success: false, error: 'Price must be a positive number.' };
    if (mrp != null && mrp < price) return { success: false, error: 'MRP cannot be lower than the selling price.' };

    const nextDiscount =
      discount !== undefined ? discount : mrp && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : product.discount_percent;

    return this.patchProduct(id, { price, mrp, discount_percent: nextDiscount });
  }

  public async updateProductImage(
    id: string,
    imageUrl: string,
    referenceVerified = false,
    additionalImages?: string[]
  ): Promise<CatalogWriteResult> {
    if (!imageUrl || !imageUrl.trim()) return { success: false, error: 'Image URL is required.' };
    return this.patchProduct(id, {
      image_url: imageUrl,
      reference_verified: referenceVerified,
      additional_images: additionalImages ?? [],
    });
  }

  public async deleteProduct(id: string): Promise<CatalogWriteResult> {
    if (!supabase) return { success: false, error: 'Cloud catalog unavailable (Supabase not configured).' };

    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) return { success: false, error: error.message };

    this.products = this.products.filter((p) => p.id !== id);
    this.saveProductsCache();
    this.syncRAGKnowledge();
    this.notifyChanges();
    return { success: true };
  }

  /** Shared write path for single-product partial updates. */
  private async patchProduct(id: string, patch: Partial<Product>): Promise<CatalogWriteResult> {
    if (!supabase) return { success: false, error: 'Cloud catalog unavailable (Supabase not configured).' };

    const current = this.products.find((p) => p.id === id);
    if (!current) return { success: false, error: 'Product not found.' };

    const updated: Product = { ...current, ...patch, id: current.id, updated_at: new Date().toISOString() };
    const { error } = await supabase
      .from('products')
      .update(toDbRow(updated))
      .eq('id', id);
    if (error) return { success: false, error: error.message };

    this.applyWrite(updated);
    return { success: true };
  }

  public async triggerRagSync(): Promise<{ success: boolean; synced_products_count: number }> {
    this.syncRAGKnowledge();
    return {
      success: true,
      synced_products_count: this.products.filter((p) => p.is_active !== false).length,
    };
  }

  // --- Category Methods ---

  public getCategories(): Category[] {
    return [...this.categories];
  }

  public getCategoryById(id: string): Category | undefined {
    return this.categories.find((c) => c.id === id);
  }

  /** Cloud-backed category management (RLS: admin write). */
  public async saveCategory(input: {
    id?: string;
    name: string;
    slug?: string;
    description?: string;
    image_url?: string;
    featured?: boolean;
  }): Promise<CatalogWriteResult> {
    if (!supabase) return { success: false, error: 'Cloud services are not configured.' };
    if (!input.name?.trim()) return { success: false, error: 'Category name is required.' };

    const slug =
      input.slug?.trim() ||
      input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    if (this.categories.some((c) => c.slug === slug && c.id !== input.id)) {
      return { success: false, error: `A category with the name "${input.name}" already exists.` };
    }

    const row: Record<string, unknown> = {
      name: input.name.trim(),
      slug,
      description: input.description?.trim() || null,
      image_url: input.image_url?.trim() || null,
      featured: input.featured ?? true,
      updated_at: new Date().toISOString(),
    };

    if (input.id) {
      const { error } = await supabase.from('categories').update(row).eq('id', input.id);
      if (error) return { success: false, error: error.message };
      this.categories = this.categories.map((c) =>
        c.id === input.id ? { ...c, ...row, description: row.description as string | undefined } as Category : c,
      );
    } else {
      const id = `cat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const { error } = await supabase.from('categories').insert({ ...row, id });
      if (error) return { success: false, error: error.message };
      this.categories.push({
        id,
        name: row.name as string,
        slug: row.slug as string,
        description: row.description as string | undefined,
        image_url: (row.image_url as string) || '',
        featured: row.featured as boolean,
        is_active: true,
      });
    }
    this.notifyChanges();
    return { success: true };
  }

  public async setCategoryActive(id: string, isActive: boolean): Promise<CatalogWriteResult> {
    if (!supabase) return { success: false, error: 'Cloud services are not configured.' };
    const { error } = await supabase
      .from('categories')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return { success: false, error: error.message };
    this.categories = this.categories.map((c) => (c.id === id ? { ...c, is_active: isActive } : c));
    this.notifyChanges();
    return { success: true };
  }

  // --- Knowledge Base Methods ---

  public getKnowledgeBase(): KnowledgeItem[] {
    return [...this.knowledgeBase];
  }

  public updateKnowledgeItem(id: string, updates: Partial<KnowledgeItem>): boolean {
    const idx = this.knowledgeBase.findIndex((k) => k.id === id);
    if (idx === -1) return false;
    this.knowledgeBase[idx] = { ...this.knowledgeBase[idx], ...updates };
    try {
      localStorage.setItem(KNOWLEDGE_STORAGE_KEY, JSON.stringify(this.knowledgeBase));
    } catch (e) {
      console.error('Failed to persist knowledge base:', e);
    }
    this.syncRAGKnowledge();
    return true;
  }

  // --- RAG Synchronization (metadata only; the RAG pipeline is out of scope) ---

  public syncRAGKnowledge(): { productCount: number; knowledgeCount: number; timestamp: string } {
    const activeProducts = this.getProducts(false);
    const syncInfo = {
      productCount: activeProducts.length,
      knowledgeCount: this.knowledgeBase.length,
      timestamp: new Date().toISOString(),
    };
    try {
      localStorage.setItem(RAG_SYNC_STORAGE_KEY, JSON.stringify(syncInfo));
      window.dispatchEvent(new CustomEvent('charms_hub_rag_synced', { detail: syncInfo }));
    } catch (e) {
      console.error('Failed to record RAG sync:', e);
    }
    return syncInfo;
  }

  public getLastRAGSync(): { productCount: number; knowledgeCount: number; timestamp: string } | null {
    try {
      const saved = localStorage.getItem(RAG_SYNC_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }

  public validateAllImages(): {
    total: number;
    verified: number;
    unverified: number;
    issues: Array<{ id: string; name: string; status: string; message: string }>;
  } {
    let verifiedCount = 0;
    let unverifiedCount = 0;
    const issues: Array<{ id: string; name: string; status: string; message: string }> = [];

    for (const p of this.products) {
      const val = validateProductImage(p);
      if (val.isValid && val.status === 'VERIFIED') {
        verifiedCount++;
      } else {
        unverifiedCount++;
        issues.push({
          id: p.id,
          name: p.name,
          status: val.status,
          message: val.message,
        });
      }
    }

    return {
      total: this.products.length,
      verified: verifiedCount,
      unverified: unverifiedCount,
      issues,
    };
  }
}

export const storeCatalog = new StoreCatalogService();
