-- Enable pgvector in Supabase Postgres. Run this in Supabase SQL Editor
-- when using a pgvector-based RAG store (e.g. with LangChain PGVectorStore).
CREATE EXTENSION IF NOT EXISTS vector;
