import React, { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import DashboardView from "./components/DashboardView";
import KnowledgeBaseView from "./components/KnowledgeBaseView";
import ChatPlaygroundView from "./components/ChatPlaygroundView";
import SettingsView from "./components/SettingsView";
import LogTerminal from "./components/LogTerminal";
import { 
  Document, 
  CachedQuery, 
  SystemConfig, 
  SystemLog, 
  RAGStats, 
  Message 
} from "./types";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Activity } from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'knowledge-base' | 'chat' | 'settings'>('dashboard');
  
  // App states synchronized with backend
  const [documents, setDocuments] = useState<Document[]>([]);
  const [cachedQueries, setCachedQueries] = useState<CachedQuery[]>([]);
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
  const [stats, setStats] = useState<RAGStats>({
    totalQueries: 0,
    cacheHits: 0,
    dbHits: 0,
    avgLatencyMs: 0,
    totalTokensSimulated: 0,
    activeChunks: 0,
  });
  const [config, setConfig] = useState<SystemConfig>({
    cacheEnabled: true,
    similarityThreshold: 0.70,
    failoverEnabled: true,
    groqKey1Valid: true,
    groqKey2Valid: true,
    activeGroqKey: "Key 1",
    groqModel: "llama-3.1-8b-instant"
  });

  // Client-side chat messages
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Initial load & Polling loops for Stats and Logs
  useEffect(() => {
    refreshAllState();

    // Poll logs and stats every 3 seconds to keep them in perfect sync!
    const interval = setInterval(() => {
      fetchStats();
      fetchLogs();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const refreshAllState = async () => {
    await Promise.all([
      fetchDocuments(),
      fetchCacheEntries(),
      fetchStats(),
      fetchLogs(),
      fetchConfig()
    ]);
  };

  const fetchDocuments = async () => {
    try {
      const r = await fetch("/api/documents");
      if (r.ok) {
        const data = await r.json();
        setDocuments(data);
      }
    } catch (e) {
      console.warn("Express server connection cold start. Retrying shortly.", e);
    }
  };

  const fetchCacheEntries = async () => {
    try {
      const r = await fetch("/api/cache");
      if (r.ok) {
        const data = await r.json();
        setCachedQueries(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchStats = async () => {
    try {
      const r = await fetch("/api/stats");
      if (r.ok) {
        const data = await r.json();
        setStats(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLogs = async () => {
    try {
      const r = await fetch("/api/logs");
      if (r.ok) {
        const data = await r.json();
        setSystemLogs(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchConfig = async () => {
    try {
      const r = await fetch("/api/config");
      if (r.ok) {
        const data = await r.json();
        setConfig(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // State modification callbacks
  const handleUpdateConfig = async (newConfig: Partial<SystemConfig>) => {
    try {
      const r = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newConfig)
      });
      if (r.ok) {
        const data = await r.json();
        setConfig(data);
        fetchLogs();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddOrUpdateDoc = async (name: string, content: string) => {
    try {
      const r = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, content })
      });
      if (r.ok) {
        await fetchDocuments();
        await fetchStats();
        await fetchLogs();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteDoc = async (id: string) => {
    try {
      const r = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (r.ok) {
        await fetchDocuments();
        await fetchStats();
        await fetchLogs();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleResetDocs = async () => {
    try {
      const r = await fetch("/api/documents/reset", { method: "POST" });
      if (r.ok) {
        await refreshAllState();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearCache = async () => {
    try {
      const r = await fetch("/api/cache/clear", { method: "POST" });
      if (r.ok) {
        await fetchCacheEntries();
        await fetchStats();
        await fetchLogs();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearLogs = () => {
    // Client-side logs visual reset (logs are autorun on server)
    setSystemLogs([]);
  };

  const handleSendMessage = async (text: string) => {
    const userMsg: Message = {
      id: Math.random().toString(36).substring(2, 9),
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString()
    };

    setMessages(prev => [...prev, userMsg]);
    setIsGenerating(true);

    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text })
      });

      if (r.ok) {
        const data = await r.json();
        const assistantMsg: Message = {
          id: Math.random().toString(36).substring(2, 9),
          role: "assistant",
          content: data.content,
          timestamp: new Date().toLocaleTimeString(),
          source: data.source,
          latencyMs: data.latencyMs,
          retrievedChunks: data.retrievedChunks,
          modelUsed: data.modelUsed
        };
        setMessages(prev => [...prev, assistantMsg]);
      } else {
        const errData = await r.json();
        const systemErr: Message = {
          id: Math.random().toString(36).substring(2, 9),
          role: "system",
          content: `RAG Pipeline Interruption: ${errData.error || "Generation error"}. Check key failover nodes in the settings.`,
          timestamp: new Date().toLocaleTimeString()
        };
        setMessages(prev => [...prev, systemErr]);
      }
    } catch (e: any) {
      const systemErr: Message = {
        id: Math.random().toString(36).substring(2, 9),
        role: "system",
        content: `Network Connection Timeout: ${e.message}. Ensure your backend server is booting correctly.`,
        timestamp: new Date().toLocaleTimeString()
      };
      setMessages(prev => [...prev, systemErr]);
    } finally {
      setIsGenerating(false);
      // Immediately refresh stats, logs, and cache registry!
      fetchStats();
      fetchLogs();
      fetchCacheEntries();
      fetchConfig();
    }
  };

  // Render proper tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case "dashboard":
        return (
          <DashboardView 
            stats={stats}
            config={config}
            onUpdateConfig={handleUpdateConfig}
            onNavigateToChat={() => setActiveTab("chat")}
            onNavigateToKB={() => setActiveTab("knowledge-base")}
          />
        );
      case "knowledge-base":
        return (
          <KnowledgeBaseView 
            documents={documents}
            onAddOrUpdateDoc={handleAddOrUpdateDoc}
            onDeleteDoc={handleDeleteDoc}
            onResetDocs={handleResetDocs}
          />
        );
      case "chat":
        return (
          <ChatPlaygroundView 
            messages={messages}
            onSendMessage={handleSendMessage}
            isGenerating={isGenerating}
          />
        );
      case "settings":
        return (
          <SettingsView 
            config={config}
            onUpdateConfig={handleUpdateConfig}
            cacheEntries={cachedQueries}
            onClearCache={handleClearCache}
            onRefreshCacheList={fetchCacheEntries}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-brand-sand-50">
      {/* Sidebar navigation */}
      <Sidebar 
        activeTab={activeTab} 
        onChangeTab={setActiveTab} 
        documentCount={documents.length}
        config={config}
      />

      {/* Main Content Area */}
      <div className="pl-64 min-h-screen flex flex-col">
        {/* Top Header */}
        <header className="sticky top-0 bg-brand-sand-50/80 backdrop-blur-md border-b border-brand-sand-200/30 z-20 px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-brand-terracotta-500" />
            <h2 className="font-display font-bold text-sm tracking-wide text-brand-slate-800 uppercase">
              {activeTab.replace("-", " ")} Workspace
            </h2>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-[11px] font-mono text-gray-500 bg-brand-sand-100 px-2.5 py-1 rounded-full flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
              Lexicon Node Online
            </span>
          </div>
        </header>

        {/* Dynamic Inner Viewport with micro transitions */}
        <main className="flex-1 px-8 py-6 max-w-5xl w-full mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              {renderTabContent()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Bottom Telemetry Log Terminal Console */}
      <LogTerminal 
        logs={systemLogs} 
        onClearLogs={handleClearLogs} 
      />
    </div>
  );
}
