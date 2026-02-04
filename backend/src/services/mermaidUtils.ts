// Valid Mermaid diagram type keywords
const MERMAID_KEYWORDS: readonly string[] = [
  "flowchart",
  "graph",
  "sequenceDiagram",
  "classDiagram",
  "erDiagram",
  "stateDiagram",
  "stateDiagram-v2",
  "gantt",
  "pie",
  "mindmap",
  "journey",
  "gitGraph",
  "quadrantChart",
] as const;

export interface MermaidExtractionResult {
  code: string | null;
  extracted: boolean;
  method:
    | "mermaid_block"
    | "code_block_keyword"
    | "keyword_detection"
    | "fallback_block"
    | "none";
}

export function validateMermaidCode(code: unknown): boolean {
  if (!code || typeof code !== "string") return false;
  const trimmed = code.trim();
  return MERMAID_KEYWORDS.some(
    (keyword) =>
      trimmed.startsWith(keyword) ||
      trimmed.match(new RegExp(`^${keyword}\\s`, "i")),
  );
}

export function extractMermaidCode(text: unknown): MermaidExtractionResult {
  if (!text || typeof text !== "string") {
    return { code: null, extracted: false, method: "none" };
  }

  // Priority 1: Explicit ```mermaid code block
  const mermaidRegex = /```mermaid\s*([\s\S]*?)```/;
  const match = text.match(mermaidRegex);

  if (match && match[1]) {
    const code = match[1].trim();
    return { code, extracted: true, method: "mermaid_block" };
  }

  // Priority 2: Any code block that starts with a Mermaid keyword
  const codeBlockRegex = /```\w*\s*([\s\S]*?)```/g;
  let codeMatch;
  while ((codeMatch = codeBlockRegex.exec(text)) !== null) {
    const code = codeMatch[1].trim();
    if (validateMermaidCode(code)) {
      return { code, extracted: true, method: "code_block_keyword" };
    }
  }

  // Priority 3: Look for Mermaid content without code fences
  for (const keyword of MERMAID_KEYWORDS) {
    const keywordRegex = new RegExp(`(${keyword}[\\s\\S]*?)(?:\\n\\n|$)`, "i");
    const keywordMatch = text.match(keywordRegex);
    if (keywordMatch && keywordMatch[1]) {
      const code = keywordMatch[1].trim();
      if (validateMermaidCode(code)) {
        return { code, extracted: true, method: "keyword_detection" };
      }
    }
  }

  // Priority 4: Any code block as fallback
  const anyCodeRegex = /```\s*([\s\S]*?)```/;
  const anyMatch = text.match(anyCodeRegex);
  if (anyMatch && anyMatch[1]) {
    return {
      code: anyMatch[1].trim(),
      extracted: true,
      method: "fallback_block",
    };
  }

  // No extractable code found
  return { code: null, extracted: false, method: "none" };
}

export { MERMAID_KEYWORDS };
