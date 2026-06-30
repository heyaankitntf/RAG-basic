import React, { useState, useRef } from "react";
import { Document, Chunk } from "../types.js";
import { 
  FileText, 
  Trash2, 
  Edit3, 
  Plus, 
  RotateCcw, 
  Layers, 
  Save, 
  CheckCircle2, 
  Loader2, 
  BookOpen,
  ArrowRight,
  UploadCloud,
  FileCheck,
  AlertCircle
} from "lucide-react";

interface KnowledgeBaseViewProps {
  documents: Document[];
  onAddOrUpdateDoc: (name: string, content: string) => Promise<void>;
  onDeleteDoc: (id: string) => Promise<void>;
  onResetDocs: () => Promise<void>;
}

export default function KnowledgeBaseView({
  documents,
  onAddOrUpdateDoc,
  onDeleteDoc,
  onResetDocs
}: KnowledgeBaseViewProps) {
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editDocName, setEditDocName] = useState("");
  const [editDocContent, setEditDocContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetStep, setResetStep] = useState(0);

  // File Upload states
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: "idle" | "uploading" | "success" | "error"; message?: string }>({ type: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Computed chunks for selected doc
  const getSelectedDocChunks = (): string[] => {
    const doc = documents.find(d => d.id === selectedDocId);
    if (!doc) return [];

    // Simulate server chunking on frontend for preview
    const sections = doc.content.split(/\n(?=(?:##|#)\s+)/);
    return sections.map(s => s.trim()).filter(Boolean);
  };

  const handleEdit = (doc: Document) => {
    setEditDocName(doc.name);
    setEditDocContent(doc.content);
    setIsEditing(true);
    setSelectedDocId(null);
  };

  const handleCreateNew = () => {
    setEditDocName("new_corporate_policy.md");
    setEditDocContent(`# Custom Corporate Policy\n\nWrite your company guideline or employee policy document here to guide your Lexicon RAG workspace...\n\n## Section 1: Overview\nAdd context paragraphs here so the RAG search can retrieve and match them dynamically when queried.`);
    setIsEditing(true);
    setSelectedDocId(null);
  };

  const handleSave = async () => {
    if (!editDocName.trim() || !editDocContent.trim()) return;
    setIsSaving(true);
    try {
      await onAddOrUpdateDoc(editDocName.trim(), editDocContent);
      setIsEditing(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    setIsResetting(true);
    setResetStep(1);
    await new Promise(r => setTimeout(r, 600));
    setResetStep(2);
    await new Promise(r => setTimeout(r, 700));
    setResetStep(3);
    await new Promise(r => setTimeout(r, 600));
    
    try {
      await onResetDocs();
    } catch (e) {
      console.error(e);
    } finally {
      setIsResetting(false);
      setResetStep(0);
      setSelectedDocId(null);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  //  DRAG & DROP FILE UPLOAD HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════════
  const processFiles = async (files: FileList) => {
    const mdFiles = Array.from(files).filter(f => f.name.endsWith(".md") || f.name.endsWith(".markdown"));
    
    if (mdFiles.length === 0) {
      setUploadStatus({
        type: "error",
        message: "No valid markdown (.md) files detected. Please drop standard markdown files."
      });
      setTimeout(() => setUploadStatus({ type: "idle" }), 4000);
      return;
    }

    setUploadStatus({ type: "uploading", message: `Ingesting ${mdFiles.length} file(s)...` });

    try {
      for (const file of mdFiles) {
        const text = await file.text();
        await onAddOrUpdateDoc(file.name, text);
      }
      setUploadStatus({
        type: "success",
        message: `Ingested ${mdFiles.length} markdown file(s) into vector memory!`
      });
      setTimeout(() => setUploadStatus({ type: "idle" }), 3500);
    } catch (error) {
      console.error("File ingestion failed:", error);
      setUploadStatus({
        type: "error",
        message: "File processing or network ingestion failure. Check connection health."
      });
      setTimeout(() => setUploadStatus({ type: "idle" }), 4000);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelectChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processFiles(e.target.files);
      // Reset input value so same file can be uploaded again if needed
      e.target.value = "";
    }
  };

  const triggerFileBrowser = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-6 pb-28">
      {/* Index Stepper Modal (for database reload/reset) */}
      {isResetting && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#fdfbf7] p-6 rounded-2xl border border-brand-sand-200/50 max-w-sm w-full shadow-2xl space-y-4">
            <h3 className="font-display font-bold text-lg text-brand-slate-800 flex items-center">
              <Loader2 className="w-5 h-5 text-brand-terracotta-500 animate-spin mr-2" />
              Re-indexing Knowledge Base
            </h3>
            
            <div className="space-y-3 font-mono text-xs text-gray-600">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className={`w-4 h-4 ${resetStep >= 1 ? "text-brand-sage-500" : "text-gray-300"}`} />
                <span className={resetStep >= 1 ? "text-brand-slate-800 font-medium" : ""}>Clearing active vectors</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle2 className={`w-4 h-4 ${resetStep >= 2 ? "text-brand-sage-500" : "text-gray-300"}`} />
                <span className={resetStep >= 2 ? "text-brand-slate-800 font-medium" : ""}>Parsing Markdown syntax trees</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle2 className={`w-4 h-4 ${resetStep >= 3 ? "text-brand-sage-500" : "text-gray-300"}`} />
                <span className={resetStep >= 3 ? "text-brand-slate-800 font-medium" : ""}>Generating tokenized document chunks</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Primary Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Document List Panel */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-brand-sage-500" />
              <h2 className="font-display font-semibold text-lg text-[#2c2417]">Active Knowledge base</h2>
            </div>
            
            <div className="flex items-center space-x-2">
              <button 
                onClick={handleCreateNew}
                className="flex items-center space-x-1 px-3 py-1.5 bg-brand-terracotta-500 hover:bg-brand-terracotta-600 text-white rounded-lg text-xs font-semibold shadow transition-all duration-200"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Doc</span>
              </button>
              <button 
                onClick={handleReset}
                className="flex items-center space-x-1 px-3 py-1.5 bg-brand-sand-100 hover:bg-brand-sand-200 text-brand-slate-800 rounded-lg text-xs font-semibold border border-brand-sand-200/50 transition-all duration-200"
                title="Reset to preloaded default documents"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Interactive Drag & Drop Area */}
          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={triggerFileBrowser}
            className={`relative rounded-xl border-2 border-dashed p-6 transition-all duration-200 cursor-pointer text-center select-none ${
              isDragging 
                ? "border-brand-terracotta-500 bg-brand-terracotta-500/5 scale-[0.99]" 
                : "border-brand-sand-200/80 bg-[#fdfbf7] hover:border-brand-sage-500 hover:bg-brand-sage-50/10"
            }`}
          >
            {/* Hidden native input */}
            <input 
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelectChange}
              accept=".md"
              multiple
              className="hidden"
            />

            {uploadStatus.type === "idle" ? (
              <div className="space-y-2">
                <div className="p-3 bg-brand-sand-100/60 rounded-full w-12 h-12 flex items-center justify-center mx-auto text-brand-terracotta-500 transition-transform group-hover:scale-110">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-brand-slate-800">
                    Drag & Drop Company Policies
                  </p>
                  <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                    or click to browse local files (Accepts multiple .md files)
                  </p>
                </div>
              </div>
            ) : uploadStatus.type === "uploading" ? (
              <div className="space-y-2 py-2">
                <Loader2 className="w-6 h-6 text-brand-terracotta-500 animate-spin mx-auto" />
                <p className="text-xs font-semibold text-brand-slate-800 animate-pulse">
                  {uploadStatus.message}
                </p>
              </div>
            ) : uploadStatus.type === "success" ? (
              <div className="space-y-2 py-1">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-full w-10 h-10 flex items-center justify-center mx-auto">
                  <FileCheck className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-emerald-700">
                  {uploadStatus.message}
                </p>
              </div>
            ) : (
              <div className="space-y-2 py-1">
                <div className="p-2 bg-rose-100 text-rose-700 rounded-full w-10 h-10 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-rose-700">
                  {uploadStatus.message}
                </p>
              </div>
            )}
          </div>

          {/* Document list card container */}
          <div className="bg-[#fdfbf7] rounded-xl border border-brand-sand-200/50 shadow-sm overflow-hidden divide-y divide-brand-sand-200/30">
            {documents.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                No active documents. Drag and drop markdown files above or click "Reset" to preheat.
              </div>
            ) : (
              documents.map((doc) => {
                const isSelected = selectedDocId === doc.id;
                return (
                  <div 
                    key={doc.id}
                    className={`p-4 transition-colors hover:bg-brand-sand-50/20 ${isSelected ? "bg-brand-sand-50/40" : ""}`}
                  >
                    <div className="flex items-start justify-between">
                      <div 
                        className="flex-1 cursor-pointer pr-4"
                        onClick={() => {
                          setIsEditing(false);
                          setSelectedDocId(isSelected ? null : doc.id);
                        }}
                      >
                        <div className="flex items-center space-x-2">
                          <FileText className="w-4 h-4 text-brand-terracotta-500" />
                          <span className="font-semibold text-sm text-brand-slate-800 hover:text-brand-terracotta-500 transition-colors">
                            {doc.name}
                          </span>
                        </div>
                        <div className="flex items-center space-x-3 text-[11px] text-gray-500 font-mono mt-1">
                          <span>{doc.chunkCount} active chunks</span>
                          <span>&bull;</span>
                          <span>{doc.wordCount} words</span>
                          <span>&bull;</span>
                          <span>Updated {doc.updatedAt}</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={() => handleEdit(doc)}
                          className="p-1.5 text-gray-500 hover:text-brand-terracotta-500 hover:bg-brand-sand-100/50 rounded-md transition-colors"
                          title="Edit markdown"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => onDeleteDoc(doc.id)}
                          className="p-1.5 text-gray-500 hover:text-rose-500 hover:bg-rose-50/50 rounded-md transition-colors"
                          title="Delete document"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Editor and Chunk Inspector Side Panels */}
        <div className="space-y-4">
          {/* Inline Editor */}
          {isEditing && (
            <div className="bg-[#fdfbf7] p-5 rounded-xl border border-brand-sand-200/50 shadow-sm space-y-4">
              <h3 className="font-display font-semibold text-sm text-[#2c2417]">Document Editor</h3>
              
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-gray-600 block">Filename</label>
                  <input 
                    type="text" 
                    value={editDocName}
                    onChange={e => setEditDocName(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-brand-sand-200 bg-white focus:outline-none focus:border-brand-terracotta-500 text-brand-slate-800"
                    placeholder="e.g. employee_onboarding.md"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-gray-600 block">Content (Markdown)</label>
                  <textarea 
                    value={editDocContent}
                    onChange={e => setEditDocContent(e.target.value)}
                    rows={12}
                    className="w-full text-xs font-mono p-2.5 rounded-lg border border-brand-sand-200 bg-white focus:outline-none focus:border-brand-terracotta-500 text-brand-slate-800 leading-relaxed resize-none"
                    placeholder="# Title\n\nContent paragraph here..."
                  />
                </div>

                <div className="flex space-x-2 pt-1">
                  <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex-1 flex items-center justify-center space-x-1 bg-brand-terracotta-500 hover:bg-brand-terracotta-600 text-white font-semibold text-xs py-2 rounded-lg transition-colors"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSaving ? "Saving..." : "Save & Ingest"}</span>
                  </button>
                  <button 
                    onClick={() => setIsEditing(false)}
                    className="px-3 bg-brand-sand-100 hover:bg-brand-sand-200 text-brand-slate-800 text-xs py-2 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Chunk Inspector */}
          {selectedDocId && (
            <div className="bg-[#fdfbf7] p-5 rounded-xl border border-brand-sand-200/50 shadow-sm space-y-4">
              <div className="flex items-center space-x-2 text-[#2c2417]">
                <Layers className="w-4 h-4 text-brand-sage-500" />
                <span className="font-display font-semibold text-sm uppercase tracking-wide">Document Chunk Inspector</span>
              </div>

              <div className="max-h-[380px] overflow-y-auto space-y-3 pr-1">
                {getSelectedDocChunks().map((chunkText, idx) => (
                  <div 
                    key={idx}
                    className="bg-brand-sand-50/20 p-3 rounded-lg border border-brand-sand-200/30 text-xs"
                  >
                    <div className="flex justify-between text-[10px] font-mono text-gray-400 mb-1.5 pb-1 border-b border-brand-sand-200/25">
                      <span>CHUNK #{String(idx + 1).padStart(2, "0")}</span>
                      <span>{chunkText.split(/\s+/).filter(Boolean).length} words</span>
                    </div>
                    <p className="text-gray-600 leading-relaxed line-clamp-4 select-none">
                      {chunkText}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Guidelines info card when nothing is selected */}
          {!isEditing && !selectedDocId && (
            <div className="bg-[#fdfbf7]/50 p-5 rounded-xl border border-dashed border-brand-sand-200 text-center py-12">
              <BookOpen className="w-8 h-8 text-brand-sand-200/80 mx-auto mb-2" />
              <p className="text-xs text-gray-500 max-w-xs mx-auto leading-relaxed">
                Click on any document in the knowledge base list to inspect its tokenized vector chunks, edit its text parameters, or delete it from the index.
              </p>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
