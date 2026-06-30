import React from "react";
import { 
  LayoutDashboard, 
  BookOpen, 
  MessageSquareCode, 
  Settings, 
  Database,
  Wifi,
  KeyRound,
  Building2
} from "lucide-react";
import { SystemConfig } from "../types.js";

interface SidebarProps {
  activeTab: 'dashboard' | 'knowledge-base' | 'chat' | 'settings';
  onChangeTab: (tab: 'dashboard' | 'knowledge-base' | 'chat' | 'settings') => void;
  documentCount: number;
  config: SystemConfig;
}

export default function Sidebar({
  activeTab,
  onChangeTab,
  documentCount,
  config
}: SidebarProps) {
  
  const navItems = [
    { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'knowledge-base' as const, label: 'Knowledge Base', icon: BookOpen },
    { id: 'chat' as const, label: 'RAG Chat Playground', icon: MessageSquareCode },
    { id: 'settings' as const, label: 'System Cache & Settings', icon: Settings },
  ];

  return (
    <div className="w-64 fixed top-0 bottom-0 left-0 bg-brand-sand-100 border-r border-brand-sand-200 p-5 flex flex-col justify-between z-30 select-none">
      
      {/* Top Brand Logo Panel */}
      <div className="space-y-6">
        <div className="flex items-center space-x-3 py-2 border-b border-brand-sand-200">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-terracotta-50 to-brand-terracotta-500/10 flex items-center justify-center text-brand-terracotta-500 shadow-sm border border-brand-terracotta-500/20">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-display font-bold text-sm tracking-tight text-brand-slate-800 leading-none">
              Lexicon RAG
            </h1>
            <span className="text-[10px] text-gray-500 font-mono tracking-wider uppercase">
              Enterprise Workspace
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onChangeTab(item.id)}
                className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                  isActive 
                    ? "bg-brand-terracotta-500 text-white shadow-md shadow-brand-terracotta-500/10" 
                    : "text-brand-slate-800 hover:bg-brand-sand-200/40 hover:text-brand-terracotta-500"
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Health/Config Status Indicators */}
      <div className="space-y-3 pt-4 border-t border-brand-sand-200 font-mono text-[10px]">
        <span className="text-[9px] uppercase font-bold text-gray-400 tracking-wider block mb-1">
          System telemetry
        </span>
        
        {/* Document indexing total */}
        <div className="flex items-center justify-between text-gray-600">
          <span className="flex items-center">
            <Database className="w-3.5 h-3.5 mr-1.5 text-brand-sage-500" /> Documents
          </span>
          <span className="font-bold text-brand-slate-800">{documentCount} loaded</span>
        </div>

        {/* Redis Cache Health */}
        <div className="flex items-center justify-between text-gray-600">
          <span className="flex items-center">
            <Wifi className="w-3.5 h-3.5 mr-1.5 text-cyan-500" /> Cache Server
          </span>
          <span className={`font-bold ${config.cacheEnabled ? "text-cyan-600" : "text-gray-400"}`}>
            {config.cacheEnabled ? "Redis-6379" : "Offline"}
          </span>
        </div>

        {/* Active API Key Nodes */}
        <div className="flex items-center justify-between text-gray-600">
          <span className="flex items-center">
            <KeyRound className="w-3.5 h-3.5 mr-1.5 text-brand-terracotta-500" /> Active LLM Key
          </span>
          <span className="font-bold text-brand-slate-800">
            {config.activeGroqKey}
          </span>
        </div>
      </div>

    </div>
  );
}
