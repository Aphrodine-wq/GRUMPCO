/**
 * Tests for prompts/head.ts
 * Covers the getHeadSystemPrompt function and its branches for XML vs legacy format
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getHeadSystemPrompt, type HeadPromptOptions } from '../../src/prompts/head.js';
import { CLAUDE_CODE_QUALITY_BLOCK } from '../../src/prompts/shared/claude-code-quality.js';

// Mock the compose module
vi.mock('../../src/prompts/compose.js', () => ({
  composeHead: vi.fn((opts) => {
    let result = 'MOCKED_COMPOSED_HEAD';
    if (opts?.tier) result += `_TIER_${opts.tier}`;
    if (opts?.userKey) result += `_USER_${opts.userKey}`;
    if (opts?.includeCapabilities !== undefined) {
      result += `_CAPS_${opts.includeCapabilities}`;
    }
    return result;
  }),
}));

// Re-import to get the mocked version
import { composeHead } from '../../src/prompts/compose.js';

describe('prompts/head', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getHeadSystemPrompt', () => {
    describe('default behavior (XML mode)', () => {
      it('should use XML format by default when no options provided', () => {
        const result = getHeadSystemPrompt();
        expect(result).toContain('MOCKED_COMPOSED_HEAD');
        expect(composeHead).toHaveBeenCalledWith({
          tier: undefined,
          userKey: undefined,
          includeCapabilities: true,
        });
      });

      it('should use XML format when useXml is undefined', () => {
        const result = getHeadSystemPrompt({ useXml: undefined });
        expect(result).toContain('MOCKED_COMPOSED_HEAD');
        expect(composeHead).toHaveBeenCalled();
      });

      it('should use XML format when useXml is true', () => {
        const result = getHeadSystemPrompt({ useXml: true });
        expect(result).toContain('MOCKED_COMPOSED_HEAD');
        expect(composeHead).toHaveBeenCalled();
      });
    });

    describe('legacy format (useXml: false)', () => {
      it('should return legacy head when useXml is false', () => {
        const result = getHeadSystemPrompt({ useXml: false });
        
        // Should NOT call composeHead
        expect(composeHead).not.toHaveBeenCalled();
        
        // Should contain legacy prompt content
        expect(result).toContain('You are G-Rump');
        expect(result).toContain('AI coding assistant');
        expect(result).toContain('idea to code');
        expect(result).toContain('Claude Code quality standards');
      });

      it('should include identity section in legacy format', () => {
        const result = getHeadSystemPrompt({ useXml: false });
        
        expect(result).toContain('## Identity');
        expect(result).toContain('Name: G-Rump');
        expect(result).toContain('Role: Software architect and implementation partner');
        expect(result).toContain('Tone: Clear, concise, constructive');
      });

      it('should include Claude Code quality block in legacy format', () => {
        const result = getHeadSystemPrompt({ useXml: false });
        
        // Should include the quality block content (trimmed)
        expect(result).toContain('Claude Code Quality Standards');
        expect(result).toContain('Type safety');
        expect(result).toContain('Testing');
        expect(result).toContain('Security');
        expect(result).toContain('Performance');
        expect(result).toContain('Maintainability');
        expect(result).toContain('Error handling');
      });

      it('should include general rules section in legacy format', () => {
        const result = getHeadSystemPrompt({ useXml: false });
        
        expect(result).toContain('## General rules');
        expect(result).toContain('Prefer small, focused edits over large rewrites');
        expect(result).toContain('paths are relative to the workspace root');
        expect(result).toContain('Explain briefly what you did after tool use');
        expect(result).toContain('If the request is ambiguous');
      });

      it('should include structured modes in legacy format', () => {
        const result = getHeadSystemPrompt({ useXml: false });
        
        expect(result).toContain('Design');
        expect(result).toContain('Code');
        expect(result).toContain('Plan');
        expect(result).toContain('Spec');
        expect(result).toContain('Argument');
      });

      it('should ignore tier when useXml is false', () => {
        const result = getHeadSystemPrompt({ useXml: false, tier: 'pro' });
        
        // Should NOT call composeHead
        expect(composeHead).not.toHaveBeenCalled();
        
        // Should still return legacy format
        expect(result).toContain('You are G-Rump');
        expect(result).not.toContain('TIER_');
      });

      it('should ignore userKey when useXml is false', () => {
        const result = getHeadSystemPrompt({ useXml: false, userKey: 'test-user-123' });
        
        // Should NOT call composeHead
        expect(composeHead).not.toHaveBeenCalled();
        
        // Should still return legacy format
        expect(result).toContain('You are G-Rump');
        expect(result).not.toContain('USER_');
      });
    });

    describe('XML format with tier', () => {
      it('should pass tier to composeHead', () => {
        const result = getHeadSystemPrompt({ tier: 'free' });
        expect(result).toContain('TIER_free');
        expect(composeHead).toHaveBeenCalledWith(
          expect.objectContaining({ tier: 'free' })
        );
      });

      it('should pass pro tier to composeHead', () => {
        const result = getHeadSystemPrompt({ tier: 'pro' });
        expect(result).toContain('TIER_pro');
        expect(composeHead).toHaveBeenCalledWith(
          expect.objectContaining({ tier: 'pro' })
        );
      });

      it('should pass team tier to composeHead', () => {
        const result = getHeadSystemPrompt({ tier: 'team' });
        expect(result).toContain('TIER_team');
        expect(composeHead).toHaveBeenCalledWith(
          expect.objectContaining({ tier: 'team' })
        );
      });

      it('should pass enterprise tier to composeHead', () => {
        const result = getHeadSystemPrompt({ tier: 'enterprise' });
        expect(result).toContain('TIER_enterprise');
        expect(composeHead).toHaveBeenCalledWith(
          expect.objectContaining({ tier: 'enterprise' })
        );
      });
    });

    describe('XML format with userKey', () => {
      it('should pass userKey to composeHead', () => {
        const result = getHeadSystemPrompt({ userKey: 'user-abc-123' });
        expect(result).toContain('USER_user-abc-123');
        expect(composeHead).toHaveBeenCalledWith(
          expect.objectContaining({ userKey: 'user-abc-123' })
        );
      });

      it('should handle empty userKey', () => {
        const result = getHeadSystemPrompt({ userKey: '' });
        expect(composeHead).toHaveBeenCalledWith(
          expect.objectContaining({ userKey: '' })
        );
      });
    });

    describe('XML format with combined options', () => {
      it('should pass tier and userKey together', () => {
        const result = getHeadSystemPrompt({
          tier: 'enterprise',
          userKey: 'corp-user-456',
        });
        expect(result).toContain('TIER_enterprise');
        expect(result).toContain('USER_corp-user-456');
        expect(composeHead).toHaveBeenCalledWith({
          tier: 'enterprise',
          userKey: 'corp-user-456',
          includeCapabilities: true,
        });
      });

      it('should pass tier, userKey, and useXml: true together', () => {
        const result = getHeadSystemPrompt({
          tier: 'pro',
          userKey: 'premium-user',
          useXml: true,
        });
        expect(result).toContain('TIER_pro');
        expect(result).toContain('USER_premium-user');
        expect(composeHead).toHaveBeenCalled();
      });

      it('should always set includeCapabilities to true when using XML', () => {
        getHeadSystemPrompt({ tier: 'free' });
        expect(composeHead).toHaveBeenCalledWith(
          expect.objectContaining({ includeCapabilities: true })
        );

        vi.clearAllMocks();

        getHeadSystemPrompt({});
        expect(composeHead).toHaveBeenCalledWith(
          expect.objectContaining({ includeCapabilities: true })
        );
      });
    });

    describe('edge cases', () => {
      it('should handle undefined options gracefully', () => {
        expect(() => getHeadSystemPrompt(undefined)).not.toThrow();
        const result = getHeadSystemPrompt(undefined);
        expect(result).toContain('MOCKED_COMPOSED_HEAD');
      });

      it('should handle empty options object', () => {
        expect(() => getHeadSystemPrompt({})).not.toThrow();
        const result = getHeadSystemPrompt({});
        expect(result).toContain('MOCKED_COMPOSED_HEAD');
      });

      it('should return a non-empty string in all cases', () => {
        // XML mode
        const xmlResult = getHeadSystemPrompt();
        expect(typeof xmlResult).toBe('string');
        expect(xmlResult.length).toBeGreaterThan(0);

        // Legacy mode
        const legacyResult = getHeadSystemPrompt({ useXml: false });
        expect(typeof legacyResult).toBe('string');
        expect(legacyResult.length).toBeGreaterThan(0);
      });
    });
  });

  describe('HeadPromptOptions type', () => {
    it('should accept all valid option combinations', () => {
      const validOptions: HeadPromptOptions[] = [
        {},
        { tier: 'free' },
        { tier: 'pro' },
        { tier: 'team' },
        { tier: 'enterprise' },
        { userKey: 'any-key' },
        { useXml: true },
        { useXml: false },
        { tier: 'pro', userKey: 'test' },
        { tier: 'enterprise', userKey: 'corp', useXml: true },
        { tier: 'free', useXml: false },
      ];

      validOptions.forEach((opts) => {
        expect(() => getHeadSystemPrompt(opts)).not.toThrow();
      });
    });
  });
});

describe('prompts/head - integration with real compose', () => {
  // Reset mocks to use real implementation for integration tests
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should produce valid XML-structured output in real mode', async () => {
    // Dynamically import the real module without mocks
    vi.doUnmock('../../src/prompts/compose.js');
    const { getHeadSystemPrompt: realGetHeadSystemPrompt } = await import(
      '../../src/prompts/head.js'
    );

    const result = realGetHeadSystemPrompt();

    // Should contain XML tags from the real composeHead
    expect(result).toContain('<identity>');
    expect(result).toContain('</identity>');
    expect(result).toContain('<rules>');
    expect(result).toContain('</rules>');
    expect(result).toContain('<capabilities>');
    expect(result).toContain('</capabilities>');
    expect(result).toContain('You are G-Rump');
  });

  it('should include capability list based on tier in real mode', async () => {
    vi.doUnmock('../../src/prompts/compose.js');
    const { getHeadSystemPrompt: realGetHeadSystemPrompt } = await import(
      '../../src/prompts/head.js'
    );

    // Free tier should have basic capabilities
    const freeResult = realGetHeadSystemPrompt({ tier: 'free' });
    expect(freeResult).toContain('Design');
    expect(freeResult).toContain('Plan');
    expect(freeResult).toContain('Code');

    // Pro tier should have more capabilities
    const proResult = realGetHeadSystemPrompt({ tier: 'pro' });
    expect(proResult).toContain('SHIP');
    expect(proResult).toContain('Codegen');
  });

  it('should produce legacy format without XML tags when useXml is false', async () => {
    vi.doUnmock('../../src/prompts/compose.js');
    const { getHeadSystemPrompt: realGetHeadSystemPrompt } = await import(
      '../../src/prompts/head.js'
    );

    const result = realGetHeadSystemPrompt({ useXml: false });

    // Should NOT contain XML tags
    expect(result).not.toContain('<identity>');
    expect(result).not.toContain('</identity>');
    expect(result).not.toContain('<rules>');
    expect(result).not.toContain('<capabilities>');

    // Should contain markdown sections instead
    expect(result).toContain('## Identity');
    expect(result).toContain('## General rules');
  });
});
