import type { NvidiaModelConfig } from "./types.js";

/**
 * Document Intelligence Models (NVIDIA, Baidu)
 */
export const DOCUMENT_AI_MODELS: NvidiaModelConfig[] = [
  {
    id: "nvidia/nemoretriever-ocr-v1",
    name: "NeMo Retriever OCR",
    publisher: "NVIDIA",
    capabilities: ["OCR", "vision"],
    contextWindow: 4_000,
    costPerTokenInput: 0.05 / 1_000_000,
    costPerTokenOutput: 0.05 / 1_000_000,
    description:
      "Powerful OCR model for fast, accurate real-world image text extraction",
    bestFor: ["document OCR", "text extraction", "layout analysis"],
    supportsTools: false,
    supportsStreaming: false,
  },
  {
    id: "nvidia/nemoretriever-page-elements-v3",
    name: "NeMo Retriever Page Elements v3",
    publisher: "NVIDIA",
    capabilities: ["vision", "OCR"],
    contextWindow: 4_000,
    costPerTokenInput: 0.05 / 1_000_000,
    costPerTokenOutput: 0.05 / 1_000_000,
    description:
      "Object detection model fine-tuned for charts, tables, and titles in documents",
    bestFor: ["document layout", "chart detection", "table extraction"],
    supportsTools: false,
    supportsStreaming: false,
  },
  {
    id: "nvidia/nemotron-parse",
    name: "Nemotron Parse",
    publisher: "NVIDIA",
    capabilities: ["vision", "OCR", "multimodal"],
    contextWindow: 8_000,
    costPerTokenInput: 0.1 / 1_000_000,
    costPerTokenOutput: 0.1 / 1_000_000,
    description:
      "Vision-language model excelling in retrieving text and metadata from images",
    bestFor: [
      "document parsing",
      "metadata extraction",
      "structured documents",
    ],
    multimodal: true,
    supportsTools: false,
    supportsStreaming: false,
  },
  {
    id: "nvidia/nv-yolox-page-elements-v1",
    name: "NV-YOLOX Page Elements",
    publisher: "NVIDIA",
    capabilities: ["vision", "OCR"],
    contextWindow: 4_000,
    costPerTokenInput: 0.04 / 1_000_000,
    costPerTokenOutput: 0.04 / 1_000_000,
    description: "Object detection for charts, tables, and titles in documents",
    bestFor: ["document analysis", "visual extraction", "layout parsing"],
    supportsTools: false,
    supportsStreaming: false,
  },
  {
    id: "baidu/paddleocr",
    name: "PaddleOCR",
    publisher: "Baidu",
    capabilities: ["OCR", "vision"],
    contextWindow: 4_000,
    costPerTokenInput: 0.03 / 1_000_000,
    costPerTokenOutput: 0.03 / 1_000_000,
    description: "Table extraction with OCR, returning text and bounding boxes",
    bestFor: ["table extraction", "Chinese OCR", "document processing"],
    supportsTools: false,
    supportsStreaming: false,
  },
];
