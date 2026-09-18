// Authoritative Deterministic Product Image Manifest
// Keyed strictly by Product ID to prevent fuzzy matching or dynamic filename assumptions.
// Source: Official Charms Hub website catalog assets (charmshub.mart-24.com).

export interface ProductImageRecord {
  primary: string;
  additional?: string[];
  reference_verified: boolean;
  source: string;
}

export const PRODUCT_IMAGE_MAP: Record<string, string> = {
  "prod-pookia-mystery-scoop": "/products/mystery-scoop/pookia-mystery-scoop.webp",
  "prod-mini-mystery-scoop": "/products/mystery-scoop/mini-mystery-scoop.webp",
  "prod-anti-tarnish-mystery-scoop": "/products/mystery-scoop/anti-tarnish-jewelry-mystery-scoop.webp",
  "prod-luxury-mystery-scoop": "/products/mystery-scoop/luxury-mystery-scoop.jpg",
  "prod-kashmiri-earring-7": "/products/earrings/kashmiri-earring-design-7.webp",
  "prod-kashmiri-earring-6": "/products/earrings/kashmiri-earring-design-6.webp",
  "prod-kashmiri-earring-5": "/products/earrings/kashmiri-earring-design-5.jpg",
  "prod-kashmiri-earring-4": "/products/earrings/kashmiri-earring-design-4.jpg",
  "prod-kashmiri-earring-3": "/products/earrings/kashmiri-earring-design-3.jpg",
  "prod-kashmiri-earring-2": "/products/earrings/kashmiri-earring-design-2.jpg",
  "prod-kashmiri-earring-1": "/products/earrings/kashmiri-earring-design-1.jpg",
  "prod-solar-daisy-charm-bangle": "/products/bracelets/the-solar-daisy-charm-bangle.webp",
  "prod-triple-row-geometric-bangle": "/products/bracelets/the-triple-row-geometric-lattice-bangle.webp",
  "prod-the-silver-wave-bracelet": "/products/bracelets/the-silver-wave-bracelet.jpg",
  "prod-the-greek-key-bracelet": "/products/bracelets/the-greek-key-bracelet.jpg",
  "prod-gucci-bracelet": "/products/bracelets/gucci-bracelet.jpg",
  "prod-love-heartbeat-bracelet": "/products/bracelets/love-heartbeat-bracelet.jpg",
  "prod-infinity-bracelet": "/products/bracelets/infinity-bracelet.jpg",
  "prod-princess-crown-bracelet": "/products/bracelets/princess-crown-bracelet.jpg",
  "prod-travelling-makeup-organizer": "/products/organizers/travelling-makeup-organizer.jpg",
  "prod-5-in-1-rose-ring-box": "/products/organizers/5-in-1-rose-ring-gift-box.jpg",
  "prod-square-rose-gift-box": "/products/organizers/square-rose-gift-box-with-jewelry.webp",
  "prod-round-rose-rotating-box": "/products/organizers/round-rose-rotating-jewelry-box-with-locket.jpg",
  "prod-jewelry-book": "/products/organizers/jewelry-book.jpg",
  "prod-3d-pouch-organizer": "/products/organizers/3d-pouch-jewelry-organizer.jpg",
  "prod-glue-pen": "/products/stationery/glue-pen.jpg",
  "prod-numbing-cream-earrings": "/products/organizers/numbing-cream-for-earrings.jpg",
  "prod-pokemon-sharpener": "/products/stationery/pokemon-sharpener.jpg",
  "prod-mickey-mouse-sharpeners": "/products/stationery/mickey-mouse-sharpeners.jpg",
  "prod-3d-chocolate-erasers": "/products/stationery/3d-chocolate-erasers-pack-of-4.jpg",
  "prod-vine-wrapped-solitaire-ring": "/products/rings/vine-wrapped-solitaire-ring.jpg",
  "prod-lush-solitaire-ring": "",
  "prod-petal-solitaire-ring": "/products/rings/petal-solitaire-ring.jpg",
  "prod-fairytale-tiara-ring": "",
  "prod-mini-floral-hairpins-pairs": "/products/hair-accessories/mini-floral-hairpins-pairs.jpg",
  "prod-hawaiian-flower-claws-small": "/products/hair-accessories/hawaiian-flower-claws-small.jpg",
  "prod-korean-pearl-hairband": "/products/hair-accessories/korean-pearl-hairband.jpg",
  "prod-korean-rosette-bow-pin": "/products/hair-accessories/korean-rosette-bow-pin.jpg",
  "prod-shinchan-mood-swing-keychain": "/products/keychains/shinchan-mood-swing-toy-keychain.jpg",
  "prod-mirror-evil-eye-keychain": "/products/keychains/mirror-evil-eye-keychain.jpg",
  "prod-triple-evil-eye-keychain": "/products/keychains/triple-evil-eye-keychain.jpg",
  "prod-camera-projector-keychain": "/products/keychains/camera-projector-keychain.jpg"
};

export const PRODUCT_ADDITIONAL_IMAGES_MAP: Record<string, string[]> = {
  "prod-kashmiri-earring-5": [
    "/products/earrings/kashmiri-earring-design-5-1.jpg"
  ],
  "prod-kashmiri-earring-4": [
    "/products/earrings/kashmiri-earring-design-4-1.jpg"
  ],
  "prod-kashmiri-earring-3": [
    "/products/earrings/kashmiri-earring-design-3-1.jpg"
  ],
  "prod-kashmiri-earring-2": [
    "/products/earrings/kashmiri-earring-design-2-1.jpg"
  ],
  "prod-kashmiri-earring-1": [
    "/products/earrings/kashmiri-earring-design-1-1.jpg"
  ],
  "prod-the-silver-wave-bracelet": [
    "/products/bracelets/the-silver-wave-bracelet-1.jpg",
    "/products/bracelets/the-silver-wave-bracelet-2.jpg"
  ],
  "prod-the-greek-key-bracelet": [
    "/products/bracelets/the-greek-key-bracelet-1.jpg"
  ],
  "prod-travelling-makeup-organizer": [
    "/products/organizers/travelling-makeup-organizer-1.jpg",
    "/products/organizers/travelling-makeup-organizer-2.jpg",
    "/products/organizers/travelling-makeup-organizer-3.jpg"
  ],
  "prod-5-in-1-rose-ring-box": [
    "/products/organizers/5-in-1-rose-ring-gift-box-1.jpg",
    "/products/organizers/5-in-1-rose-ring-gift-box-2.jpg",
    "/products/organizers/5-in-1-rose-ring-gift-box-3.jpg"
  ],
  "prod-square-rose-gift-box": [
    "/products/organizers/square-rose-gift-box-with-jewelry-1.jpg"
  ],
  "prod-round-rose-rotating-box": [
    "/products/organizers/round-rose-rotating-jewelry-box-with-locket-1.jpg",
    "/products/organizers/round-rose-rotating-jewelry-box-with-locket-2.jpg"
  ],
  "prod-jewelry-book": [
    "/products/organizers/jewelry-book-1.jpg",
    "/products/organizers/jewelry-book-2.jpg",
    "/products/organizers/jewelry-book-3.jpg"
  ],
  "prod-glue-pen": [
    "/products/stationery/glue-pen-1.jpg",
    "/products/stationery/glue-pen-2.jpg"
  ],
  "prod-mickey-mouse-sharpeners": [
    "/products/stationery/mickey-mouse-sharpeners-1.jpg"
  ],
  "prod-3d-chocolate-erasers": [
    "/products/stationery/3d-chocolate-erasers-pack-of-4-1.jpg"
  ],
  "prod-vine-wrapped-solitaire-ring": [
    "/products/rings/vine-wrapped-solitaire-ring-1.jpg",
    "/products/rings/vine-wrapped-solitaire-ring-2.jpg"
  ],
  "prod-petal-solitaire-ring": [
    "/products/rings/petal-solitaire-ring-1.jpg",
    "/products/rings/petal-solitaire-ring-2.jpg"
  ],
  "prod-mini-floral-hairpins-pairs": [
    "/products/hair-accessories/mini-floral-hairpins-pairs-1.jpg"
  ],
  "prod-hawaiian-flower-claws-small": [
    "/products/hair-accessories/hawaiian-flower-claws-small-1.jpg"
  ],
  "prod-korean-pearl-hairband": [
    "/products/hair-accessories/korean-pearl-hairband-1.jpg"
  ],
  "prod-shinchan-mood-swing-keychain": [
    "/products/keychains/shinchan-mood-swing-toy-keychain-1.jpg"
  ]
};

/**
 * Validates product image integrity.
 * Checks whether image_url exists, is not a known generic/placeholder,
 * matches the deterministic product-id mapping, and whether the reference is verified.
 */
export function validateProductImage(product: {
  id: string;
  image_url?: string;
  reference_verified?: boolean;
}): {
  isValid: boolean;
  status: 'VERIFIED' | 'UNVERIFIED' | 'MISMATCH' | 'MISSING';
  message: string;
} {
  if (!product.image_url || product.image_url.trim() === '') {
    return {
      isValid: false,
      status: 'MISSING',
      message: 'Product has no image URL defined.'
    };
  }

  // Detect generic stock/AI generated image URLs
  const lowerUrl = product.image_url.toLowerCase();
  if (lowerUrl.includes('unsplash.com') || lowerUrl.includes('pexels.com') || lowerUrl.includes('placeholder')) {
    return {
      isValid: false,
      status: 'MISMATCH',
      message: 'Product is pointing to generic stock photography instead of authentic Charms Hub asset.'
    };
  }

  const authoritativeImage = PRODUCT_IMAGE_MAP[product.id];
  if (authoritativeImage && authoritativeImage !== product.image_url) {
    return {
      isValid: false,
      status: 'MISMATCH',
      message: `Image does not match authoritative manifest for product ${product.id}.`
    };
  }

  if (!product.reference_verified || !authoritativeImage) {
    return {
      isValid: false,
      status: 'UNVERIFIED',
      message: 'Product image is unverified against official Charms Hub references.'
    };
  }

  return {
    isValid: true,
    status: 'VERIFIED',
    message: 'Verified authentic Charms Hub product image.'
  };
}
