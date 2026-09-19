// ============================================================
// Charms Hub AI — ai-status Edge Function
//
// Reports AI/RAG operational status for the developer dashboard.
// Returns ONLY non-secret derived values: whether GEMINI_API_KEY is
// configured, model names, and retrieval parameters. Never returns
// the secret itself.
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
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

    // Developer-only operational endpoint
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', authData.user.id)
      .maybeSingle();
    if (!profile || profile.role !== 'developer') {
      return new Response(JSON.stringify({ error: 'Developer access required' }), { status: 403, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    const geminiConfigured = Boolean(Deno.env.get('GEMINI_API_KEY'));

    const { count: knowledgeTotal } = await supabase
      .from('knowledge_base')
      .select('id', { count: 'exact', head: true });
    const { count: knowledgeIndexed } = await supabase
      .from('knowledge_base')
      .select('id', { count: 'exact', head: true })
      .eq('embedding_status', 'indexed');
    const { count: knowledgePending } = await supabase
      .from('knowledge_base')
      .select('id', { count: 'exact', head: true })
      .eq('embedding_status', 'pending');
    const { count: knowledgeProcessing } = await supabase
      .from('knowledge_base')
      .select('id', { count: 'exact', head: true })
      .eq('embedding_status', 'processing');
    const { count: knowledgeFailed } = await supabase
      .from('knowledge_base')
      .select('id', { count: 'exact', head: true })
      .eq('embedding_status', 'failed');

    return new Response(
      JSON.stringify({
        ai_mode: geminiConfigured ? 'gemini_rag' : 'retrieval_only',
        gemini_configured: geminiConfigured,
        model: Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.0-flash',
        embed_model: Deno.env.get('GEMINI_EMBED_MODEL') ?? 'text-embedding-004',
        similarity_threshold: Number(Deno.env.get('RAG_SIMILARITY_THRESHOLD') ?? '0.72'),
        max_chunks: Number(Deno.env.get('RAG_MAX_CHUNKS') ?? '3'),
        rag: {
          total: knowledgeTotal ?? 0,
          indexed: knowledgeIndexed ?? 0,
          pending: knowledgePending ?? 0,
          processing: knowledgeProcessing ?? 0,
          failed: knowledgeFailed ?? 0,
        },
      }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('ai-status error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }
});
