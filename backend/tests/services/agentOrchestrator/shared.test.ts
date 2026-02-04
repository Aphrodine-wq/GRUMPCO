import { describe, it, expect } from 'vitest';
import {
  extractJsonFromResponse,
  convertAgentOutputToFiles,
  getLanguageFromPath,
  DEFAULT_AGENT_MODEL,
  AGENT_QUALITY_STANDARD,
} from '../../../src/services/agentOrchestrator/shared.js';

describe('agentOrchestrator/shared', () => {
  describe('extractJsonFromResponse', () => {
    it('should extract JSON from ```json fenced blocks', () => {
      const input = 'Some preamble\n```json\n{"key": "value"}\n```\nTrailing text';
      expect(extractJsonFromResponse(input)).toBe('{"key": "value"}');
    });

    it('should extract JSON from ``` fenced blocks without language tag', () => {
      const input = '```\n{"key": "value"}\n```';
      expect(extractJsonFromResponse(input)).toBe('{"key": "value"}');
    });

    it('should return raw text when no fences present', () => {
      const input = '{"key": "value"}';
      expect(extractJsonFromResponse(input)).toBe('{"key": "value"}');
    });

    it('should handle multiline JSON inside fences', () => {
      const input = '```json\n{\n  "a": 1,\n  "b": [2, 3]\n}\n```';
      const result = extractJsonFromResponse(input);
      expect(JSON.parse(result)).toEqual({ a: 1, b: [2, 3] });
    });
  });

  describe('convertAgentOutputToFiles', () => {
    it('should convert agent output arrays into GeneratedFile[]', () => {
      const output = {
        components: [
          { path: 'src/App.tsx', content: 'export default function App() {}', type: 'source' },
          { path: 'src/App.test.tsx', content: 'test("renders")', type: 'test' },
        ],
      };
      const files = convertAgentOutputToFiles(output);
      expect(files).toHaveLength(2);
      expect(files[0].path).toBe('src/App.tsx');
      expect(files[0].type).toBe('source');
      expect(files[0].language).toBe('typescript');
      expect(files[0].size).toBe('export default function App() {}'.length);
      expect(files[1].type).toBe('test');
    });

    it('should skip items without path or content', () => {
      const output = {
        files: [
          { path: 'a.ts', content: 'code' },
          { path: 'b.ts' },             // no content
          { content: 'orphan' },          // no path
          {},                              // empty
        ],
      };
      expect(convertAgentOutputToFiles(output)).toHaveLength(1);
    });

    it('should default type to source for unknown types', () => {
      const output = {
        files: [{ path: 'x.py', content: 'pass', type: 'unknown' }],
      };
      expect(convertAgentOutputToFiles(output)[0].type).toBe('source');
    });

    it('should accept config and doc types', () => {
      const output = {
        files: [
          { path: 'Dockerfile', content: 'FROM node', type: 'config' },
          { path: 'README.md', content: '# Hello', type: 'doc' },
        ],
      };
      const files = convertAgentOutputToFiles(output);
      expect(files[0].type).toBe('config');
      expect(files[1].type).toBe('doc');
    });

    it('should handle multiple keys in output', () => {
      const output = {
        frontend: [{ path: 'a.vue', content: '<template/>' }],
        backend: [{ path: 'b.go', content: 'package main' }],
        nonArray: 'ignore me',
      };
      expect(convertAgentOutputToFiles(output)).toHaveLength(2);
    });

    it('should return empty array for empty output', () => {
      expect(convertAgentOutputToFiles({})).toEqual([]);
    });
  });

  describe('getLanguageFromPath', () => {
    const cases: [string, string][] = [
      ['file.ts', 'typescript'],
      ['file.tsx', 'typescript'],
      ['file.js', 'javascript'],
      ['file.jsx', 'javascript'],
      ['file.py', 'python'],
      ['file.vue', 'vue'],
      ['file.go', 'go'],
      ['file.sql', 'sql'],
      ['file.json', 'json'],
      ['file.yaml', 'yaml'],
      ['file.yml', 'yaml'],
      ['file.md', 'markdown'],
      ['file.sh', 'shell'],
      ['file.unknown', 'text'],
      ['Dockerfile', 'text'],
    ];

    it.each(cases)('should detect language for %s as %s', (path, expected) => {
      expect(getLanguageFromPath(path)).toBe(expected);
    });
  });

  describe('constants', () => {
    it('should export the default agent model', () => {
      expect(DEFAULT_AGENT_MODEL).toBe('meta/llama-3.1-405b-instruct');
    });

    it('should export the quality standard', () => {
      expect(AGENT_QUALITY_STANDARD).toBe('kimi-k2.5');
    });
  });
});
