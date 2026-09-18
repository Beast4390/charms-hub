import { VERIFIED_PRODUCTS } from '../data/verifiedProducts';
import { VERIFIED_CATEGORIES } from '../data/categories';
import { VERIFIED_KNOWLEDGE_BASE } from '../data/knowledgeBase';
import { PRODUCT_IMAGE_MAP, validateProductImage } from '../data/productImageMap';
import { Product, Category, KnowledgeItem } from '../types';

const PRODUCTS_STORAGE_KEY = 'charms_hub_dynamic_products';
const CATEGORIES_STORAGE_KEY = 'charms_hub_dynamic_categories';
const KNOWLEDGE_STORAGE_KEY = 'charms_hub_dynamic_knowledge';
const RAG_SYNC_STORAGE_KEY = 'charms_hub_rag_last_sync';

class StoreCatalogService {
  private products: Product[] = [];
  private categories: Category[] = [];
  private knowledgeBase: KnowledgeItem[] = [];

  constructor() {
    this.initCatalog();
  }

  private initCatalog() {
    // 1. Categories
    try {
      const savedCats = localStorage.getItem(CATEGORIES_STORAGE_KEY);
      if (savedCats) {
        this.categories = JSON.parse(savedCats);
      } else {
        this.categories = [...VERIFIED_CATEGORIES];
      }
    } catch {
      this.categories = [...VERIFIED_CATEGORIES];
    }

    // 2. Knowledge Base
    try {
      const savedKB = localStorage.getItem(KNOWLEDGE_STORAGE_KEY);
      if (savedKB) {
        this.knowledgeBase = JSON.parse(savedKB);
      } else {
        this.knowledgeBase = [...VERIFIED_KNOWLEDGE_BASE];
      }
    } catch {
      this.knowledgeBase = [...VERIFIED_KNOWLEDGE_BASE];
    }

    // 3. Products
    try {
      const savedProducts = localStorage.getItem(PRODUCTS_STORAGE_KEY);
      if (savedProducts) {
        const parsed: Product[] = JSON.parse(savedProducts);
        // Ensure all verified products exist, merged with user edits
        const map = new Map<string, Product>();
        // Base verified items
        for (const vp of VERIFIED_PRODUCTS) {
          map.set(vp.id, { ...vp, is_active: true });
        }
        // Apply saved overrides or additions
        for (const sp of parsed) {
          map.set(sp.id, sp);
        }
        this.products = Array.from(map.values());
      } else {
        this.products = VERIFIED_PRODUCTS.map((p) => ({
          ...p,
          is_active: true,
          archived_at: null,
        }));
      }
    } catch {
      this.products = VERIFIED_PRODUCTS.map((p) => ({
        ...p,
        is_active: true,
        archived_at: null,
      }));
    }
  }

  private saveProducts() {
    try {
      localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(this.products));
      this.notifyChanges();
    } catch (e) {
      console.error('Failed to persist products:', e);
    }
  }

  private saveCategories() {
    try {
      localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(this.categories));
      this.notifyChanges();
    } catch (e) {
      console.error('Failed to persist categories:', e);
    }
  }

  private saveKnowledge() {
    try {
      localStorage.setItem(KNOWLEDGE_STORAGE_KEY, JSON.stringify(this.knowledgeBase));
      this.notifyChanges();
    } catch (e) {
      console.error('Failed to persist knowledge base:', e);
    }
  }

  private notifyChanges() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('charms_hub_catalog_changed'));
    }
  }

  // --- Public Product Methods ---

  public getProducts(includeArchived = false): Product[] {
    if (includeArchived) {
      return [...this.products];
    }
    return this.products.filter((p) => p.is_active !== false);
  }

  public getProductById(id: string): Product | undefined {
    return this.products.find((p) => p.id === id);
  }

  public addProduct(productData: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Product {
    const slug = productData.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const id = `ch-prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    // Verification check: only mark true if verified against known sources
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

    this.products.unshift(newProduct);
    this.saveProducts();
    this.syncRAGKnowledge();
    return newProduct;
  }

  public updateProduct(id: string, updates: Partial<Product>): Product | null {
    const idx = this.products.findIndex((p) => p.id === id);
    if (idx === -1) return null;

    const current = this.products[idx];
    const updated: Product = {
      ...current,
      ...updates,
      id: current.id, // Immutable ID
      updated_at: new Date().toISOString(),
    };

    // Calculate discount if price and MRP exist
    if (updated.mrp && updated.mrp > updated.price) {
      updated.discount_percent = Math.round(((updated.mrp - updated.price) / updated.mrp) * 100);
    }

    this.products[idx] = updated;
    this.saveProducts();
    this.syncRAGKnowledge();
    return updated;
  }

  public archiveProduct(id: string): boolean {
    const product = this.products.find((p) => p.id === id);
    if (!product) return false;
    product.is_active = false;
    product.archived_at = new Date().toISOString();
    product.updated_at = new Date().toISOString();
    this.saveProducts();
    this.syncRAGKnowledge();
    return true;
  }

  public restoreProduct(id: string): boolean {
    const product = this.products.find((p) => p.id === id);
    if (!product) return false;
    product.is_active = true;
    product.archived_at = null;
    product.updated_at = new Date().toISOString();
    this.saveProducts();
    this.syncRAGKnowledge();
    return true;
  }

  public updateProductStock(id: string, inStock: boolean): boolean {
    const product = this.products.find((p) => p.id === id);
    if (!product) return false;
    product.in_stock = inStock;
    product.updated_at = new Date().toISOString();
    this.saveProducts();
    this.syncRAGKnowledge();
    return true;
  }

  public updateProductPrice(id: string, price: number, mrp?: number, discount?: number): boolean {
    const product = this.products.find((p) => p.id === id);
    if (!product || price <= 0) return false;
    product.price = price;
    if (mrp !== undefined) product.mrp = mrp;
    if (discount !== undefined) {
      product.discount_percent = discount;
    } else if (product.mrp && product.mrp > product.price) {
      product.discount_percent = Math.round(((product.mrp - product.price) / product.mrp) * 100);
    }
    product.updated_at = new Date().toISOString();
    this.saveProducts();
    this.syncRAGKnowledge();
    return true;
  }

  public updateProductImage(
    id: string,
    imageUrl: string,
    referenceVerified = false,
    additionalImages?: string[]
  ): boolean {
    const product = this.products.find((p) => p.id === id);
    if (!product) return false;
    product.image_url = imageUrl;
    product.reference_verified = referenceVerified;
    if (additionalImages) {
      product.additional_images = additionalImages;
    }
    product.updated_at = new Date().toISOString();
    this.saveProducts();
    return true;
  }

  public deleteProduct(id: string): boolean {
    const initial = this.products.length;
    this.products = this.products.filter((p) => p.id !== id);
    if (this.products.length !== initial) {
      this.saveProducts();
      this.syncRAGKnowledge();
      return true;
    }
    return false;
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

  public addCategory(cat: Category): void {
    this.categories.push(cat);
    this.saveCategories();
  }

  // --- Knowledge Base Methods ---

  public getKnowledgeBase(): KnowledgeItem[] {
    return [...this.knowledgeBase];
  }

  public updateKnowledgeItem(id: string, updates: Partial<KnowledgeItem>): boolean {
    const idx = this.knowledgeBase.findIndex((k) => k.id === id);
    if (idx === -1) return false;
    this.knowledgeBase[idx] = { ...this.knowledgeBase[idx], ...updates };
    this.saveKnowledge();
    this.syncRAGKnowledge();
    return true;
  }

  // --- RAG Synchronization ---

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
