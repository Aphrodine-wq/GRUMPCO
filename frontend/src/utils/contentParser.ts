/**
 * Content Parser Utility
 * Parses mixed content (text, code, tool calls, tool results) into structured blocks
 */

import type { ContentBlock, TextBlock, CodeBlockType, ToolCallBlock, ToolResultBlock } from '../types';

/**
 * Parse message content into structured blocks
 * Handles: plain text, code blocks, tool calls, tool results, mermaid diagrams
 */
export function parseMessageContent(content: string | ContentBlock[]): ContentBlock[] {
  // If already structured, return as-is
  if (Array.isArray(content)) {
    return content;
  }

  if (!content || typeof content !== 'string') {
    return [];
  }

  const blocks: ContentBlock[] = [];

  // Regular expressions for various block types
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const mermaidRegex = /```mermaid\s*([\s\S]*?)```/g;

  let lastIndex = 0;
  let match;

  // First, find all code and mermaid blocks
  const allMatches: Array<{
    type: 'code' | 'mermaid';
    index: number;
    endIndex: number;
    language?: string;
    content: string;
  }> = [];

  // Find mermaid blocks
  while ((match = mermaidRegex.exec(content)) !== null) {
    allMatches.push({
      type: 'mermaid',
      index: match.index,
      endIndex: match.index + match[0].length,
      content: match[1].trim(),
    });
  }

  // Find code blocks (non-mermaid)
  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Check if this is already captured as mermaid
    const isMermaid = allMatches.some(
      (m) => m.type === 'mermaid' && m.index === match.index
    );
    if (!isMermaid) {
      allMatches.push({
        type: 'code',
        index: match.index,
        endIndex: match.index + match[0].length,
        language: match[1] || 'javascript',
        content: match[2].trim(),
      });
    }
  }

  // Sort matches by index
  allMatches.sort((a, b) => a.index - b.index);

  // Process matches and create blocks
  lastIndex = 0;
  for (const blockMatch of allMatches) {
    // Add text block before this match
    if (blockMatch.index > lastIndex) {
      const textContent = content.slice(lastIndex, blockMatch.index).trim();
      if (textContent) {
        blocks.push({
          type: 'text',
          content: textContent,
        });
      }
    }

    // Add the code or mermaid block
    if (blockMatch.type === 'code') {
      blocks.push({
        type: 'code',
        language: blockMatch.language || 'javascript',
        code: blockMatch.content,
      } as CodeBlockType);
    } else if (blockMatch.type === 'mermaid') {
      blocks.push({
        type: 'mermaid',
        content: blockMatch.content,
      });
    }

    lastIndex = blockMatch.endIndex;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    const textContent = content.slice(lastIndex).trim();
    if (textContent) {
      blocks.push({
        type: 'text',
        content: textContent,
      });
    }
  }

  // If no blocks were created, return the original text as a single block
  if (blocks.length === 0 && content.trim()) {
    blocks.push({
      type: 'text',
      content: content.trim(),
    });
  }

  return blocks;
}

/**
 * Detect if content contains code blocks
 */
export function hasCodeBlocks(content: string | ContentBlock[]): boolean {
  if (Array.isArray(content)) {
    return content.some((block) => block.type === 'code');
  }

  return /```[\s\S]*?```/.test(content);
}

/**
 * Detect if content contains mermaid diagrams
 */
export function hasMermaidBlocks(content: string | ContentBlock[]): boolean {
  if (Array.isArray(content)) {
    return content.some((block) => block.type === 'mermaid');
  }

  return /```mermaid[\s\S]*?```/.test(content);
}

/**
 * Extract all code blocks from content
 */
export function extractCodeBlocks(content: string | ContentBlock[]): CodeBlockType[] {
  const blocks = Array.isArray(content) ? content : parseMessageContent(content);
  return blocks.filter((block) => block.type === 'code') as CodeBlockType[];
}

/**
 * Extract all mermaid blocks from content
 */
export function extractMermaidBlocks(
  content: string | ContentBlock[]
): Array<{ type: 'mermaid'; content: string }> {
  const blocks = Array.isArray(content) ? content : parseMessageContent(content);
  return blocks.filter((block) => block.type === 'mermaid') as Array<{
    type: 'mermaid';
    content: string;
  }>;
}

/**
 * Extract all text blocks from content
 */
export function extractTextBlocks(content: string | ContentBlock[]): TextBlock[] {
  const blocks = Array.isArray(content) ? content : parseMessageContent(content);
  return blocks.filter((block) => block.type === 'text') as TextBlock[];
}

/**
 * Combine multiple text blocks into a single string
 */
export function flattenTextContent(content: string | ContentBlock[]): string {
  const blocks = Array.isArray(content) ? content : parseMessageContent(content);
  return blocks
    .filter((block) => block.type === 'text')
    .map((block) => (block as TextBlock).content)
    .join('\n\n');
}

/**
 * Check if block is a specific type
 */
export function isContentBlockType(
  block: ContentBlock,
  type: ContentBlock['type']
): boolean {
  return block.type === type;
}
