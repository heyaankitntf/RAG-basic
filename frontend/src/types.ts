export interface Document {
  id: string;
  name: string;
  content: string;
  chunkCount: number;
  wordCount: number;
  updatedAt: string;
}

export interface Chunk {
  id: string;
  docId: string;
  docName: string;
  content: string;
  wordCount: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  source?: 'cache' | 'database' | 'system';
  latencyMs?: number;
  modelUsed?: string;
  retrievedChunks?: Chunk[];
}

export interface CachedQuery {
  id: string;
  question: string;
  answer: string;
  hitCount: number;
  createdAt: string;
  lastHitAt: string;
}

export interface SystemConfig {
  cacheEnabled: boolean;
  similarityThreshold: number; // e.g. 0.85
  failoverEnabled: boolean;
  groqKey1Valid: boolean;
  groqKey2Valid: boolean;
  activeGroqKey: 'Key 1' | 'Key 2' | 'None';
  groqModel: string;
}

export interface SystemLog {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'warn' | 'error' | 'cache' | 'database' | 'groq' | 'system';
  message: string;
}

export interface RAGStats {
  totalQueries: number;
  cacheHits: number;
  dbHits: number;
  avgLatencyMs: number;
  totalTokensSimulated: number;
  activeChunks: number;
}
