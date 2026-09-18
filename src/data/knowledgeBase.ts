import { KnowledgeItem } from '../types';

export const VERIFIED_KNOWLEDGE_BASE: KnowledgeItem[] = [
  {
    id: 'kb-free-shipping',
    title: 'Free Shipping Threshold',
    content: 'Charms Hub offers free shipping on all orders above ₹499. For orders below ₹499, standard shipping charges apply at checkout.',
    category: 'delivery',
    source: 'Charms Hub website top banner',
    metadata: { type: 'business_policy', min_order_value: 499 }
  },
  {
    id: 'kb-packaging-video',
    title: 'Order Packaging Video on Instagram Story',
    content: 'Charms Hub records and uploads order packaging videos for customers on our official Instagram Story so you can watch your package being prepared.',
    category: 'order',
    source: 'Charms Hub announcement banner',
    metadata: { platform: 'Instagram' }
  },
  {
    id: 'kb-delivery-duration',
    title: 'Delivery Timelines',
    content: 'Standard delivery across India usually takes 4 to 7 business days depending on your pin code location.',
    category: 'delivery',
    source: 'Charms Hub shipping policy',
    metadata: { timeline: '4-7 business days' }
  },
  {
    id: 'kb-ordering-process',
    title: 'How to Place an Order',
    content: 'To place an order on Charms Hub: 1. Browse products and add your desired items to cart. 2. Open your Cart and proceed to checkout or send your order inquiry directly to our WhatsApp support team with your items and shipping address. 3. Our team confirms availability and guides you through fulfillment.',
    category: 'order',
    source: 'Charms Hub checkout workflow',
    metadata: { type: 'workflow' }
  },
  {
    id: 'kb-mystery-scoop-types',
    title: 'Mystery Scoop Options and Pricing',
    content: 'Charms Hub offers 4 verified Mystery Scoop tiers: 1. Pookia Mystery Scoop at ₹399 (MRP ₹499). 2. Mini Mystery Scoop at ₹399 (MRP ₹499). 3. Anti-tarnish Jewelry Mystery Scoop at ₹799 (MRP ₹999). 4. Luxury Mystery Scoop at ₹1,200 (MRP ₹1,500). All scoops are curated surprises.',
    category: 'general',
    source: 'Charms Hub Mystery Scoop section',
    metadata: { type: 'product_category' }
  },
  {
    id: 'kb-anti-tarnish-care',
    title: 'Anti-tarnish Jewelry Care Instructions',
    content: 'Our anti-tarnish jewelry is crafted from quality stainless steel with premium plating. To prolong its lifespan, keep it dry, avoid direct contact with perfumes, deodorants, or swimming pools, and store it in an airtight zip pouch or jewelry organizer.',
    category: 'product_care',
    source: 'Charms Hub jewelry care guide',
    metadata: { type: 'care_instructions' }
  },
  {
    id: 'kb-unboxing-video-policy',
    title: 'Return and Unboxing Video Requirement',
    content: 'For any damaged, missing, or incorrect items, a 360-degree unboxing video from start to finish without cuts or pauses is strictly required within 24 hours of package delivery for replacement or claims.',
    category: 'return_refund',
    source: 'Charms Hub Return Policy',
    metadata: { type: 'policy' }
  },
  {
    id: 'kb-contact-support',
    title: 'Customer Support and Contact',
    content: 'You can reach Charms Hub customer support via WhatsApp through the website button or by emailing cloudfeaxxxx@gmail.com.',
    category: 'general',
    source: 'Charms Hub footer and support',
    metadata: { type: 'contact' }
  }
];
