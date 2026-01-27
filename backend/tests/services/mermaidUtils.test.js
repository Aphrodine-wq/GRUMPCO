import { describe, it, expect } from 'vitest';
import { extractMermaidCode, validateMermaidCode } from '../../src/services/mermaidUtils.ts';

describe('validateMermaidCode', () => {
  it('should validate flowchart syntax', () => {
    expect(validateMermaidCode('flowchart TD\n  A --> B')).toBe(true);
    expect(validateMermaidCode('flowchart LR\n  A --> B')).toBe(true);
  });

  it('should validate sequenceDiagram syntax', () => {
    expect(validateMermaidCode('sequenceDiagram\n  A->>B: Hello')).toBe(true);
  });

  it('should validate classDiagram syntax', () => {
    expect(validateMermaidCode('classDiagram\n  class Animal')).toBe(true);
  });

  it('should validate erDiagram syntax', () => {
    expect(validateMermaidCode('erDiagram\n  CUSTOMER ||--o{ ORDER : places')).toBe(true);
  });

  it('should validate stateDiagram syntax', () => {
    expect(validateMermaidCode('stateDiagram-v2\n  [*] --> State1')).toBe(true);
  });

  it('should validate gantt syntax', () => {
    expect(validateMermaidCode('gantt\n  title A Gantt Diagram')).toBe(true);
  });

  it('should reject invalid content', () => {
    expect(validateMermaidCode('')).toBe(false);
    expect(validateMermaidCode(null)).toBe(false);
    expect(validateMermaidCode(undefined)).toBe(false);
    expect(validateMermaidCode('random text')).toBe(false);
    expect(validateMermaidCode('console.log("hello")')).toBe(false);
  });
});

describe('extractMermaidCode', () => {
  it('should extract code from mermaid code block', () => {
    const text = '```mermaid\nflowchart TD\n  A --> B\n```';
    const result = extractMermaidCode(text);
    
    expect(result.extracted).toBe(true);
    expect(result.method).toBe('mermaid_block');
    expect(result.code).toBe('flowchart TD\n  A --> B');
  });

  it('should extract code from generic code block with mermaid content', () => {
    const text = '```\nflowchart TD\n  A --> B\n```';
    const result = extractMermaidCode(text);
    
    expect(result.extracted).toBe(true);
    expect(result.code).toContain('flowchart');
  });

  it('should extract mermaid content without code fences', () => {
    const text = 'Here is a diagram:\nflowchart TD\n  A --> B\n\nSome other text';
    const result = extractMermaidCode(text);
    
    expect(result.extracted).toBe(true);
    expect(result.code).toContain('flowchart');
  });

  it('should handle text with multiple code blocks', () => {
    const text = '```javascript\nconsole.log("test")\n```\n\n```mermaid\nflowchart TD\n  A --> B\n```';
    const result = extractMermaidCode(text);
    
    expect(result.extracted).toBe(true);
    expect(result.method).toBe('mermaid_block');
    expect(result.code).toContain('flowchart');
  });

  it('should return extracted: false for empty input', () => {
    expect(extractMermaidCode('')).toEqual({ code: null, extracted: false, method: 'none' });
    expect(extractMermaidCode(null)).toEqual({ code: null, extracted: false, method: 'none' });
    expect(extractMermaidCode(undefined)).toEqual({ code: null, extracted: false, method: 'none' });
  });

  it('should return extracted: false for non-mermaid content', () => {
    const text = 'This is just regular text without any diagrams.';
    const result = extractMermaidCode(text);
    
    expect(result.extracted).toBe(false);
    expect(result.code).toBe(null);
  });

  it('should handle complex flowchart with multiple nodes', () => {
    const text = `\`\`\`mermaid
flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E
\`\`\``;
    
    const result = extractMermaidCode(text);
    expect(result.extracted).toBe(true);
    expect(result.code).toContain('A[Start]');
    expect(result.code).toContain('B{Decision}');
  });

  it('should handle sequence diagram', () => {
    const text = `\`\`\`mermaid
sequenceDiagram
    participant A as Alice
    participant B as Bob
    A->>B: Hello Bob
    B->>A: Hi Alice
\`\`\``;
    
    const result = extractMermaidCode(text);
    expect(result.extracted).toBe(true);
    expect(result.code).toContain('sequenceDiagram');
    expect(result.code).toContain('Alice');
  });
});
