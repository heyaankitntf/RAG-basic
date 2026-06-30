import React, { useEffect, useRef, useState } from "react";
import { SystemLog } from "../types.js";
import { Terminal, ShieldAlert, CheckCircle, Flame, Server, Trash2, ArrowUpDown } from "lucide-react";

interface LogTerminalProps {
  logs: SystemLog[];
  onClearLogs?: () => void;
}

export default function LogTerminal({ logs, onClearLogs }: LogTerminalProps) {
  const [isOpen, setIsOpen] = useState(true);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, isOpen]);

  const getLogColors = (type: SystemLog["type"]) => {
    switch (type) {
      case "success":
        return { text: "text-emerald-400", bg: "bg-emerald-950/40 border-emerald-900/30" };
      case "warn":
        return { text: "text-amber-400", bg: "bg-amber-950/40 border-amber-900/30" };
      case "error":
        return { text: "text-rose-400", bg: "bg-rose-950/40 border-rose-900/30" };
      case "cache":
        return { text: "text-cyan-400", bg: "bg-cyan-950/40 border-cyan-900/30" };
      case "database":
        return { text: "text-indigo-400", bg: "bg-indigo-950/40 border-indigo-900/30" };
      case "groq":
        return { text: "text-brand-terracotta-500", bg: "bg-indigo-950/20 border-indigo-900/10" };
      default:
        return { text: "text-gray-300", bg: "bg-gray-900/20 border-gray-800/10" };
    }
  };

  const getLogIcon = (type: SystemLog["type"]) => {
    switch (type) {
      case "success":
        return <CheckCircle className="w-3.5 h-3.5 text-emerald-400 inline mr-1.5" />;
      case "warn":
        return <ShieldAlert className="w-3.5 h-3.5 text-amber-400 inline mr-1.5" />;
      case "error":
        return <Flame className="w-3.5 h-3.5 text-rose-400 inline mr-1.5" />;
      case "cache":
        return <Server className="w-3.5 h-3.5 text-cyan-400 inline mr-1.5" />;
      case "database":
        return <ArrowUpDown className="w-3.5 h-3.5 text-indigo-400 inline mr-1.5" />;
      default:
        return <Terminal className="w-3.5 h-3.5 text-gray-400 inline mr-1.5" />;
    }
  };

  return (
    <div className="fixed bottom-0 right-0 left-0 lg:left-64 bg-slate-950/98 border-t border-brand-sand-200/20 z-40 shadow-2xl transition-all duration-300">
      {/* Terminal Header */}
      <div 
        className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-brand-sand-200/10 cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center space-x-2 text-brand-sand-100">
          <Terminal className="w-4 h-4 text-brand-terracotta-500 animate-pulse" />
          <span className="font-mono text-xs font-semibold uppercase tracking-wider">
            Lexicon RAG Real-Time Pipeline Engine Logs
          </span>
          <span className="bg-brand-sand-200/10 text-brand-sand-200 text-[10px] px-1.5 py-0.5 rounded-full font-mono">
            {logs.length} events
          </span>
        </div>
        <div className="flex items-center space-x-3" onClick={e => e.stopPropagation()}>
          {onClearLogs && (
            <button 
              onClick={onClearLogs}
              className="text-gray-400 hover:text-rose-400 p-1 rounded hover:bg-white/5 transition-colors"
              title="Clear Console"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button 
            className="text-brand-sand-100 hover:text-brand-terracotta-500 font-mono text-xs px-2 py-0.5 rounded hover:bg-white/5 transition-colors"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? "[ Hide ]" : "[ Show ]"}
          </button>
        </div>
      </div>

      {/* Terminal Output */}
      {isOpen && (
        <div className="h-44 overflow-y-auto px-4 py-3 font-mono text-xs text-gray-300 bg-slate-900 flex flex-col-reverse space-y-reverse">
          <div ref={terminalEndRef} />
          {logs.length === 0 ? (
            <div className="text-gray-500 italic text-center py-6">
              Listening for pipeline telemetry events... Send a chat or edit a file to view logs.
            </div>
          ) : (
            logs.map((log) => {
              const colors = getLogColors(log.type);
              return (
                <div 
                  key={log.id} 
                  className={`py-1.5 px-2.5 rounded border mb-1.5 flex items-start space-x-2 ${colors.bg}`}
                >
                  <span className="text-gray-500 text-[10px] select-none mt-0.5">{log.timestamp}</span>
                  <div className="flex-1 leading-relaxed">
                    <span className={`font-semibold mr-1.5 uppercase text-[10px] ${colors.text}`}>
                      [{log.type}]
                    </span>
                    {getLogIcon(log.type)}
                    <span className="text-gray-100">{log.message}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
