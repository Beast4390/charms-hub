import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, Bot, RotateCcw, ChevronDown } from 'lucide-react';
import { ChatMessage as ChatMessageType } from '../../types';
import { ChatMessage } from './ChatMessage';
import { processChatbotQuery } from '../../services/chatbot';

export const ChatbotModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessageType[]>([
    {
      id: 'welcome-1',
      sender: 'assistant',
      text: "Hello! ✨ I'm your Charms Hub AI Shopping Assistant.\n\nAsk me about our Kashmiri earrings, anti-tarnish jewelry, mystery scoops, hair accessories, or delivery policies.",
      timestamp: 'Just now',
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (userText: string) => {
    const textToSend = userText.trim();
    if (!textToSend || loading) return;

    const userMsg: ChatMessageType = {
      id: 'user_' + Date.now(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await processChatbotQuery(textToSend);
      const botMsg: ChatMessageType = {
        id: 'bot_' + Date.now(),
        sender: 'assistant',
        text: response.text,
        recommendedProducts: response.recommendedProducts,
        knowledgeSources: response.knowledgeSources,
        actionType: response.actionType,
        isFallback: response.isFallback,
        grounding: response.grounding,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      console.error('Chat error:', err);
      const errorMsg: ChatMessageType = {
        id: 'bot_err_' + Date.now(),
        sender: 'assistant',
        text: "I encountered an issue retrieving verified information. Please try again or chat with our team on WhatsApp.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestedClick = (prompt: string) => {
    handleSend(prompt);
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: 'welcome-1',
        sender: 'assistant',
        text: "Conversation refreshed. ✨ How can I help you find something special at Charms Hub today?",
        timestamp: 'Just now',
      },
    ]);
  };

  const suggestedQuestions = [
    'Show me bracelets under ₹300',
    'What earrings are available?',
    'How do I pay with UPI?',
    'How can I place an order?',
    'What are your delivery details?',
    'Can I cancel my order?',
  ];

  return (
    <>
      {/* Floating AI Assistant Trigger Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="group relative flex items-center gap-2.5 px-4 py-3 rounded-full bg-[#789A99] hover:bg-[#587978] dark:bg-[#F1E194] dark:hover:bg-[#E3D1AC] text-white dark:text-[#3F070B] shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer border-2 border-white dark:border-[#5B0E14]"
          aria-label="Open AI Shopping Assistant"
        >
          <div className="relative">
            <Sparkles className="w-5 h-5 animate-pulse" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-pink-400 dark:bg-emerald-600 animate-ping" />
          </div>
          <span className="text-xs sm:text-sm font-extrabold tracking-wide">
            {isOpen ? 'Close Assistant' : 'AI Shopping Assistant'}
          </span>
        </button>
      </div>

      {/* Expandable Chat Drawer Window */}
      {isOpen && (
        <div className="fixed bottom-22 right-4 sm:right-6 w-[calc(100vw-2rem)] sm:w-96 md:w-[420px] h-[550px] max-h-[80vh] bg-white dark:bg-[#5B0E14] border border-[#F3DDD5] dark:border-[#7A1921] rounded-3xl shadow-2xl z-50 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          
          {/* Header */}
          <div className="p-4 bg-[#FFD2C2]/50 dark:bg-[#3F070B] border-b border-[#F3DDD5] dark:border-[#7A1921] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-[#789A99] dark:bg-[#F1E194] text-white dark:text-[#3F070B] flex items-center justify-center shadow-xs">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-[#2B1810] dark:text-[#FCF7DC] flex items-center gap-1.5">
                  <span>Charms Hub AI</span>
                  <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-[#789A99]/20 dark:bg-[#F1E194]/20 text-[#789A99] dark:text-[#F1E194]">
                    Verified
                  </span>
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-stone-300">
                  Grounded in Charms Hub Catalog & Policies
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleResetChat}
                className="p-1.5 rounded-lg text-gray-500 dark:text-stone-300 hover:bg-white/60 dark:hover:bg-[#7A1921] transition"
                title="Reset conversation"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-gray-500 dark:text-stone-300 hover:bg-white/60 dark:hover:bg-[#7A1921] transition"
                title="Minimize assistant"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages Body */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#FFF8F5]/60 dark:bg-[#3F070B]/40">
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                onNavigate={() => setIsOpen(false)}
              />
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-stone-300 my-2 pl-9">
                <div className="w-2 h-2 rounded-full bg-[#789A99] dark:bg-[#F1E194] animate-ping" />
                <span>Checking verified Charms Hub catalog...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestions Pills */}
          <div className="px-3 py-2 bg-white dark:bg-[#5B0E14] border-t border-[#F3DDD5] dark:border-[#7A1921] overflow-x-auto whitespace-nowrap scrollbar-none flex gap-1.5">
            {suggestedQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSuggestedClick(q)}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#FFF1EC] dark:bg-[#7A1921] text-[#2B1810] dark:text-[#FCF7DC] hover:bg-[#FFD2C2] dark:hover:bg-[#8F1F28] transition shrink-0 border border-[#F3DDD5] dark:border-[#8F1F28]"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input Footer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(input);
            }}
            className="p-3 bg-white dark:bg-[#5B0E14] border-t border-[#F3DDD5] dark:border-[#7A1921] flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about products, prices, or delivery..."
              className="flex-1 text-xs sm:text-sm py-2 px-3.5 rounded-full border border-[#F3DDD5] dark:border-[#7A1921] bg-[#FFF8F5] dark:bg-[#3F070B] text-[#2B1810] dark:text-[#FCF7DC] focus:outline-hidden focus:ring-2 focus:ring-[#789A99] dark:focus:ring-[#F1E194]"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className={`p-2.5 rounded-full flex items-center justify-center transition ${
                input.trim() && !loading
                  ? 'bg-[#789A99] hover:bg-[#587978] dark:bg-[#F1E194] dark:hover:bg-[#E3D1AC] text-white dark:text-[#3F070B] shadow-md cursor-pointer'
                  : 'bg-gray-100 dark:bg-stone-800 text-gray-400 dark:text-stone-600 cursor-not-allowed'
              }`}
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
