import { storeCatalog } from './storeCatalog';
import { ChatMessage, Product } from '../types';

interface QueryIntent {
  isProductQuery: boolean;
  isBusinessQuery: boolean;
  categorySlug?: string;
  maxPrice?: number;
  minPrice?: number;
  inStockOnly?: boolean;
  keywords: string[];
}

export function parseUserIntent(query: string): QueryIntent {
  const lower = query.toLowerCase();
  
  // Price extraction e.g. "under 300", "under ₹500", "below 200", "< 500"
  let maxPrice: number | undefined;
  let minPrice: number | undefined;

  const underMatch = lower.match(/(?:under|below|less than|within)\s*(?:₹|rs\.?|inr)?\s*(\d+)/i);
  if (underMatch) {
    maxPrice = parseInt(underMatch[1], 10);
  }

  const aboveMatch = lower.match(/(?:above|more than|over)\s*(?:₹|rs\.?|inr)?\s*(\d+)/i);
  if (aboveMatch) {
    minPrice = parseInt(aboveMatch[1], 10);
  }

  // Category detection
  let categorySlug: string | undefined;
  if (lower.includes('bracelet') || lower.includes('bangle') || lower.includes('wrist')) {
    categorySlug = 'cat-bracelets';
  } else if (lower.includes('earring') || lower.includes('jhumka') || lower.includes('kashmiri')) {
    categorySlug = 'cat-earrings';
  } else if (lower.includes('ring') || lower.includes('solitaire') || lower.includes('tiara')) {
    categorySlug = 'cat-rings';
  } else if (lower.includes('hair') || lower.includes('claw') || lower.includes('pin') || lower.includes('bow') || lower.includes('hairband')) {
    categorySlug = 'cat-hair-accessories';
  } else if (lower.includes('mystery') || lower.includes('scoop')) {
    categorySlug = 'cat-mystery-scoop';
  } else if (lower.includes('stationery') || lower.includes('sharpener') || lower.includes('glue') || lower.includes('eraser')) {
    categorySlug = 'cat-quirky-stationery';
  } else if (lower.includes('organizer') || lower.includes('pouch') || lower.includes('makeup')) {
    categorySlug = 'cat-organizers';
  } else if (lower.includes('keychain') || lower.includes('shinchan') || lower.includes('evil eye')) {
    categorySlug = 'cat-quirky-keychains';
  } else if (lower.includes('gift') || lower.includes('rose box')) {
    categorySlug = 'cat-unique-products';
  }

  const isProductKeywords = [
    'show', 'find', 'product', 'buy', 'have', 'recommend', 'item', 'cost', 'price',
    'available', 'stock', 'bracelet', 'earring', 'ring', 'claw', 'pin', 'bangle',
    'organizer', 'scoop', 'stationery', 'keychain', 'gift'
  ];

  const isBusinessKeywords = [
    'delivery', 'ship', 'shipping', 'order', 'return', 'refund', 'unboxing',
    'payment', 'time', 'instagram', 'video', 'care', 'tarnish', 'contact', 'whatsapp',
    'support', 'policy', 'japan', 'international', 'cod'
  ];

  const isProductQuery = isProductKeywords.some((kw) => lower.includes(kw)) || Boolean(maxPrice || categorySlug);
  const isBusinessQuery = isBusinessKeywords.some((kw) => lower.includes(kw));

  const keywords = lower
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);

  return {
    isProductQuery,
    isBusinessQuery,
    categorySlug,
    maxPrice,
    minPrice,
    keywords,
  };
}

export async function processChatbotQuery(userText: string): Promise<{
  text: string;
  recommendedProducts?: Product[];
  actionType?: 'view_products' | 'contact_whatsapp' | 'view_policy';
  isFallback?: boolean;
}> {
  const intent = parseUserIntent(userText);
  const lower = userText.toLowerCase();

  // ANTI-HALLUCINATION CHECK FOR UNVERIFIED / UNSUPPORTED QUERIES
  // e.g. "Do you deliver to Japan/USA/London?", "Will this be available next month?", random unrelated topics
  const unverifiedPatterns = [
    'japan', 'usa', 'america', 'uk', 'london', 'canada', 'australia', 'international',
    'next month', 'next year', 'future price', 'weather', 'crypto', 'politics', 'medical', 'prescription'
  ];

  if (unverifiedPatterns.some((pattern) => lower.includes(pattern))) {
    return {
      text: "I don't have verified information about that. Charms Hub currently verifies free shipping above ₹499 across India (delivery within 4-7 business days). For specialized inquiries or custom requests, please contact our support team directly on WhatsApp.",
      actionType: 'contact_whatsapp',
      isFallback: true,
    };
  }

  // CLASS 1 & CLASS 3: Product Retrieval
  let matchingProducts: Product[] = [];
  const currentCatalog = storeCatalog.getProducts(false);
  if (intent.isProductQuery) {
    matchingProducts = currentCatalog.filter((p) => {
      // Category match
      if (intent.categorySlug && p.category_id !== intent.categorySlug) {
        return false;
      }
      // Max price match
      if (intent.maxPrice !== undefined && p.price > intent.maxPrice) {
        return false;
      }
      // Min price match
      if (intent.minPrice !== undefined && p.price < intent.minPrice) {
        return false;
      }
      // If specific search words were used
      if (!intent.categorySlug && intent.keywords.length > 0) {
        const textToSearch = `${p.name} ${p.description} ${p.tags?.join(' ') || ''}`.toLowerCase();
        const hasMatch = intent.keywords.some((kw) => textToSearch.includes(kw));
        return hasMatch;
      }
      return true;
    }).slice(0, 4);
  }

  // CLASS 2 & CLASS 3: Knowledge Base Search
  let matchedKnowledge = '';
  const currentKB = storeCatalog.getKnowledgeBase();
  if (intent.isBusinessQuery) {
    const matchedItems = currentKB.filter((kb) => {
      const kbText = `${kb.title} ${kb.content} ${kb.category}`.toLowerCase();
      return intent.keywords.some((kw) => kbText.includes(kw));
    });

    if (matchedItems.length > 0) {
      matchedKnowledge = matchedItems.map((k) => k.content).join('\n\n');
    }
  }

  // Scenario 3: Mixed Query (e.g. "Show me bracelets under 300 and how to order")
  if (intent.isProductQuery && intent.isBusinessQuery) {
    const productsFound = matchingProducts.length > 0;
    const knowledgeText = matchedKnowledge || "You can add items to your cart and place an order inquiry via WhatsApp with your shipping address.";
    
    return {
      text: productsFound
        ? `Here are the verified Charms Hub items matching your request:\n\n${knowledgeText}`
        : `I couldn't find products matching that exact price or category in our verified catalog.\n\n${knowledgeText}`,
      recommendedProducts: matchingProducts,
      actionType: productsFound ? 'view_products' : 'contact_whatsapp',
    };
  }

  // Scenario 1: Pure Product Query
  if (intent.isProductQuery) {
    if (matchingProducts.length > 0) {
      const priceNotice = intent.maxPrice ? ` under ₹${intent.maxPrice}` : '';
      return {
        text: `I found these verified Charms Hub products${priceNotice} matching your request. Click on any item to view details or add it to your cart:`,
        recommendedProducts: matchingProducts,
        actionType: 'view_products',
      };
    } else {
      return {
        text: "I couldn't find verified products matching those exact criteria. Would you like to explore our popular Kashmiri Earrings, Anti-tarnish Bracelets, or Mystery Scoops?",
        actionType: 'contact_whatsapp',
      };
    }
  }

  // Scenario 2: Pure Knowledge Base Query
  if (matchedKnowledge) {
    return {
      text: matchedKnowledge,
      actionType: lower.includes('order') || lower.includes('contact') ? 'contact_whatsapp' : undefined,
    };
  }

  // Fallback for general greetings or unknown queries
  if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
    return {
      text: "Hello! Welcome to Charms Hub. I'm your AI Shopping Assistant. I can help you discover verified handcrafted jewelry, Kashmiri earrings, mystery scoops, hair accessories, stationery, or answer delivery and ordering policies.",
    };
  }

  return {
    text: "I don't have verified information about that. As the Charms Hub Shopping Assistant, I can answer questions about verified products, prices, Indian delivery timelines (4-7 business days), free shipping above ₹499, and our return policy.",
    actionType: 'contact_whatsapp',
    isFallback: true,
  };
}
