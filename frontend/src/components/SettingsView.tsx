import React, { useState } from "react";
import { SystemConfig, CachedQuery } from "../types.js";
import { 
  Sliders, 
  Server, 
  Trash2, 
  ShieldAlert, 
  CheckCircle2, 
  ToggleLeft, 
  Cpu, 
  RefreshCw,
  AlertTriangle,
  Zap,
  BookOpen
} from "lucide-react";

interface SettingsViewProps {
  config: SystemConfig;
  onUpdateConfig: (newConfig: Partial<SystemConfig>) => void;
  cacheEntries: CachedQuery[];
  onClearCache: () => Promise<void>;
  onRefreshCacheList: () => Promise<void>;
}

export default function SettingsView({
  config,
  onUpdateConfig,
  cacheEntries,
  onClearCache,
  onRefreshCacheList
}: SettingsViewProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshCache = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshCacheList();
    } catch (e) {
      console.error(e);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="space-y-6 pb-28">
      {/* Visual failover and node status card */}
      <div className="bg-[#fdfbf7] p-5 rounded-xl border border-brand-sand-200/50 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-[#2c2417]">
            <Cpu className="w-5 h-5 text-brand-terracotta-500" />
            <h2 className="font-display font-semibold text-base uppercase tracking-wide">
              Simulated Dual-Key Failover Nodes
            </h2>
          </div>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
            config.failoverEnabled ? "bg-brand-sage-100 text-brand-sage-600" : "bg-gray-100 text-gray-500"
          }`}>
            {config.failoverEnabled ? "Failover Path Armed" : "Disabled"}
          </span>
        </div>

        <p className="text-xs text-gray-500 leading-normal">
          Toggle Key 1 or Key 2 health to simulate real-world rate-limit constraints. When Key 1 is set to **Invalid**, sending a chat question will immediately return an simulated HTTP 429 rate limit error on Key 1, and visually route your query through Key 2 automatically!
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Node 1 */}
          <div className={`p-4 rounded-xl border transition-all ${
            config.activeGroqKey === "Key 1" && config.groqKey1Valid
              ? "bg-brand-sage-100/30 border-brand-sage-500/30"
              : "bg-brand-sand-50/10 border-brand-sand-200/40"
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold text-brand-slate-800">GROQ_API_KEY_1 (Primary Node)</span>
              <div className="flex items-center space-x-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${
                  config.groqKey1Valid ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                }`} />
                <span className="text-[10px] font-mono font-semibold">
                  {config.groqKey1Valid ? "Active/Healthy" : "Simulated 429 Error"}
                </span>
              </div>
            </div>
            
            <div className="mt-4 flex items-center justify-between">
              <span className="text-[11px] text-gray-500">Key status toggle:</span>
              <button 
                onClick={() => onUpdateConfig({ groqKey1Valid: !config.groqKey1Valid })}
                className={`text-xs px-3 py-1 rounded-md font-semibold font-mono ${
                  config.groqKey1Valid 
                    ? "bg-rose-500/10 text-rose-500 hover:bg-rose-500/15" 
                    : "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/15"
                }`}
              >
                {config.groqKey1Valid ? "Trigger HTTP 429" : "Restore Key Health"}
              </button>
            </div>
          </div>

          {/* Node 2 */}
          <div className={`p-4 rounded-xl border transition-all ${
            config.activeGroqKey === "Key 2" && config.groqKey2Valid
              ? "bg-brand-sage-100/30 border-brand-sage-500/30"
              : "bg-brand-sand-50/10 border-brand-sand-200/40"
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold text-brand-slate-800">GROQ_API_KEY_2 (Failover Node)</span>
              <div className="flex items-center space-x-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${
                  config.groqKey2Valid ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                }`} />
                <span className="text-[10px] font-mono font-semibold">
                  {config.groqKey2Valid ? "Active/Healthy" : "Simulated 429 Error"}
                </span>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className="text-[11px] text-gray-500">Key status toggle:</span>
              <button 
                onClick={() => onUpdateConfig({ groqKey2Valid: !config.groqKey2Valid })}
                className={`text-xs px-3 py-1 rounded-md font-semibold font-mono ${
                  config.groqKey2Valid 
                    ? "bg-rose-500/10 text-rose-500 hover:bg-rose-500/15" 
                    : "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/15"
                }`}
              >
                {config.groqKey2Valid ? "Trigger HTTP 429" : "Restore Key Health"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Semantic Cache inspector */}
      <div className="bg-[#fdfbf7] p-5 rounded-xl border border-brand-sand-200/50 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-[#2c2417]">
            <Server className="w-5 h-5 text-cyan-500" />
            <h2 className="font-display font-semibold text-base uppercase tracking-wide">
              Redis Semantic Cache Registry
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={handleRefreshCache}
              disabled={isRefreshing}
              className="p-1.5 text-gray-500 hover:text-brand-terracotta-500 hover:bg-brand-sand-100/50 rounded-md transition-colors"
              title="Refresh cache keys"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </button>
            <button 
              onClick={onClearCache}
              className="flex items-center space-x-1 px-3 py-1 bg-rose-50 text-rose-600 rounded-md text-xs font-semibold hover:bg-rose-100/70 border border-rose-100 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Flush Cache</span>
            </button>
          </div>
        </div>

        {/* Cache List */}
        <div className="border border-brand-sand-200/30 rounded-xl overflow-hidden divide-y divide-brand-sand-200/20 bg-white">
          {cacheEntries.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-xs italic">
              Semantic Cache is currently empty. Send RAG queries in the Chat playground to preheat answers into Redis.
            </div>
          ) : (
            cacheEntries.map((entry) => (
              <div key={entry.id} className="p-4 space-y-2 hover:bg-brand-sand-50/10 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700 font-semibold font-mono text-[9px]">
                    qa_cache:{entry.id}
                  </span>
                  <div className="flex items-center space-x-3 text-[10px] text-gray-500 font-mono">
                    <span>Hits: {entry.hitCount}</span>
                    <span>&bull;</span>
                    <span>Cached {entry.createdAt}</span>
                    <span>&bull;</span>
                    <span>Last Hit: {entry.lastHitAt}</span>
                  </div>
                </div>
                
                <div className="text-xs space-y-1">
                  <div className="flex items-start space-x-1.5">
                    <span className="font-semibold text-brand-slate-800 text-[10px] font-mono mt-0.5">Q:</span>
                    <p className="text-gray-700 font-medium font-display leading-relaxed">{entry.question}</p>
                  </div>
                  <div className="flex items-start space-x-1.5 pl-4 border-l-2 border-cyan-500/20">
                    <span className="font-semibold text-cyan-600 text-[10px] font-mono mt-0.5">A:</span>
                    <p className="text-gray-500 line-clamp-2 select-none">{entry.answer}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
