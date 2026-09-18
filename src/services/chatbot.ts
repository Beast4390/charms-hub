import { supabase, isSupabaseConfigured } from './supabase';
import { Product } from '../types';

export interface KnowledgeSource {
  title: string;
  content: string;
  category: string;
  source: string;
}

export interface ChatbotReply {
  text: string;
  recommendedProducts?: Product[];
  knowledgeSources?: KnowledgeSource[];
  actionType?: 'view_products' | 'contact_whatsapp' | 'view_policy';
  isFallback?: boolean;
  /** 'gemini' = generated from verified context; 'retrieval_only' = raw verified content. */
  grounding?: 'gemini' | 'retrieval_only';
}

interface EdgeChatResponse {
  intent?: { type: 'product' | 'knowledge' | 'mixed' };
  products?: Product[];
  knowledge?: KnowledgeSource[];
  answer?: string | null;
  grounding?: 'gemini' | 'retrieval_only';
  warning?: string;
  error?: string;
}

const REFUSAL =
  "I don't have verified information about that. As the Charms Hub Shopping Assistant, I can answer questions about verified products, prices, stock, Indian delivery timelines (4-7 business days), free shipping above Rs. 499, payments (UPI / Cash on Delivery), and cancellations.";

/**
 * Real RAG pipeline: the authenticated Edge Function classifies intent,
 * retrieves structured product data from Postgres and verified knowledge
 * (pgvector semantic search), then generates a grounded Gemini answer.
 * Without a configured GEMINI_API_KEY the function degrades to
 * retrieval-only mode — verified content is returned verbatim, never invented.
 */
export async function processChatbotQuery(userText: string): Promise<ChatbotReply> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      text: "The AI assistant is unavailable because cloud services are not configured. Please contact our support team on WhatsApp for help.",
      actionType: 'contact_whatsapp',
      isFallback: true,
    };
  }

  // The RAG pipeline runs in an authenticated Edge Function.
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    return {
      text: "Please sign in to chat with the Charms Hub AI assistant — it answers from your live account, orders, and our verified catalog.",
      actionType: 'view_policy',
      isFallback: true,
    };
  }

  const { data, error } = await supabase.functions.invoke('chat-with-rag', {
    body: { question: userText.trim().slice(0, 500) },
  });

  if (error) {
    console.error('chat-with-rag failed:', error.message);
    return {
      text: "I'm having trouble reaching the verified Charms Hub knowledge base right now. Please try again, or contact our team on WhatsApp.",
      actionType: 'contact_whatsapp',
      isFallback: true,
    };
  }

  const payload = data as EdgeChatResponse;
  if (payload.error) {
    return {
      text: payload.error,
      actionType: 'contact_whatsapp',
      isFallback: true,
    };
  }

  const products = payload.products ?? [];
  const knowledge = payload.knowledge ?? [];

  // Gemini-grounded answer
  if (payload.grounding === 'gemini' && payload.answer) {
    return {
      text: payload.answer,
      recommendedProducts: products.length > 0 ? products : undefined,
      knowledgeSources: knowledge.length > 0 ? knowledge : undefined,
      actionType: products.length > 0 ? 'view_products' : undefined,
      grounding: 'gemini',
    };
  }

  // Retrieval-only mode: verified content rendered verbatim, never generated.
  if (products.length > 0 && (payload.intent?.type === 'product' || products.length > 0)) {
    return {
      text: "Here are the current verified Charms Hub products matching your request, straight from our live catalog. Tap any item to view details or add it to your bag:",
      recommendedProducts: products,
      knowledgeSources: knowledge.length > 0 ? knowledge : undefined,
      actionType: 'view_products',
      grounding: 'retrieval_only',
    };
  }

  if (knowledge.length > 0) {
    return {
      text: knowledge.map((k) => `${k.title}: ${k.content}`).join('\n\n'),
      knowledgeSources: knowledge,
      grounding: 'retrieval_only',
    };
  }

  return {
    text: REFUSAL,
    actionType: 'contact_whatsapp',
    isFallback: true,
    grounding: 'retrieval_only',
  };
}
