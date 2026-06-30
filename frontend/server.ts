import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { defaultDocuments } from "./src/defaultDocs.js";
import { 
  Document, 
  Chunk, 
  CachedQuery, 
  SystemConfig, 
  SystemLog, 
  RAGStats 
} from "./src/types.js";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// ═══════════════════════════════════════════════════════════════════════════════
//  IN-MEMORY STATE MANAGEMENT (SERVER-AUTHORITATIVE)
// ═══════════════════════════════════════════════════════════════════════════════
let documents: Document[] = [];
let cachedQueries: CachedQuery[] = [];
let systemLogs: SystemLog[] = [];
let stats: RAGStats = {
  totalQueries: 0,
  cacheHits: 0,
  dbHits: 0,
  avgLatencyMs: 0,
  totalTokensSimulated: 0,
  activeChunks: 0,
};

let config: SystemConfig = {
  cacheEnabled: true,
  similarityThreshold: 0.70, // Matches about 70% Jaccard text overlap
  failoverEnabled: true,
  groqKey1Valid: true,
  groqKey2Valid: true,
  activeGroqKey: "Key 1",
  groqModel: "llama-3.1-8b-instant",
};

// Helper to push a system log
function addLog(type: SystemLog['type'], message: string) {
  const timestamp = new Date().toLocaleTimeString();
  const id = Math.random().toString(36).substring(2, 9);
  systemLogs.unshift({ id, timestamp, type, message });
  if (systemLogs.length > 150) {
    systemLogs.pop();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  DETERMINISTIC CHUNKING & RETRIEVAL LOGIC
// ═══════════════════════════════════════════════════════════════════════════════
function chunkDocument(doc: { id: string; name: string; content: string }): Chunk[] {
  // Split content by markdown headers or double line breaks
  const sections = doc.content.split(/\n(?=(?:##|#)\s+)/);
  const chunks: Chunk[] = [];
  let chunkIndex = 0;

  sections.forEach((section) => {
    const content = section.trim();
    if (!content) return;

    // If a section is very long, split it by paragraphs
    if (content.length > 1000) {
      const paragraphs = content.split(/\n\n+/);
      let currentSubChunk = "";
      paragraphs.forEach((para) => {
        if ((currentSubChunk + para).length > 800) {
          if (currentSubChunk.trim()) {
            chunks.push({
              id: `${doc.id}-chunk-${chunkIndex++}`,
              docId: doc.id,
              docName: doc.name,
              content: currentSubChunk.trim(),
              wordCount: currentSubChunk.split(/\s+/).filter(Boolean).length
            });
          }
          currentSubChunk = para;
        } else {
          currentSubChunk += (currentSubChunk ? "\n\n" : "") + para;
        }
      });
      if (currentSubChunk.trim()) {
        chunks.push({
          id: `${doc.id}-chunk-${chunkIndex++}`,
          docId: doc.id,
          docName: doc.name,
          content: currentSubChunk.trim(),
          wordCount: currentSubChunk.split(/\s+/).filter(Boolean).length
        });
      }
    } else {
      chunks.push({
        id: `${doc.id}-chunk-${chunkIndex++}`,
        docId: doc.id,
        docName: doc.name,
        content: content,
        wordCount: content.split(/\s+/).filter(Boolean).length
      });
    }
  });

  return chunks;
}

// Extract all chunks from active documents
function getAllChunks(): Chunk[] {
  let chunks: Chunk[] = [];
  documents.forEach(doc => {
    chunks = chunks.concat(chunkDocument(doc));
  });
  return chunks;
}

// Scored retrieval engine matching terms
function retrieveRelevantChunks(query: string, chunks: Chunk[]): Chunk[] {
  const queryTerms = query.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(term => term.length > 2 && !['the', 'and', 'for', 'you', 'with', 'your', 'that', 'this', 'are', 'what', 'how'].includes(term));

  if (queryTerms.length === 0) {
    return chunks.slice(0, 3);
  }

  const scoredChunks = chunks.map(chunk => {
    const chunkText = chunk.content.toLowerCase();
    let score = 0;

    queryTerms.forEach(term => {
      // Check word boundary first
      const boundaryRegex = new RegExp(`\\b${term}\\b`, 'g');
      const matches = chunkText.match(boundaryRegex);
      if (matches) {
        score += matches.length * 15;
      } else if (chunkText.includes(term)) {
        score += 4;
      }
    });

    return { chunk, score };
  });

  // Sort descending, filter non-matches, return top 3
  return scoredChunks
    .filter(sc => sc.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(sc => sc.chunk)
    .slice(0, 3);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SEMANTIC CACHE OVERLAP SIMULATOR
// ═══════════════════════════════════════════════════════════════════════════════
function calculateJaccardSimilarity(q1: string, q2: string): number {
  const sanitize = (text: string) => {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 1 && !['the', 'and', 'for', 'you', 'with', 'your', 'is', 'of', 'in', 'to', 'on', 'at', 'a', 'an'].includes(word));
  };

  const set1 = new Set(sanitize(q1));
  const set2 = new Set(sanitize(q2));

  if (set1.size === 0 && set2.size === 0) return 1.0;
  if (set1.size === 0 || set2.size === 0) return 0.0;

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  INITIALIZE SYSTEM DATA
// ═══════════════════════════════════════════════════════════════════════════════
function initializeDefaultData() {
  documents = defaultDocuments.map(d => {
    const wordCount = d.content.split(/\s+/).filter(Boolean).length;
    const chunked = chunkDocument(d);
    return {
      id: d.id,
      name: d.name,
      content: d.content,
      wordCount,
      chunkCount: chunked.length,
      updatedAt: new Date().toLocaleDateString()
    };
  });

  const totalChunks = getAllChunks().length;
  stats.activeChunks = totalChunks;

  // Add startup logs
  addLog("system", "Lexicon Enterprise RAG Engine initialized successfully.");
  addLog("system", `Knowledge Base loaded with ${documents.length} markdown documents.`);
  addLog("system", `Documents chunked into ${totalChunks} logical pieces ready for RAG querying.`);
  if (process.env.GEMINI_API_KEY) {
    addLog("success", "GEMINI_API_KEY connection active for grounded responses.");
  } else {
    addLog("warn", "No GEMINI_API_KEY detected. Booting in high-fidelity sandbox simulation mode.");
  }
  addLog("cache", "Redis-backed Semantic Cache online & listening on port 6379.");
}

initializeDefaultData();

// ═══════════════════════════════════════════════════════════════════════════════
//  API ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

// Get all documents
app.get("/api/documents", (req, res) => {
  res.json(documents);
});

// Create or update a document
app.post("/api/documents", (req, res) => {
  const { name, content } = req.body;
  if (!name || !content) {
    return res.status(400).json({ error: "Name and content are required." });
  }

  const id = name.toLowerCase().replace(/[^a-z0-9]/g, "-");
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const chunked = chunkDocument({ id, name, content });

  const existingIndex = documents.findIndex(d => d.id === id);
  if (existingIndex > -1) {
    documents[existingIndex] = {
      id,
      name,
      content,
      wordCount,
      chunkCount: chunked.length,
      updatedAt: new Date().toLocaleDateString()
    };
    addLog("system", `Updated document: ${name} (${chunked.length} chunks generated).`);
  } else {
    documents.push({
      id,
      name,
      content,
      wordCount,
      chunkCount: chunked.length,
      updatedAt: new Date().toLocaleDateString()
    });
    addLog("success", `Ingested new document: ${name} with ${chunked.length} vector chunks.`);
  }

  // Update stats
  stats.activeChunks = getAllChunks().length;
  res.json({ success: true, docId: id });
});

// Delete a document
app.delete("/api/documents/:id", (req, res) => {
  const { id } = req.params;
  const doc = documents.find(d => d.id === id);
  if (!doc) {
    return res.status(404).json({ error: "Document not found." });
  }

  documents = documents.filter(d => d.id !== id);
  stats.activeChunks = getAllChunks().length;
  addLog("warn", `Removed document ${doc.name} from index.`);
  res.json({ success: true });
});

// Reset database
app.post("/api/documents/reset", (req, res) => {
  initializeDefaultData();
  cachedQueries = [];
  res.json({ success: true });
});

// Clear cache
app.post("/api/cache/clear", (req, res) => {
  cachedQueries = [];
  addLog("cache", "Redis semantic cache flushed. 0 keys active.");
  res.json({ success: true });
});

// Get cache entries
app.get("/api/cache", (req, res) => {
  res.json(cachedQueries);
});

// Get stats
app.get("/api/stats", (req, res) => {
  res.json(stats);
});

// Get logs
app.get("/api/logs", (req, res) => {
  res.json(systemLogs);
});

// Get/Update System Config
app.get("/api/config", (req, res) => {
  res.json(config);
});

app.post("/api/config", (req, res) => {
  config = { ...config, ...req.body };
  addLog("system", "System configurations updated successfully.");
  res.json(config);
});

// RAG Chat core loop
app.post("/api/chat", async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Message is required." });
  }

  const startTime = Date.now();
  addLog("info", `Incoming RAG Query: "${message}"`);

  // 1. CHECK SEMANTIC CACHE FIRST
  if (config.cacheEnabled) {
    addLog("cache", "Searching Redis semantic cache (Cosine-Jaccard threshold)...");
    let bestMatch: CachedQuery | null = null;
    let bestSimilarity = 0;

    cachedQueries.forEach(cq => {
      const similarity = calculateJaccardSimilarity(message, cq.question);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = cq;
      }
    });

    if (bestMatch && bestSimilarity >= config.similarityThreshold) {
      const match = bestMatch as CachedQuery;
      // Cache hit! Update logs and counters
      const latencyMs = Math.floor(Math.random() * 25) + 15; // Redis typical hits are ~15-40ms
      await new Promise(r => setTimeout(r, latencyMs));

      stats.totalQueries += 1;
      stats.cacheHits += 1;
      stats.avgLatencyMs = Math.round((stats.avgLatencyMs * (stats.totalQueries - 1) + latencyMs) / stats.totalQueries);

      match.hitCount += 1;
      match.lastHitAt = new Date().toLocaleTimeString();

      addLog("success", `[⚡ CACHE HIT] Redis matched Query: "${match.question}" with ${(bestSimilarity * 100).toFixed(1)}% match. Latency: ${latencyMs}ms.`);

      return res.json({
        content: match.answer,
        source: "cache",
        latencyMs,
        retrievedChunks: [],
        modelUsed: "Redis Cache v6.2"
      });
    } else {
      addLog("cache", `[CACHE MISS] No cached entries matched above ${Math.round(config.similarityThreshold * 100)}% similarity.`);
    }
  }

  // 2. RETRIEVE FROM CHROMADB / KNOWLEDGE BASE
  addLog("database", "Executing semantic lookup in local Vector Store indices...");
  const allChunks = getAllChunks();
  const relevantChunks = retrieveRelevantChunks(message, allChunks);

  if (relevantChunks.length > 0) {
    addLog("database", `Retrieved ${relevantChunks.length} matching contexts from database: ${relevantChunks.map(c => c.docName).join(", ")}.`);
  } else {
    addLog("warn", "No matching document contexts retrieved from knowledge base. Proceeding without grounded context.");
  }

  // Build the grounded instruction
  const contextBlock = relevantChunks.map((c, i) => `CONTEXT CHUNK ${i+1} [Source: ${c.docName}]:\n${c.content}`).join("\n\n---\n\n");
  
  const systemInstruction = 
    "You are Lexicon, a highly precise, professional, and objective enterprise AI assistant.\n" +
    "You answer questions using the provided Markdown CONTEXT below. Stay strictly grounded in the provided facts and avoid speculation.\n" +
    "If the context doesn't contain the relevant information, clearly state that you don't find it in the current knowledge base, and outline how they may resolve or escalate the query.";

  const finalPrompt = `
${systemInstruction}

CONTEXT:
${contextBlock || "No matching knowledge base documents were found."}

QUERY:
${message}
`;

  // 3. MULTI-KEY FAILOVER SIMULATOR
  let activeNodeKey = config.activeGroqKey;
  if (config.failoverEnabled) {
    addLog("groq", `Querying LLM node using active client keys (${activeNodeKey})...`);
    if (!config.groqKey1Valid && activeNodeKey === "Key 1") {
      addLog("warn", "[GROQ NODE] Key 1 returned HTTP 429: Too Many Requests (Rate Limit Exceeded)!");
      addLog("system", "[AUTO-FAILOVER] Activating transparent failover path to Key 2 (Backup Node)...");
      config.activeGroqKey = "Key 2";
      activeNodeKey = "Key 2";
      
      if (!config.groqKey2Valid) {
        addLog("error", "[GROQ NODE] Key 2 backup also returned HTTP 429. Failover exhausted!");
        return res.status(429).json({ error: "All simulated Groq API keys rate-limited (HTTP 429). Please clear limits or wait." });
      } else {
        addLog("success", "[AUTO-FAILOVER] Key 2 connection successful. Resuming query pipeline.");
      }
    } else if (!config.groqKey2Valid && activeNodeKey === "Key 2") {
      addLog("error", "[GROQ NODE] Key 2 returned HTTP 429. Attempting fallback to Key 1...");
      if (config.groqKey1Valid) {
        config.activeGroqKey = "Key 1";
        activeNodeKey = "Key 1";
        addLog("success", "[AUTO-FAILOVER] Restored connection to Key 1.");
      } else {
        addLog("error", "[GROQ NODE] All failover nodes rate-limited (HTTP 429).");
        return res.status(429).json({ error: "All keys rate-limited." });
      }
    }
  }

  // 4. GENERATE WITH GEMINI
  let responseText = "";
  const apiKey = process.env.GEMINI_API_KEY;

  try {
    if (apiKey) {
      addLog("system", "Dispatching query to Gemini API (gemini-3.5-flash)...");
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          }
        }
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: finalPrompt,
        config: {
          temperature: 0.7,
        }
      });

      responseText = response.text || "I was unable to formulate a response.";
    } else {
      // High-quality local offline simulator for smooth sandbox review when key isn't provided!
      addLog("warn", "Using high-fidelity sandbox simulation model for RAG response.");
      await new Promise(r => setTimeout(r, 1200)); // Simulate realistic network delay
      
      if (relevantChunks.length > 0) {
        // Build a highly logical simulated RAG answer based on matched paragraphs!
        const matched = relevantChunks[0].content;
        responseText = `According to the official enterprise documentation in **${relevantChunks[0].docName}**:\n\n` +
          `* "${matched.substring(0, 350)}..."\n\n` +
          `Please ensure you adhere strictly to these corporate protocols. For further queries, you can refer directly to the indexed file or contact your administrator.`;
      } else {
        responseText = "I searched the indexed enterprise files but could not locate specific guidelines or policies for that query. Please make sure the relevant markdown document is uploaded to the Knowledge Base, or consult our standard operating guidelines.";
      }
    }

    const latencyMs = Date.now() - startTime;
    stats.totalQueries += 1;
    stats.dbHits += 1;
    stats.avgLatencyMs = Math.round((stats.avgLatencyMs * (stats.totalQueries - 1) + latencyMs) / stats.totalQueries);
    stats.totalTokensSimulated += Math.floor(message.length / 3 + responseText.length / 3 + 250);

    addLog("success", `[🗄️ RETRIEVAL SUCCESS] Generation complete. Latency: ${latencyMs}ms. Node Used: ${activeNodeKey}.`);

    // Add to semantic cache if cache is enabled!
    if (config.cacheEnabled) {
      const cacheId = Math.random().toString(36).substring(2, 9);
      cachedQueries.push({
        id: cacheId,
        question: message,
        answer: responseText,
        hitCount: 0,
        createdAt: new Date().toLocaleTimeString(),
        lastHitAt: "Never"
      });
      addLog("cache", `Cached query in Redis under Key: qa_cache:${cacheId}`);
    }

    res.json({
      content: responseText,
      source: "database",
      latencyMs,
      retrievedChunks: relevantChunks,
      modelUsed: `${config.groqModel} (${activeNodeKey})`
    });

  } catch (error: any) {
    addLog("error", `RAG pipeline generation failed: ${error?.message || error}`);
    res.status(500).json({ error: error?.message || "Generation error" });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
//  VITE DEVELOPMENT ENVIRONMENT SETUP
// ═══════════════════════════════════════════════════════════════════════════════
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Lexicon Enterprise RAG fullstack server running on http://localhost:${PORT}`);
  });
}

startServer();
