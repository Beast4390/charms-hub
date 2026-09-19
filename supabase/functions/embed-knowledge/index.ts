// ============================================================
// Charms Hub AI — embed-knowledge Edge Function
//
// Generates Gemini embeddings for knowledge_base rows so the
// match_knowledge_base RPC can perform semantic retrieval.
// Only shop_owner / developer sessions may trigger re-indexing.
// Rows that fail keep embedding_status='failed' (visible in the
// owner dashboard); no content is ever invented.
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const EMBED_MODEL = Deno.env.get('GEMINI_EMBED_MODEL') ?? 'text-embedding-004';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function embedText(text: string, apiKey: string): Promise<number[] | null> {
  const res = await fetch(
    `${GEMINI_BASE}/models/${EMBED_MODEL}:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: `models/${EMBED_MODEL}`, content: { parts: [{ text: text.slice(0, 4000) }] } }),
    },
  );
  if (!res.ok) {
    throw new Error(`Embedding API error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const json = await res.json();
  return json?.embedding?.values ?? null;
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

    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // Owner/developer only (RLS-backed role source)
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', authData.user.id)
      .maybeSingle();
    if (!profile || !['shop_owner', 'developer'].includes(profile.role)) {
      return new Response(JSON.stringify({ error: 'Only Shop Owner or Developer can re-index knowledge' }), { status: 403, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY is not configured in Edge Function secrets', indexed: 0, failed: 0, pending: 'unknown' }), { status: 503, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    let force = false;
    try {
      const body = await req.json();
      force = Boolean(body?.force);
    } catch { /* empty body is fine */ }

    let query = supabase
      .from('knowledge_base')
      .select('id, title, content, embedding_status')
      .eq('is_active', true);
    if (!force) query = query.neq('embedding_status', 'indexed');

    const { data: rows, error } = await query;
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    let indexed = 0;
    let failed = 0;
    for (const row of rows ?? []) {
      // Mark in-flight so duplicate jobs don't double-embed the same rows
      await supabase
        .from('knowledge_base')
        .update({ embedding_status: 'processing' })
        .eq('id', row.id);
      try {
        const values = await embedText(`${row.title}\n\n${row.content}`, apiKey);
        if (!values) throw new Error('empty embedding');
        const { error: upErr } = await supabase
          .from('knowledge_base')
          .update({ embedding: values as unknown, embedding_status: 'indexed', indexed_at: new Date().toISOString() })
          .eq('id', row.id);
        if (upErr) throw new Error(upErr.message);
        indexed++;
      } catch (err) {
        failed++;
        console.error(`Embedding failed for ${row.id}:`, err);
        await supabase
          .from('knowledge_base')
          .update({ embedding_status: 'failed', indexed_at: new Date().toISOString() })
          .eq('id', row.id);
      }
    }

    return new Response(
      JSON.stringify({ indexed, failed, total: rows?.length ?? 0, model: EMBED_MODEL }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('embed-knowledge error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }
});
