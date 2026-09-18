/**
 * Verifies the cloud products table matches the bundled verified catalog
 * field-by-field, and that product image mappings remain deterministic.
 *
 * Usage (read-only; pass keys via CLI, never commit them):
 *   npx tsx scripts/verify-catalog-sync.ts <supabase-url> <service-or-anon-key>
 */
import { createClient } from '@supabase/supabase-js';
import { VERIFIED_PRODUCTS } from '../src/data/verifiedProducts';
import { PRODUCT_IMAGE_MAP } from '../src/data/productImageMap';

const [url, key] = process.argv.slice(2);
if (!url || !key) {
  console.error('usage: npx tsx scripts/verify-catalog-sync.ts <supabase-url> <key>');
  process.exit(1);
}

const sb = createClient(url, key);
const { data, error } = await sb.from('products').select('*');
if (error) {
  console.error('Cloud fetch failed:', error.message);
  process.exit(1);
}

const cloud = new Map<string, Record<string, unknown>>((data ?? []).map((r) => [r.id as string, r]));
let fails = 0;

const check = (ok: boolean, msg: string) => {
  if (!ok) {
    fails++;
    console.log('FAIL ' + msg);
  }
};

check(cloud.size === VERIFIED_PRODUCTS.length, `row count: cloud=${cloud.size} bundled=${VERIFIED_PRODUCTS.length}`);

const comparable: Array<[string, (p: Record<string, unknown>) => unknown]> = [
  ['name', (r) => r.name],
  ['slug', (r) => r.slug],
  ['description', (r) => r.description],
  ['price', (r) => Number(r.price)],
  ['mrp', (r) => (r.mrp == null ? null : Number(r.mrp))],
  ['discount_percent', (r) => (r.discount_percent == null ? null : Number(r.discount_percent))],
  ['category_id', (r) => r.category_id],
  ['category_name', (r) => r.category_name ?? undefined],
  ['image_url', (r) => r.image_url],
  ['in_stock', (r) => r.in_stock !== false],
  ['featured', (r) => Boolean(r.featured)],
  ['is_active', (r) => r.is_active !== false],
  ['source', (r) => r.source ?? undefined],
  ['reference_verified', (r) => Boolean(r.reference_verified)],
  ['is_mystery_scoop', (r) => Boolean(r.is_mystery_scoop)],
  ['is_kashmiri_earring', (r) => Boolean(r.is_kashmiri_earring)],
  ['additional_images', (r) => JSON.stringify(r.additional_images ?? [])],
  ['tags', (r) => JSON.stringify(r.tags ?? [])],
];

for (const vp of VERIFIED_PRODUCTS) {
  const row = cloud.get(vp.id);
  if (!row) {
    check(false, `missing in cloud: ${vp.id}`);
    continue;
  }
  for (const [field, get] of comparable) {
    const a = get(vp as unknown as Record<string, unknown>);
    const b = get(row);
    check(JSON.stringify(a) === JSON.stringify(b), `${vp.id}.${field}: bundled=${JSON.stringify(a)} cloud=${JSON.stringify(b)}`);
  }
}

// Deterministic image integrity: every cloud row's image_url must equal
// PRODUCT_IMAGE_MAP[product.id]; unverified products carry the safe empty fallback.
let mapped = 0;
const unverified: string[] = [];
for (const [, row] of cloud) {
  const expected = PRODUCT_IMAGE_MAP[row.id as string];
  check(row.image_url === (expected ?? ''), `${row.id} image_url not deterministic: "${row.image_url}"`);
  if (row.image_url) mapped++;
  if (!row.reference_verified) unverified.push(`${row.id} (${row.name})`);
}

console.log(`image mapping: ${mapped}/${cloud.size} rows carry a deterministic image; unverified: ${unverified.length}`);
for (const u of unverified) console.log('  unverified: ' + u);

console.log(fails === 0 ? `\nRESULT: ALL CHECKS PASSED (${cloud.size} products)` : `\nRESULT: ${fails} check(s) failed`);
process.exit(fails === 0 ? 0 : 1);
