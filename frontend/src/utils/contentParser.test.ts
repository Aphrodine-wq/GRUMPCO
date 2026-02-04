import { describe, it, expect } from 'vitest';
import {
  parseMessageContent,
  hasCodeBlocks,
  hasMermaidBlocks,
  extractCodeBlocks,
  extractMermaidBlocks,
  extractTextBlocks,
  flattenTextContent,
  isContentBlockType,
} from './contentParser';
import type { ContentBlock } from '../types';

describe('contentParser', () => {
  describe('parseMessageContent', () => {
    it('should parse a simple text message', () => {
      const content = 'Hello, world!';
      const expected: ContentBlock[] = [{ type: 'text', content: 'Hello, world!' }];
      expect(parseMessageContent(content)).toEqual(expected);
    });

    it('should parse a message with a single code block', () => {
      const content = 'Here is some code:\n```javascript\nconsole.log("Hello");\n```';
      const expected: ContentBlock[] = [
        { type: 'text', content: 'Here is some code:' },
        { type: 'code', language: 'javascript', code: 'console.log("Hello");' },
      ];
      expect(parseMessageContent(content)).toEqual(expected);
    });

    it('should parse a message with a mermaid block', () => {
      const content = 'And a diagram:\n```mermaid\ngraph TD;\n  A-->B;\n```';
      const expected: ContentBlock[] = [
        { type: 'text', content: 'And a diagram:' },
        { type: 'mermaid', content: 'graph TD;\n  A-->B;' },
      ];
      expect(parseMessageContent(content)).toEqual(expected);
    });

    it('should handle multiple code and mermaid blocks', () => {
      const content =
        'First text.\n```javascript\nlet a = 1;\n```\nSecond text.\n```mermaid\ngraph LR;\n  C==>D;\n```';
      const expected: ContentBlock[] = [
        { type: 'text', content: 'First text.' },
        { type: 'code', language: 'javascript', code: 'let a = 1;' },
        { type: 'text', content: 'Second text.' },
        { type: 'mermaid', content: 'graph LR;\n  C==>D;' },
      ];
      expect(parseMessageContent(content)).toEqual(expected);
    });

    it('should return an empty array for empty or invalid content', () => {
      expect(parseMessageContent('')).toEqual([]);
      expect(parseMessageContent(null as unknown as string)).toEqual([]);
      expect(parseMessageContent(undefined as unknown as string)).toEqual([]);
    });

    it('should return content as-is if already an array', () => {
      const content: ContentBlock[] = [{ type: 'text', content: 'already parsed' }];
      expect(parseMessageContent(content)).toBe(content);
    });

    it('should create single text block for content without code blocks', () => {
      const content = 'Just some plain text without any code blocks';
      const result = parseMessageContent(content);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('text');
      expect((result[0] as { type: 'text'; content: string }).content).toBe(
        'Just some plain text without any code blocks'
      );
    });
  });

  describe('helper functions', () => {
    const textAndCode = 'Some text\n```javascript\nconst x = 1;\n```';
    const textAndMermaid = 'A diagram\n```mermaid\ngraph TD; A-->B;\n```';
    const onlyText = 'Just plain text.';

    it('hasCodeBlocks should detect code blocks', () => {
      expect(hasCodeBlocks(textAndCode)).toBe(true);
      expect(hasCodeBlocks(textAndMermaid)).toBe(true); // Mermaid is also a code block
      expect(hasCodeBlocks(onlyText)).toBe(false);
    });

    it('hasCodeBlocks should detect code blocks in ContentBlock array', () => {
      const blocksWithCode: ContentBlock[] = [
        { type: 'text', content: 'Some text' },
        { type: 'code', language: 'javascript', code: 'const x = 1;' },
      ];
      const blocksWithoutCode: ContentBlock[] = [{ type: 'text', content: 'Some text' }];

      expect(hasCodeBlocks(blocksWithCode)).toBe(true);
      expect(hasCodeBlocks(blocksWithoutCode)).toBe(false);
    });

    it('hasMermaidBlocks should detect mermaid blocks', () => {
      expect(hasMermaidBlocks(textAndCode)).toBe(false);
      expect(hasMermaidBlocks(textAndMermaid)).toBe(true);
      expect(hasMermaidBlocks(onlyText)).toBe(false);
    });

    it('extractCodeBlocks should extract only code blocks', () => {
      const blocks = extractCodeBlocks(textAndCode);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('code');
    });

    it('extractMermaidBlocks should extract only mermaid blocks', () => {
      const blocks = extractMermaidBlocks(textAndMermaid);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('mermaid');
    });

    it('extractTextBlocks should extract only text blocks', () => {
      const blocks = extractTextBlocks(textAndCode);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('text');
      expect(blocks[0].content).toBe('Some text');
    });

    it('flattenTextContent should combine text blocks', () => {
      const content = 'First line.\n```js\n// code\n```\nSecond line.';
      const flattened = flattenTextContent(content);
      expect(flattened).toBe('First line.\n\nSecond line.');
    });

    it('hasMermaidBlocks should detect mermaid blocks in ContentBlock array', () => {
      const blocksWithMermaid: ContentBlock[] = [
        { type: 'text', content: 'Some text' },
        { type: 'mermaid', content: 'graph TD; A-->B;' },
      ];
      const blocksWithoutMermaid: ContentBlock[] = [
        { type: 'text', content: 'Some text' },
        { type: 'code', language: 'javascript', code: 'const x = 1;' },
      ];

      expect(hasMermaidBlocks(blocksWithMermaid)).toBe(true);
      expect(hasMermaidBlocks(blocksWithoutMermaid)).toBe(false);
    });
  });

  describe('isContentBlockType', () => {
    it('should return true when block type matches', () => {
      const textBlock: ContentBlock = { type: 'text', content: 'Hello' };
      const codeBlock: ContentBlock = {
        type: 'code',
        language: 'javascript',
        code: 'const x = 1;',
      };
      const mermaidBlock: ContentBlock = { type: 'mermaid', content: 'graph TD;' };

      expect(isContentBlockType(textBlock, 'text')).toBe(true);
      expect(isContentBlockType(codeBlock, 'code')).toBe(true);
      expect(isContentBlockType(mermaidBlock, 'mermaid')).toBe(true);
    });

    it('should return false when block type does not match', () => {
      const textBlock: ContentBlock = { type: 'text', content: 'Hello' };
      const codeBlock: ContentBlock = {
        type: 'code',
        language: 'javascript',
        code: 'const x = 1;',
      };

      expect(isContentBlockType(textBlock, 'code')).toBe(false);
      expect(isContentBlockType(textBlock, 'mermaid')).toBe(false);
      expect(isContentBlockType(codeBlock, 'text')).toBe(false);
    });
  });
});
