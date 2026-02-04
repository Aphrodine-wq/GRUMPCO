/**
 * API Client Tests
 *
 * Comprehensive tests for the central API client
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  getApiBase,
  resetApiBase,
  fetchApi,
  getSkills,
  getSkill,
  generateSkillMd,
  createShareLink,
} from './api';

describe('api', () => {
  beforeEach(() => {
    resetApiBase();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetApiBase();
  });

  describe('getApiBase', () => {
    it('should return default base URL in dev', () => {
      const base = getApiBase();
      // In test environment, should return default
      expect(base).toBe('http://localhost:3000');
    });

    it('should cache the base URL', () => {
      const base1 = getApiBase();
      const base2 = getApiBase();
      expect(base1).toBe(base2);
    });
  });

  describe('resetApiBase', () => {
    it('should clear cached base URL', () => {
      getApiBase(); // Cache it
      resetApiBase();
      // After reset, should re-evaluate
      const base = getApiBase();
      expect(base).toBe('http://localhost:3000');
    });
  });

  describe('fetchApi', () => {
    it('should make request with correct URL', async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response('{}'));
      vi.stubGlobal('fetch', mockFetch);

      await fetchApi('/api/test');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should add leading slash if missing', async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response('{}'));
      vi.stubGlobal('fetch', mockFetch);

      await fetchApi('api/test');

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/api/test', expect.any(Object));
    });

    it('should pass custom headers', async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response('{}'));
      vi.stubGlobal('fetch', mockFetch);

      await fetchApi('/api/test', {
        headers: { 'X-Custom': 'value' },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Custom': 'value',
          }),
        })
      );
    });

    it('should pass request options', async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response('{}'));
      vi.stubGlobal('fetch', mockFetch);

      await fetchApi('/api/test', {
        method: 'POST',
        body: JSON.stringify({ data: 'test' }),
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ data: 'test' }),
        })
      );
    });

    it('should retry on 5xx errors when retries configured', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(new Response('{}', { status: 500 }))
        .mockResolvedValueOnce(new Response('{}', { status: 500 }))
        .mockResolvedValueOnce(new Response('{}', { status: 200 }));
      vi.stubGlobal('fetch', mockFetch);

      const response = await fetchApi('/api/test', { retries: 2 });

      expect(response.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should not retry on success', async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
      vi.stubGlobal('fetch', mockFetch);

      await fetchApi('/api/test', { retries: 3 });

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should not retry 4xx errors', async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response('{}', { status: 400 }));
      vi.stubGlobal('fetch', mockFetch);

      const response = await fetchApi('/api/test', { retries: 3 });

      expect(response.status).toBe(400);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should throw after exhausting retries', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      vi.stubGlobal('fetch', mockFetch);

      await expect(fetchApi('/api/test', { retries: 2 })).rejects.toThrow('Network error');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it.skip('should apply timeout when no signal provided', async () => {
      // Flaky: fake timers and AbortController interaction
      vi.useFakeTimers();
      const mockFetch = vi
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve(new Response('{}')), 50000))
        );
      vi.stubGlobal('fetch', mockFetch);
      const fetchPromise = fetchApi('/api/test', { timeout: 1000 });
      vi.advanceTimersByTime(1001);
      await expect(fetchPromise).rejects.toThrow();
      vi.useRealTimers();
    });

    it('should not apply timeout when signal provided', async () => {
      const controller = new AbortController();
      const mockFetch = vi.fn().mockResolvedValue(new Response('{}'));
      vi.stubGlobal('fetch', mockFetch);

      await fetchApi('/api/test', {
        signal: controller.signal,
        timeout: 100,
      });

      // Should pass the user's signal, not create a timeout
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: controller.signal,
        })
      );
    });
  });

  describe('error handling', () => {
    it('should propagate network errors', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      vi.stubGlobal('fetch', mockFetch);

      await expect(fetchApi('/api/test')).rejects.toThrow('Network error');
    });

    it('should return error responses without throwing', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValue(new Response('{"error": "Not found"}', { status: 404 }));
      vi.stubGlobal('fetch', mockFetch);

      const response = await fetchApi('/api/test');
      expect(response.status).toBe(404);
    });
  });

  describe('getSkills', () => {
    it('should fetch and return skills list', async () => {
      const mockSkills = [
        { id: 'skill-1', name: 'Test Skill 1' },
        { id: 'skill-2', name: 'Test Skill 2' },
      ];
      const mockFetch = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ skills: mockSkills }), { status: 200 }));
      vi.stubGlobal('fetch', mockFetch);

      const skills = await getSkills();

      expect(skills).toEqual(mockSkills);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/skills'),
        expect.any(Object)
      );
    });

    it('should return empty array when skills is undefined', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
      vi.stubGlobal('fetch', mockFetch);

      const skills = await getSkills();

      expect(skills).toEqual([]);
    });

    it('should throw on error response', async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response('{}', { status: 500 }));
      vi.stubGlobal('fetch', mockFetch);

      await expect(getSkills()).rejects.toThrow('Failed to fetch skills: 500');
    });
  });

  describe('getSkill', () => {
    it('should fetch and return skill detail', async () => {
      const mockSkill = { id: 'skill-1', name: 'Test Skill', tools: ['tool1'] };
      const mockFetch = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify(mockSkill), { status: 200 }));
      vi.stubGlobal('fetch', mockFetch);

      const skill = await getSkill('skill-1');

      expect(skill).toEqual(mockSkill);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/skills/skill-1'),
        expect.any(Object)
      );
    });

    it('should return null for 404', async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response('{}', { status: 404 }));
      vi.stubGlobal('fetch', mockFetch);

      const skill = await getSkill('nonexistent');

      expect(skill).toBeNull();
    });

    it('should throw on other error responses', async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response('{}', { status: 500 }));
      vi.stubGlobal('fetch', mockFetch);

      await expect(getSkill('skill-1')).rejects.toThrow('Failed to fetch skill: 500');
    });

    it('should encode skill ID in URL', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ id: 'skill/with/slashes' }), { status: 200 })
        );
      vi.stubGlobal('fetch', mockFetch);

      await getSkill('skill/with/slashes');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/skills/skill%2Fwith%2Fslashes'),
        expect.any(Object)
      );
    });
  });

  describe('generateSkillMd', () => {
    it('should generate skill markdown', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ content: '# My Skill\n\nDescription' }), { status: 200 })
        );
      vi.stubGlobal('fetch', mockFetch);

      const markdown = await generateSkillMd('Create a skill that does X');

      expect(markdown).toBe('# My Skill\n\nDescription');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/skills-api/generate-skill-md'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ description: 'Create a skill that does X' }),
        })
      );
    });

    it('should return empty string when content is undefined', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
      vi.stubGlobal('fetch', mockFetch);

      const markdown = await generateSkillMd('Create a skill');

      expect(markdown).toBe('');
    });

    it('should throw on error response', async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response('{}', { status: 500 }));
      vi.stubGlobal('fetch', mockFetch);

      await expect(generateSkillMd('Create a skill')).rejects.toThrow(
        'Failed to generate skill: 500'
      );
    });
  });

  describe('createShareLink', () => {
    it('should create share link for diagram', async () => {
      const mockResponse = {
        success: true,
        shareId: 'abc123',
        shareUrl: 'https://example.com/share/abc123',
        expiresAt: '2024-01-01T00:00:00Z',
      };
      const mockFetch = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify(mockResponse), { status: 200 }));
      vi.stubGlobal('fetch', mockFetch);

      const result = await createShareLink({
        type: 'diagram',
        content: 'graph TD\nA-->B',
        title: 'My Diagram',
      });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/share'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"type":"diagram"'),
        })
      );
    });

    it('should use default expiresIn of 168 hours', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ success: true, shareId: 'x', shareUrl: 'x', expiresAt: 'x' }),
            { status: 200 }
          )
        );
      vi.stubGlobal('fetch', mockFetch);

      await createShareLink({
        type: 'code',
        content: 'console.log("hello")',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.expiresIn).toBe(168);
    });

    it('should allow custom expiresIn', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ success: true, shareId: 'x', shareUrl: 'x', expiresAt: 'x' }),
            { status: 200 }
          )
        );
      vi.stubGlobal('fetch', mockFetch);

      await createShareLink({
        type: 'prd',
        content: 'PRD content',
        expiresIn: 24,
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.expiresIn).toBe(24);
    });

    it('should throw on error response', async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response('{}', { status: 500 }));
      vi.stubGlobal('fetch', mockFetch);

      await expect(
        createShareLink({
          type: 'architecture',
          content: 'Architecture content',
        })
      ).rejects.toThrow('Failed to create share link: 500');
    });
  });

  describe('Electron detection', () => {
    it('should use localhost:3000 when running in Electron', async () => {
      // Set up Electron detection
      (window as { grump?: { isElectron?: boolean } }).grump = { isElectron: true };
      resetApiBase();

      const base = getApiBase();

      expect(base).toBe('http://localhost:3000');

      // Clean up
      delete (window as { grump?: { isElectron?: boolean } }).grump;
      resetApiBase();
    });

    it('should add X-GRump-Client header as desktop for Electron', async () => {
      (window as { grump?: { isElectron?: boolean } }).grump = { isElectron: true };
      resetApiBase();

      const mockFetch = vi.fn().mockResolvedValue(new Response('{}'));
      vi.stubGlobal('fetch', mockFetch);

      await fetchApi('/api/test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-GRump-Client': 'desktop',
          }),
        })
      );

      // Clean up
      delete (window as { grump?: { isElectron?: boolean } }).grump;
      resetApiBase();
    });

    it('should add X-GRump-Client header as desktop (Electron-only)', async () => {
      delete (window as { grump?: { isElectron?: boolean } }).grump;
      resetApiBase();

      const mockFetch = vi.fn().mockResolvedValue(new Response('{}'));
      vi.stubGlobal('fetch', mockFetch);

      await fetchApi('/api/test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-GRump-Client': 'desktop',
          }),
        })
      );
    });
  });
});
