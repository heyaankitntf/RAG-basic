import React, { useState, useRef, useEffect } from "react";
import { Message, Chunk } from "../types.js";
import { 
  Send, 
  Sparkles, 
  Server, 
  Database, 
  Cpu, 
  ChevronDown, 
  ChevronUp, 
  FileText,
  User,
  ExternalLink,
  Building2
} from "lucide-react";

interface ChatPlaygroundViewProps {
  messages: Message[];
  onSendMessage: (text: string) => Promise<void>;
  isGenerating: boolean;
}

export default function ChatPlaygroundView({
  messages,
  onSendMessage,
  isGenerating
}: ChatPlaygroundViewProps) {
  const [inputText, setInputText] = useState("");
  const [expandedChunks, setExpandedChunks] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isGenerating]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isGenerating) return;
    onSendMessage(inputText.trim());
    setInputText("");
  };

  const toggleChunks = (messageId: string) => {
    setExpandedChunks(prev => ({
      ...prev,
      [messageId]: !prev[messageId]
    }));
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] min-h-[450px] relative pb-10">
      
      {/* Scrollable Chat Area */}
      <div className="flex-1 overflow-y-auto space-y-4 px-1 pr-2">
        {messages.length === 0 ? (
          /* Empty Chat Splash */
          <div className="flex flex-col items-center justify-center text-center h-full py-16 px-6 max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-terracotta-50 to-brand-terracotta-500/10 flex items-center justify-center text-brand-terracotta-500 shadow-md border border-brand-terracotta-500/20 mb-6">
              <Building2 className="w-8 h-8" />
            </div>
            <h3 className="font-display text-xl font-bold text-brand-slate-800">
              Query Lexicon Enterprise RAG
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed mt-2 select-none">
              Ask anything about employee onboarding, IT security protocols, or customer SLA agreements. The system will extract grounded facts from corporate documentation or hit the Redis cache!
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mt-8">
              <button 
                onClick={() => onSendMessage("What is the password complexity and MFA requirement?")}
                className="p-3 text-left bg-brand-sand-50 rounded-xl border border-brand-sand-200 hover:border-brand-terracotta-500 transition-colors text-xs text-brand-slate-800 hover:text-brand-terracotta-500"
              >
                <span className="font-semibold block mb-0.5 font-display">Security protocols</span>
                "What is the password complexity and MFA requirement?"
              </button>
              <button 
                onClick={() => onSendMessage("What are the response time SLAs for Severity 1 issues?")}
                className="p-3 text-left bg-brand-sand-50 rounded-xl border border-brand-sand-200 hover:border-brand-terracotta-500 transition-colors text-xs text-brand-slate-800 hover:text-brand-terracotta-500"
              >
                <span className="font-semibold block mb-0.5 font-display">Customer SLA</span>
                "What are the response time SLAs for Severity 1 issues?"
              </button>
            </div>
          </div>
        ) : (
          /* Render Active Messages */
          messages.map((msg) => {
            const isUser = msg.role === "user";
            return (
              <div 
                key={msg.id}
                className={`flex flex-col max-w-[85%] ${isUser ? "ml-auto items-end" : "mr-auto items-start"}`}
              >
                {/* Bubble */}
                <div 
                  className={`rounded-2xl px-4 py-3 text-sm shadow-sm leading-relaxed ${
                    isUser 
                      ? "bg-gradient-to-br from-brand-terracotta-500 to-indigo-700 text-white rounded-br-none" 
                      : "bg-[#fdfbf7] border border-brand-sand-200 text-[#2c2417] rounded-bl-none"
                  }`}
                >
                  <p className="whitespace-pre-line">{msg.content}</p>
                </div>

                {/* Sub-label info & Source Badges (for assistant responses) */}
                {!isUser && msg.role !== "system" && (
                  <div className="flex flex-col items-start mt-2 space-y-1.5 w-full">
                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-500 font-mono">
                      {msg.source === "cache" ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700 font-semibold border border-cyan-200/30">
                          <Server className="w-3 h-3 mr-1" />
                          ⚡ From Cache
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-brand-sage-100 text-brand-sage-600 font-semibold border border-brand-sage-500/10">
                          <Database className="w-3 h-3 mr-1" />
                          🗄️ From Database
                        </span>
                      )}

                      <span>&bull;</span>
                      <span>{msg.latencyMs} ms</span>
                      
                      {msg.modelUsed && (
                        <>
                          <span>&bull;</span>
                          <span className="text-gray-400">{msg.modelUsed}</span>
                        </>
                      )}

                      {/* Inspect chunks toggle button */}
                      {msg.retrievedChunks && msg.retrievedChunks.length > 0 && (
                        <button 
                          onClick={() => toggleChunks(msg.id)}
                          className="flex items-center space-x-1 text-brand-terracotta-500 hover:text-brand-terracotta-600 font-semibold"
                        >
                          <span>&bull;</span>
                          <span>{expandedChunks[msg.id] ? "Hide Sources" : "Inspect Sources"}</span>
                          {expandedChunks[msg.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      )}
                    </div>

                    {/* Expandable Retrieval Drawer */}
                    {expandedChunks[msg.id] && msg.retrievedChunks && (
                      <div className="w-full bg-brand-sand-50/80 rounded-xl p-3 border border-brand-sand-200/50 space-y-2 mt-1">
                        <span className="text-[10px] font-mono font-bold text-brand-slate-800 uppercase tracking-wide block pb-1 border-b border-brand-sand-200/20">
                          Retrieved Document Contexts ({msg.retrievedChunks.length})
                        </span>
                        
                        <div className="space-y-2.5">
                          {msg.retrievedChunks.map((chunk, idx) => (
                            <div key={idx} className="text-xs space-y-1">
                              <div className="flex items-center justify-between text-[10px] text-brand-terracotta-500 font-mono">
                                <span className="flex items-center font-semibold">
                                  <FileText className="w-3 h-3 mr-1" />
                                  {chunk.docName}
                                </span>
                                <span>{chunk.wordCount} words</span>
                              </div>
                              <p className="text-gray-600 pl-4 border-l border-brand-sand-200/60 leading-relaxed italic bg-white/30 p-1.5 rounded">
                                "{chunk.content}"
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Streaming / Generation Loader placeholder */}
        {isGenerating && (
          <div className="flex flex-col max-w-[85%] mr-auto items-start">
            <div className="rounded-2xl px-4 py-3 text-sm bg-brand-sand-50 border border-brand-sand-200 text-gray-500 flex items-center space-x-2">
              <span className="flex space-x-1.5">
                <span className="w-2 h-2 bg-brand-terracotta-500 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-brand-terracotta-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                <span className="w-2 h-2 bg-brand-terracotta-500 rounded-full animate-bounce [animation-delay:0.4s]" />
              </span>
              <span className="text-xs font-mono select-none">Retrieving contexts & formatting answer...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form Bar */}
      <form 
        onSubmit={handleSubmit}
        className="absolute bottom-4 right-0 left-0 bg-white/70 backdrop-blur-md border border-brand-sand-200/50 rounded-full px-4 py-2 flex items-center space-x-2 shadow-sm focus-within:border-brand-terracotta-500 transition-colors"
      >
        <input 
          type="text"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          placeholder="Ask a corporate policy, IT compliance, or onboarding question..."
          className="flex-1 bg-transparent text-sm focus:outline-none text-brand-slate-800 placeholder-gray-400 px-1"
          disabled={isGenerating}
        />
        <button 
          type="submit"
          disabled={!inputText.trim() || isGenerating}
          className="p-2 bg-gradient-to-r from-brand-terracotta-500 to-brand-terracotta-600 hover:opacity-90 rounded-full text-white shadow-md disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>

    </div>
  );
}
