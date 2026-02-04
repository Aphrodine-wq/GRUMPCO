# @grump/rag

Retrieval-Augmented Generation (RAG) engine for G-Rump AI Platform - semantic search and document retrieval with hybrid indexing. Uses NVIDIA NIM for embeddings. For synthetic data generation (NeMo Curator), see [services/nemo-curator/](../../services/nemo-curator/).

## Features

- **Hybrid Search**: Combines dense (vector) and sparse (BM25) retrieval
- **Multiple Vector Stores**: Support for Pinecone, Supabase, and in-memory stores
- **Document Processing**: Automatic chunking, metadata extraction, and preprocessing
- **Semantic Caching**: Cache embeddings for faster retrieval
- **Re-ranking**: Score-based re-ranking of search results
- **Workspace Isolation**: Separate namespaces per workspace
- **Incremental Indexing**: Update index without full rebuild
- **Multi-modal Support**: Text, code, and documentation

## Installation

```bash
npm install @grump/rag
```

## Prerequisites

- Node.js 20+
- Vector store credentials (Pinecone, Supabase, or use in-memory)
- NVIDIA NIM API key for embeddings (recommended) or OpenAI API key

## Quick Start

### Basic Setup

```typescript
import { RAGEngine } from '@grump/rag';

const rag = new RAGEngine({
  vectorStore: {
    provider: 'pinecone',
    apiKey: process.env.PINECONE_API_KEY,
    environment: process.env.PINECONE_ENVIRONMENT,
    indexName: 'grump-docs',
  },
  embeddings: {
    provider: 'nvidia',
    apiKey: process.env.NVIDIA_NIM_API_KEY,
    model: 'nvidia/nv-embedqa-e5-v5',
  },
});

await rag.initialize();
```

### Index Documents

```typescript
// Index single document
await rag.indexDocument({
  id: 'doc-1',
  content: 'G-Rump is an AI development platform...',
  metadata: {
    title: 'Introduction to G-Rump',
    category: 'documentation',
    url: 'https://docs.g-rump.com/intro',
  },
});

// Index multiple documents
await rag.indexDocuments([
  {
    id: 'doc-2',
    content: 'Architecture overview...',
    metadata: { title: 'Architecture', category: 'technical' },
  },
  {
    id: 'doc-3',
    content: 'Getting started guide...',
    metadata: { title: 'Getting Started', category: 'tutorial' },
  },
]);

// Index from file
await rag.indexFile('./docs/api-reference.md', {
  metadata: {
    category: 'api',
    version: '2.1.0',
  },
});

// Index directory
await rag.indexDirectory('./docs', {
  recursive: true,
  filter: (file) => file.endsWith('.md'),
});
```

### Search Documents

```typescript
// Basic search
const results = await rag.search({
  query: 'How do I deploy G-Rump?',
  topK: 5,
});

results.forEach((result) => {
  console.log('Document:', result.metadata.title);
  console.log('Score:', result.score);
  console.log('Snippet:', result.snippet);
});

// Search with filters
const filtered = await rag.search({
  query: 'authentication',
  topK: 10,
  filter: {
    category: 'security',
  },
});

// Hybrid search (vector + keyword)
const hybrid = await rag.search({
  query: 'API rate limiting',
  topK: 5,
  hybrid: true,
  alpha: 0.7, // 0.7 vector, 0.3 keyword
});
```

### RAG Workflow

```typescript
// Complete RAG pipeline
const response = await rag.generateWithContext({
  query: 'How do I set up authentication?',
  llm: {
    provider: 'nvidia',
    model: 'kimi-k2.5',
  },
  contextSettings: {
    topK: 3,
    minScore: 0.7,
    includeMetadata: true,
  },
});

console.log('Answer:', response.answer);
console.log('Sources:', response.sources);
console.log('Confidence:', response.confidence);
```

## API Reference

### RAGEngine

Main class for RAG operations.

#### Constructor

```typescript
new RAGEngine(options: RAGEngineOptions)
```

**Options:**
```typescript
{
  vectorStore: {
    provider: 'pinecone' | 'supabase' | 'memory';
    apiKey?: string;
    environment?: string;
    indexName: string;
    dimension?: number; // default: 768
  };
  embeddings: {
    provider: 'nvidia' | 'openai';
    apiKey: string;
    model: string;
    dimension?: number;
  };
  chunking?: {
    strategy: 'fixed' | 'semantic' | 'recursive';
    chunkSize: number; // default: 512
    chunkOverlap: number; // default: 50
  };
  cache?: {
    enabled: boolean;
    ttl: number; // seconds
  };
}
```

#### Methods

##### `initialize(): Promise<void>`

Initialize the RAG engine and vector store connection.

##### `indexDocument(doc: Document): Promise<void>`

Index a single document.

**Parameters:**
```typescript
{
  id: string;
  content: string;
  metadata?: Record<string, any>;
  namespace?: string;
}
```

##### `indexDocuments(docs: Document[]): Promise<IndexResult>`

Index multiple documents in batch.

**Returns:**
```typescript
{
  indexed: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}
```

##### `indexFile(path: string, options?: IndexFileOptions): Promise<void>`

Index content from a file.

##### `indexDirectory(path: string, options?: IndexDirectoryOptions): Promise<IndexResult>`

Index all files in a directory.

##### `search(options: SearchOptions): Promise<SearchResult[]>`

Search for relevant documents.

**Parameters:**
```typescript
{
  query: string;
  topK?: number; // default: 5
  filter?: Record<string, any>;
  namespace?: string;
  hybrid?: boolean; // enable hybrid search
  alpha?: number; // 0-1, weight for vector search
  minScore?: number; // minimum relevance score
}
```

**Returns:**
```typescript
Array<{
  id: string;
  content: string;
  metadata: Record<string, any>;
  score: number;
  snippet: string;
}>
```

##### `generateWithContext(options: GenerateOptions): Promise<GenerationResult>`

Generate answer using retrieved context.

**Parameters:**
```typescript
{
  query: string;
  llm: {
    provider: string;
    model: string;
    temperature?: number;
  };
  contextSettings?: {
    topK?: number;
    minScore?: number;
    includeMetadata?: boolean;
  };
}
```

**Returns:**
```typescript
{
  answer: string;
  sources: Array<{ id: string; title: string; url: string }>;
  confidence: number;
  tokensUsed: number;
}
```

##### `deleteDocument(id: string, namespace?: string): Promise<void>`

Delete a document from the index.

##### `updateDocument(id: string, updates: Partial<Document>): Promise<void>`

Update document content or metadata.

##### `getStats(): Promise<IndexStats>`

Get index statistics.

**Returns:**
```typescript
{
  totalDocuments: number;
  totalChunks: number;
  namespaces: string[];
  indexSize: number; // bytes
  lastUpdated: Date;
}
```

## Chunking Strategies

### Fixed Size

```typescript
chunking: {
  strategy: 'fixed',
  chunkSize: 512,
  chunkOverlap: 50,
}
```

Best for: Consistent chunk sizes, simple documents

### Semantic

```typescript
chunking: {
  strategy: 'semantic',
  chunkSize: 512,
  sentenceBoundary: true,
}
```

Best for: Natural language documents, maintains context

### Recursive

```typescript
chunking: {
  strategy: 'recursive',
  separators: ['\n\n', '\n', '. ', ' '],
  chunkSize: 512,
}
```

Best for: Code, structured documents

## Vector Store Providers

### Pinecone

```typescript
vectorStore: {
  provider: 'pinecone',
  apiKey: process.env.PINECONE_API_KEY,
  environment: 'us-west1-gcp',
  indexName: 'grump-docs',
  dimension: 768,
}
```

### Supabase

```typescript
vectorStore: {
  provider: 'supabase',
  apiKey: process.env.SUPABASE_KEY,
  url: process.env.SUPABASE_URL,
  indexName: 'documents',
}
```

### In-Memory (Development)

```typescript
vectorStore: {
  provider: 'memory',
  indexName: 'dev-index',
  persistPath: './rag-index.json', // optional persistence
}
```

## Embedding Models

### NVIDIA NIM (Recommended)

```typescript
embeddings: {
  provider: 'nvidia',
  apiKey: process.env.NVIDIA_NIM_API_KEY,
  model: 'nvidia/nv-embedqa-e5-v5', // 768 dimensions
}
```

### OpenAI

```typescript
embeddings: {
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'text-embedding-3-small', // 1536 dimensions
}
```

## Advanced Features

### Re-ranking

```typescript
const results = await rag.search({
  query: 'deployment strategies',
  topK: 20,
  rerank: {
    enabled: true,
    topN: 5,
    model: 'cross-encoder/ms-marco-MiniLM-L-12-v2',
  },
});
```

### Metadata Filtering

```typescript
const results = await rag.search({
  query: 'API documentation',
  filter: {
    category: { $in: ['api', 'reference'] },
    version: '2.1.0',
    $and: [
      { status: 'published' },
      { lastModified: { $gte: new Date('2024-01-01') } },
    ],
  },
});
```

### Custom Preprocessing

```typescript
const rag = new RAGEngine({
  // ... other options
  preprocessing: {
    removeHtml: true,
    removeToc: true,
    customTransformers: [
      (text) => text.replace(/TODO:/g, ''), // Remove TODOs
      (text) => text.toLowerCase(), // Normalize case
    ],
  },
});
```

## Performance Optimization

1. **Batch Indexing**: Use `indexDocuments()` for multiple docs
2. **Caching**: Enable embedding cache for repeated queries
3. **Chunk Size**: Balance between context and precision (512 recommended)
4. **Hybrid Search**: Use alpha=0.7 for best results
5. **Namespaces**: Separate workspaces for faster filtering

## Examples

See the [examples](./examples) directory:

- [Basic indexing and search](./examples/basic-usage.ts)
- [Hybrid search](./examples/hybrid-search.ts)
- [Custom chunking](./examples/custom-chunking.ts)
- [RAG with LLM](./examples/rag-llm.ts)

## Testing

```bash
npm test
```

## License

MIT

## Links

- [RAG Documentation](https://docs.g-rump.com/rag)
- [Vector Search Guide](https://docs.g-rump.com/vector-search)
- [Report Issues](https://github.com/Aphrodine-wq/G-rump.com/issues)
