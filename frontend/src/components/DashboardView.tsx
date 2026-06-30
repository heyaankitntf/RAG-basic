import React from "react";
import { RAGStats, SystemConfig } from "../types.js";
import { 
  Activity, 
  Cpu, 
  Database, 
  Server, 
  Zap, 
  Clock, 
  Sparkles, 
  Layers,
  ArrowRight,
  TrendingUp
} from "lucide-react";
import { motion } from "motion/react";

interface DashboardViewProps {
  stats: RAGStats;
  config: SystemConfig;
  onUpdateConfig: (newConfig: Partial<SystemConfig>) => void;
  onNavigateToChat: () => void;
  onNavigateToKB: () => void;
}

export default function DashboardView({ 
  stats, 
  config, 
  onUpdateConfig, 
  onNavigateToChat,
  onNavigateToKB
}: DashboardViewProps) {
  
  const cacheHitPercentage = stats.totalQueries > 0 
    ? Math.round((stats.cacheHits / stats.totalQueries) * 100) 
    : 0;

  return (
    <div className="space-y-6 pb-28">
      {/* Welcome Hero Banner */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-brand-terracotta-500 via-brand-terracotta-600 to-brand-slate-800 text-white p-6 sm:p-8 shadow-lg">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none" />
        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex items-center space-x-1.5 bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-mono font-medium tracking-wide text-brand-sand-50 mb-4">
            <Sparkles className="w-3 h-3 text-amber-200" />
            <span>Lexicon Enterprise RAG Workspace Active</span>
          </span>
          <h1 className="text-3xl sm:text-4xl font-display font-semibold tracking-tight text-brand-sand-50">
            Corporate Knowledge Ingestion & AI Grounding
          </h1>
          <p className="text-brand-sand-50/80 text-sm sm:text-base mt-2.5 leading-relaxed">
            Welcome to the Lexicon RAG workspace. Ground corporate operations in verified knowledge bases using high-speed semantic queries, Redis semantic caching, and Gemini's secure reasoning.
          </p>
          <div className="flex flex-wrap gap-3 mt-6">
            <button 
              onClick={onNavigateToChat}
              className="px-4 py-2 bg-brand-sand-50 hover:bg-brand-sand-100 text-[#2c2417] text-xs font-semibold rounded-lg shadow transition-all duration-200"
            >
              Start Chatting
            </button>
            <button 
              onClick={onNavigateToKB}
              className="px-4 py-2 bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs font-semibold rounded-lg transition-all duration-200"
            >
              Manage Knowledge Base
            </button>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Core Latency */}
        <div className="bg-[#fdfbf7] p-4 rounded-xl border border-brand-sand-200/50 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-brand-slate-800 uppercase tracking-wider">Avg Latency</span>
            <div className="p-1.5 bg-brand-terracotta-500/10 rounded-lg text-brand-terracotta-500">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-1">
            <span className="text-2xl font-display font-bold text-brand-slate-800">{stats.avgLatencyMs || "—"}</span>
            {stats.avgLatencyMs > 0 && <span className="text-[10px] font-mono text-gray-500">ms</span>}
          </div>
          <p className="text-[11px] text-gray-500 mt-1 select-none">
            {stats.cacheHits > 0 ? "Fast cache-optimized rate" : "Direct model responses"}
          </p>
        </div>

        {/* Cache Hit Rate */}
        <div className="bg-[#fdfbf7] p-4 rounded-xl border border-brand-sand-200/50 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-brand-slate-800 uppercase tracking-wider">Cache Hit Rate</span>
            <div className="p-1.5 bg-cyan-500/10 rounded-lg text-cyan-500">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-1">
            <span className="text-2xl font-display font-bold text-brand-slate-800">
              {stats.totalQueries > 0 ? `${cacheHitPercentage}%` : "0%"}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">
            {stats.cacheHits} hits / {stats.totalQueries} queries
          </p>
        </div>

        {/* Active Chunks */}
        <div className="bg-[#fdfbf7] p-4 rounded-xl border border-brand-sand-200/50 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-brand-slate-800 uppercase tracking-wider">Indexed Chunks</span>
            <div className="p-1.5 bg-brand-sage-500/10 rounded-lg text-brand-sage-500">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-1">
            <span className="text-2xl font-display font-bold text-brand-slate-800">{stats.activeChunks}</span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">
            Pre-tokenized document segments
          </p>
        </div>

        {/* Query Volume */}
        <div className="bg-[#fdfbf7] p-4 rounded-xl border border-brand-sand-200/50 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-brand-slate-800 uppercase tracking-wider">Total Traffic</span>
            <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-500">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-1">
            <span className="text-2xl font-display font-bold text-brand-slate-800">{stats.totalQueries}</span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">
            Cumulative playground queries
          </p>
        </div>
      </div>

      {/* Latency Comparison Card and Settings Quick Dials */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Quick Settings Panel */}
        <div className="bg-[#fdfbf7] p-5 rounded-2xl border border-brand-sand-200/50 shadow-sm md:col-span-1">
          <div className="flex items-center space-x-2 text-[#2c2417] mb-4">
            <Cpu className="w-4 h-4 text-brand-terracotta-500" />
            <span className="font-display font-semibold text-sm uppercase tracking-wide">RAG Engine Optimizers</span>
          </div>
          
          <div className="space-y-5">
            {/* Semantic Cache Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold block text-brand-slate-800">Redis Semantic Cache</span>
                <span className="text-[10px] text-gray-500">Fast, instant responses for repeated Qs</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={config.cacheEnabled} 
                  onChange={(e) => onUpdateConfig({ cacheEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:height-4 after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-sage-500"></div>
              </label>
            </div>

            {/* Jaccard threshold slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-brand-slate-800">Similarity Match Threshold</span>
                <span className="font-mono text-brand-terracotta-500 font-medium">{Math.round(config.similarityThreshold * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="0.30" 
                max="0.95" 
                step="0.05"
                value={config.similarityThreshold}
                onChange={(e) => onUpdateConfig({ similarityThreshold: parseFloat(e.target.value) })}
                className="w-full accent-brand-terracotta-500 bg-gray-200 rounded-lg appearance-none cursor-pointer h-1.5"
                disabled={!config.cacheEnabled}
              />
              <span className="text-[9px] text-gray-500 block leading-tight">
                Lower means looser match (more cache hits). Higher is stricter exact question matches.
              </span>
            </div>

            {/* Groq failover toggle */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold block text-brand-slate-800">Key Failover Simulation</span>
                <span className="text-[10px] text-gray-500">Automatic rate-limit failover</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={config.failoverEnabled} 
                  onChange={(e) => onUpdateConfig({ failoverEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:height-4 after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-sage-500"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Latency Comparison Visual */}
        <div className="bg-[#fdfbf7] p-5 rounded-2xl border border-brand-sand-200/50 shadow-sm md:col-span-2 space-y-4">
          <div className="flex items-center justify-between text-[#2c2417]">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-brand-sage-500" />
              <span className="font-display font-semibold text-sm uppercase tracking-wide">Retrieval Pipeline Speed (ms)</span>
            </div>
            <span className="text-xs bg-brand-sage-100 text-brand-sage-600 px-2 py-0.5 rounded-full font-mono font-semibold">
              98% Latency Drop
            </span>
          </div>

          <div className="space-y-4 pt-1">
            {/* Redis Cache */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-mono text-gray-500 flex items-center">
                  <Server className="w-3 h-3 text-cyan-500 mr-1" /> Redis Semantic Cache Hit
                </span>
                <span className="font-mono font-semibold text-cyan-500">24 ms (Cached)</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3.5 overflow-hidden">
                <div className="bg-cyan-500 h-full rounded-full w-[4%] transition-all duration-500" />
              </div>
            </div>

            {/* Direct Model / Database */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-mono text-gray-500 flex items-center">
                  <Database className="w-3 h-3 text-indigo-500 mr-1" /> Vector Chunk Match + Gemini LLM Call
                </span>
                <span className="font-mono font-semibold text-indigo-500">
                  {stats.avgLatencyMs > 0 ? `${stats.avgLatencyMs} ms` : "1200 ms (Real-time)"}
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3.5 overflow-hidden">
                <div className="bg-indigo-500 h-full rounded-full w-[85%] transition-all duration-500" />
              </div>
            </div>
          </div>

          <p className="text-[10px] text-gray-500 italic mt-3 select-none leading-normal">
            * Redis cache matches user input semantically and serves answers in milliseconds, completely bypassing Vector chunk extraction and costly LLM generations.
          </p>
        </div>
      </div>

      {/* RAG WorkFlow Pipeline Simulator */}
      <div className="bg-[#fdfbf7] p-5 rounded-2xl border border-brand-sand-200/50 shadow-sm space-y-4">
        <div className="flex items-center space-x-2 text-[#2c2417]">
          <Layers className="w-4 h-4 text-brand-sage-500" />
          <span className="font-display font-semibold text-sm uppercase tracking-wide">RAG Request Execution Pipeline</span>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-2 pt-2 text-center">
          {/* Step 1 */}
          <div className="flex-1 bg-brand-sand-100/50 p-3 rounded-lg border border-brand-sand-200/30 w-full md:w-auto">
            <span className="text-[10px] font-mono text-brand-terracotta-500 font-bold block mb-1">STEP 01</span>
            <span className="text-xs font-semibold text-brand-slate-800">Query Received</span>
            <span className="text-[9px] text-gray-500 block mt-1">User inputs a question</span>
          </div>

          <ArrowRight className="w-4 h-4 text-gray-300 hidden md:block" />

          {/* Step 2 */}
          <div className="flex-1 bg-brand-sand-100/50 p-3 rounded-lg border border-brand-sand-200/30 w-full md:w-auto relative overflow-hidden">
            <div className={`absolute top-0 left-0 right-0 h-1 ${config.cacheEnabled ? "bg-cyan-500" : "bg-gray-300"}`} />
            <span className="text-[10px] font-mono text-brand-terracotta-500 font-bold block mb-1">STEP 02</span>
            <span className="text-xs font-semibold text-brand-slate-800">Cache Check</span>
            <span className="text-[9px] text-gray-500 block mt-1">
              {config.cacheEnabled ? "Hits serve in ~25ms" : "Skipped (Disabled)"}
            </span>
          </div>

          <ArrowRight className="w-4 h-4 text-gray-300 hidden md:block" />

          {/* Step 3 */}
          <div className="flex-1 bg-brand-sand-100/50 p-3 rounded-lg border border-brand-sand-200/30 w-full md:w-auto">
            <span className="text-[10px] font-mono text-brand-terracotta-500 font-bold block mb-1">STEP 03</span>
            <span className="text-xs font-semibold text-brand-slate-800">RAG Ingestion</span>
            <span className="text-[9px] text-gray-500 block mt-1">Retrieves matching contexts</span>
          </div>

          <ArrowRight className="w-4 h-4 text-gray-300 hidden md:block" />

          {/* Step 4 */}
          <div className="flex-1 bg-brand-sand-100/50 p-3 rounded-lg border border-brand-sand-200/30 w-full md:w-auto">
            <span className="text-[10px] font-mono text-brand-terracotta-500 font-bold block mb-1">STEP 04</span>
            <span className="text-xs font-semibold text-brand-slate-800">AI Synthesis</span>
            <span className="text-[9px] text-gray-500 block mt-1">Real-time grounded answer</span>
          </div>
        </div>
      </div>
    </div>
  );
}
