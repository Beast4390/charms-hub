import React from 'react';
import { ChatMessage as ChatMessageType } from '../../types';
import { ChatProductCard } from './ChatProductCard';
import { Sparkles, MessageCircle } from 'lucide-react';

interface ChatMessageProps {
  message: ChatMessageType;
  onNavigate?: () => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, onNavigate }) => {
  const isUser = message.sender === 'user';

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} my-2`}>
      <div className="flex items-start gap-2 max-w-[88%]">
        {!isUser && (
          <div className="w-7 h-7 rounded-full bg-[#FFD2C2] dark:bg-[#7A1921] flex items-center justify-center text-[#789A99] dark:text-[#F1E194] shrink-0 mt-0.5 shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
        )}
        <div
          className={`rounded-2xl p-3 text-xs sm:text-sm leading-relaxed ${
            isUser
              ? 'bg-[#789A99] text-white dark:bg-[#F1E194] dark:text-[#3F070B] rounded-tr-xs'
              : 'bg-white dark:bg-[#5B0E14] text-[#2B1810] dark:text-[#FCF7DC] border border-[#F3DDD5] dark:border-[#7A1921] rounded-tl-xs shadow-xs'
          }`}
        >
          <p className="whitespace-pre-line">{message.text}</p>
        </div>
      </div>

      {/* Recommended product cards list */}
      {message.recommendedProducts && message.recommendedProducts.length > 0 && (
        <div className="w-full mt-2 pl-9 pr-2 space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#789A99] dark:text-[#E3D1AC]">
            Matching Verified Products:
          </div>
          <div className="grid grid-cols-1 gap-2">
            {message.recommendedProducts.map((product) => (
              <ChatProductCard
                key={product.id}
                product={product}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      )}

      {/* Verified knowledge sources used to ground the answer */}
      {message.knowledgeSources && message.knowledgeSources.length > 0 && (
        <div className="w-full mt-2 pl-9 pr-2 space-y-1.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#789A99] dark:text-[#E3D1AC]">
            Based on verified Charms Hub information:
          </div>
          {message.knowledgeSources.map((src, idx) => (
            <details key={idx} className="rounded-xl bg-white dark:bg-[#5B0E14] border border-[#F3DDD5] dark:border-[#7A1921] p-2.5">
              <summary className="text-[11px] font-bold text-[#2B1810] dark:text-[#FCF7DC] cursor-pointer">
                {src.title}
                <span className="ml-1.5 text-[9px] font-bold uppercase text-[#789A99] dark:text-[#F1E194]">{src.category}</span>
              </summary>
              <p className="text-[11px] text-gray-600 dark:text-stone-300 mt-1.5 whitespace-pre-line">{src.content}</p>
            </details>
          ))}
        </div>
      )}

      {/* Grounding indicator */}
      {message.grounding && !message.isFallback && (
        <span className="text-[9px] text-[#789A99] dark:text-[#F1E194] mt-1 pl-9 font-bold uppercase tracking-wider">
          {message.grounding === 'gemini' ? '✦ Gemini-grounded answer' : '✦ Verified database answer'}
        </span>
      )}

      {/* Optional verified action link */}
      {message.actionType === 'contact_whatsapp' && (
        <div className="mt-2 pl-9">
          <a
            href="https://wa.me/919876543210?text=Hello%20Charms%20Hub,%20I%20have%20a%20question"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 transition"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>Ask support on WhatsApp</span>
          </a>
        </div>
      )}

      <span className="text-[9px] text-gray-400 mt-1 px-1">
        {message.timestamp}
      </span>
    </div>
  );
};
