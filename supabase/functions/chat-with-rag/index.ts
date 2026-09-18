// ============================================================
// Charms Hub AI — chat-with-rag Edge Function
//
// Flow: authenticated caller -> intent classification ->
// structured product retrieval (Postgres, RLS as caller) ->
// knowledge retrieval (pgvector via match_knowledge_base) ->
// grounded Gemini generation -> response.
//
// GEMINI_API_KEY is read from Supabase Edge Function secrets and is
// NEVER exposed to the browser. When the key is absent the function
// degrades honestly to retrieval-only mode (verified context returned,
// no LLM generation).
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const EMBED_MODEL = 'text-embedding-004';
const GEN_MODEL = 'gemini-2.0-flash';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SYSTEM_INSTRUCTION = `You are the Charms Hub AI shopping and business assistant.

Use ONLY the verified context supplied by the application.

Never invent:
- products
- prices
- discounts
- stock
- policies
- shipping fees
- business facts
- payment methods
- delivery times
- contact information
- product specifications

When verified information is unavailable, respond exactly:
"I don't have verified information about that."

Do not guess. Do not infer unsupported business policies. Do not fabricate answers.
If the context contains product records, you may reference only those exact products,
their exact prices, and their exact availability.`;

interface ChatRequestBody {
  question?: string;
}

interface KnowledgeRow {
  id: string;
  title: string;
  content: string;
  category: string;
  source: string;
  similarity?: number;
}

const CATEGORY_MAP: Array<[string[], string]> = [
  [['bracelet', 'bangle', 'wrist'], 'cat-bracelets'],
  [['earring', 'jhumka', 'kashmiri'], 'cat-earrings'],
  [['ring', 'solitaire', 'tiara'], 'cat-rings'],
  [['hair', 'claw', 'hairpin', 'pin', 'bow', 'hairband'], 'cat-hair-accessories'],
  [['mystery', 'scoop'], 'cat-mystery-scoop'],
  [['stationery', 'sharpener', 'glue', 'eraser'], 'cat-quirky-stationery'],
  [['organizer', 'pouch', 'makeup'], 'cat-organizers'],
  [['keychain', 'keychain', 'evil eye'], 'cat-quirky-keychains'],
];

function classifyIntent(question: string): {
  type: 'product' | 'knowledge' | 'mixed';
  categoryId?: string;
  maxPrice?: number;
  minPrice?: number;
  keywords: string[];
} {
  const lower = question.toLowerCase();
  const isProductKw = /\b(show|find|product|buy|have|recommend|item|cost|price|available|stock|cheap|under|above)\b/.test(lower)
    || CATEGORY_MAP.some(([words]) => words.some((w) => lower.includes(w)));
  const isKnowledgeKw = /\b(deliver|ship|shipping|return|refund|cancel|cancellation|payment|pay|upi|cod|cash|policy|contact|support|whatsapp|order|ordering|care|instagram|track|tracking)\b/.test(lower);

  let categoryId: string | undefined;
  for (const [words, id] of CATEGORY_MAP) {
    if (words.some((w) => lower.includes(w))) {
      categoryId = id;
      break;
    }
  }

  const underMatch = lower.match(/(?:under|below|less than|within)\s*(?:₹|rs\.?|inr)?\s*(\d+)/);
  const aboveMatch = lower.match(/(?:above|more than|over)\s*(?:₹|rs\.?|inr)?\s*(\d+)/);

  const type: 'product' | 'knowledge' | 'mixed' =
    isProductKw && isKnowledgeKw ? 'mixed' : isProductKw ? 'product' : 'knowledge';

  const keywords = lower
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !['show', 'find', 'have', 'the', 'and', 'for', 'you', 'your', 'are', 'with', 'about', 'what', 'how', 'can', 'tell', 'me', 'does', 'this', 'that'].includes(w))
    .slice(0, 5);

  return {
    type,
    categoryId,
    maxPrice: underMatch ? parseInt(underMatch[1], 10) : undefined,
    minPrice: aboveMatch ? parseInt(aboveMatch[1], 10) : undefined,
    keywords,
  };
}

async function embedText(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const res = await fetch(
      `${GEMINI_BASE}/models/${EMBED_MODEL}:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: `models/${EMBED_MODEL}`, content: { parts: [{ text }] } }),
      },
    );
    if (!res.ok) {
      console.error('Embedding failed:', await res.text());
      return null;
    }
    const json = await res.json();
    return json?.embedding?.values ?? null;
  } catch (err) {
    console.error('Embedding error:', err);
    return null;
  }
}

async function generateAnswer(question: string, contextBlocks: string, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${GEMINI_BASE}/models/${GEN_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          contents: [
            {
              role: 'user',
              parts: [{
                text: `VERIFIED CONTEXT FROM CHARMS HUB DATABASE:\n${contextBlocks}\n\nCUSTOMER QUESTION: ${question}`,
              }],
            },
          ],
          generationConfig: { temperature: 0.2, maxOutputTokens: 400 },
        }),
      },
    );
    if (!res.ok) {
      console.error('Generation failed:', await res.text());
      return null;
    }
    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? '')
      .join('')
      .trim();
    return text || null;
  } catch (err) {
    console.error('Generation error:', err);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    // 1. Authentication is mandatory
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    const body: ChatRequestBody = await req.json();
    const question = (body.question ?? '').trim();
    if (!question || question.length > 500) {
      return new Response(JSON.stringify({ error: 'A question of 1-500 characters is required' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // 2. Intent classification
    const intent = classifyIntent(question);

    // 3. Structured product retrieval — straight from Postgres through the
    //    caller's JWT, so RLS applies and records are always current.
    let products: Array<Record<string, unknown>> = [];
    if (intent.type !== 'knowledge') {
      let query = supabase
        .from('products')
        .select('id,name,price,mrp,discount_percent,category_id,category_name,image_url,in_stock')
        .eq('is_active', true);
      if (intent.categoryId) query = query.eq('category_id', intent.categoryId);
      if (intent.maxPrice) query = query.lte('price', intent.maxPrice);
      if (intent.minPrice) query = query.gte('price', intent.minPrice);
      if (!intent.categoryId && intent.keywords.length > 0) {
        const ors = intent.keywords
          .flatMap((kw) => [`name.ilike.%${kw}%`, `description.ilike.%${kw}%`, `category_name.ilike.%${kw}%`])
          .join(',');
        query = query.or(ors);
      }
      const { data, error } = await query.order('price', { ascending: true }).limit(5);
      if (error) console.error('Product query failed:', error.message);
      products = data ?? [];
    }

    // 4. Knowledge retrieval — pgvector semantic search (or keyword fallback
    //    when Gemini is not configured). Only verified active chunks.
    let knowledge: KnowledgeRow[] = [];
    let grounding: 'gemini' | 'retrieval_only' = 'retrieval_only';
    let warning: string | undefined;
    const geminiKey = Deno.env.get('GEMINI_API_KEY');

    if (intent.type !== 'product') {
      if (geminiKey) {
        const qEmbed = await embedText(question, geminiKey);
        if (qEmbed) {
          const { data, error } = await supabase.rpc('match_knowledge_base', {
            p_query_embedding: qEmbed,
            p_match_threshold: 0.72,
            p_match_count: 3,
          });
          if (error) console.error('Vector search failed:', error.message);
          knowledge = (data as KnowledgeRow[]) ?? [];
        } else {
          warning = 'Embedding generation failed';
        }
      } else {
        const kws = intent.keywords.slice(0, 3);
        let kq = supabase
          .from('knowledge_base')
          .select('id,title,content,category,source')
          .eq('is_active', true)
          .limit(3);
        if (kws.length > 0) {
          kq = kq.or(kws.flatMap((k) => [`title.ilike.%${k}%`, `content.ilike.%${k}%`, `category.ilike.%${k}%`]).join(','));
        }
        const { data, error } = await kq;
        if (error) console.error('Knowledge fallback query failed:', error.message);
        knowledge = data ?? [];
      }
    }

    // 5. Grounded generation
    let answer: string | null = null;
    if (geminiKey) {
      const blocks: string[] = [];
      if (products.length > 0) {
        blocks.push('CURRENT PRODUCT RECORDS (exact, authoritative):\n' + products
          .map((p) => `- ${p.name} | Rs.${p.price}${p.mrp ? ` (MRP Rs.${p.mrp})` : ''} | category: ${p.category_name} | ${p.in_stock ? 'in stock' : 'OUT OF STOCK'}`)
          .join('\n'));
      } else if (intent.type !== 'knowledge') {
        blocks.push('PRODUCT SEARCH RESULT: no products matched this request in the current database.');
      }
      if (knowledge.length > 0) {
        blocks.push('VERIFIED BUSINESS KNOWLEDGE:\n' + knowledge.map((k) => `- [${k.category}] ${k.title}: ${k.content}`).join('\n'));
      }
      if (blocks.length > 0) {
        answer = await generateAnswer(question, blocks.join('\n\n'), geminiKey);
        if (answer) grounding = 'gemini';
        else warning = 'AI generation failed; verified context returned instead';
      } else {
        answer = "I don't have verified information about that.";
        grounding = 'gemini';
      }
    }

    return new Response(
      JSON.stringify({ intent, products, knowledge, answer, grounding, warning }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('chat-with-rag error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }
});
