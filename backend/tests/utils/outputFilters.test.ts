/**
 * Output filters – redact secrets, PII, harmful code
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  redactSecrets,
  redactPii,
  filterHarmfulCode,
  filterOutput,
} from '../../src/utils/outputFilters.js';

describe('outputFilters', () => {
  const origPii = process.env.OUTPUT_FILTER_PII;
  const origHarmful = process.env.OUTPUT_FILTER_HARMFUL;

  afterEach(() => {
    process.env.OUTPUT_FILTER_PII = origPii;
    process.env.OUTPUT_FILTER_HARMFUL = origHarmful;
  });

  describe('redactSecrets', () => {
    it('redacts sk- style API keys', () => {
      const text = 'Use sk-abc123def456ghi789jkl012.';
      expect(redactSecrets(text)).toContain('[REDACTED]');
      expect(redactSecrets(text)).not.toContain('sk-abc123');
    });

    it('redacts bearer tokens', () => {
      const text = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxx';
      expect(redactSecrets(text)).toContain('[REDACTED]');
      expect(redactSecrets(text)).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    });

    it('redacts api_key= style', () => {
      const text = 'api_key=abc123def456ghi789jkl012';
      expect(redactSecrets(text)).toContain('[REDACTED]');
    });

    it('leaves normal code unchanged', () => {
      const text = 'const x = 1; function foo() {}';
      expect(redactSecrets(text)).toBe(text);
    });
  });

  describe('redactPii', () => {
    it('leaves text unchanged when OUTPUT_FILTER_PII is not set', () => {
      delete process.env.OUTPUT_FILTER_PII;
      const text = 'Email me at user@example.com.';
      expect(redactPii(text)).toBe(text);
    });

    it('redacts emails when OUTPUT_FILTER_PII=true', () => {
      process.env.OUTPUT_FILTER_PII = 'true';
      const text = 'Contact user@example.com or admin@test.org.';
      const out = redactPii(text);
      expect(out).toContain('[EMAIL]');
      expect(out).not.toContain('user@example.com');
    });
  });

  describe('filterHarmfulCode', () => {
    it('leaves text unchanged when OUTPUT_FILTER_HARMFUL is not set', () => {
      delete process.env.OUTPUT_FILTER_HARMFUL;
      const text = 'rm -rf /';
      expect(filterHarmfulCode(text)).toEqual({ filtered: text, flagged: false });
    });

    it('flags and replaces rm -rf / when OUTPUT_FILTER_HARMFUL=true', () => {
      process.env.OUTPUT_FILTER_HARMFUL = 'true';
      const text = 'Run: rm -rf /';
      const { filtered, flagged } = filterHarmfulCode(text);
      expect(flagged).toBe(true);
      expect(filtered).toContain('[FLAGGED]');
      expect(filtered).not.toContain('rm -rf /');
    });
  });

  describe('filterOutput', () => {
    it('applies secret redaction', () => {
      const text = 'Key: sk-ant-abc123def456.';
      expect(filterOutput(text)).toContain('[REDACTED]');
      expect(filterOutput(text)).not.toContain('sk-ant-abc123');
    });

    it('preserves safe content', () => {
      const text = 'Hello world. const x = 1;';
      expect(filterOutput(text)).toBe(text);
    });
  });
});
