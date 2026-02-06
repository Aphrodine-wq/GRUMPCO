import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock dependencies
const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};

vi.mock('../../src/middleware/logger.js', () => ({
  default: mockLogger,
}));

vi.mock('../../src/services/integrationService.js', () => ({
  getAccessToken: vi.fn().mockReturnValue('mock-token'),
  isTokenExpired: vi.fn().mockResolvedValue(false),
  refreshOAuthTokens: vi.fn(),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('jiraService Performance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it('measures bulkCreateIssues performance', async () => {
    // Mock fetch to delay 50ms
    mockFetch.mockImplementation(async (url) => {
      // Handle cloud ID lookup
      if (url.includes('accessible-resources')) {
        return {
          ok: true,
          json: async () => [{ id: 'cloud-id', name: 'Cloud', url: 'https://site.atlassian.net' }]
        };
      }

      // Simulate network latency for issue creation
      await new Promise(r => setTimeout(r, 50));

      return {
        ok: true,
        status: 201,
        json: async () => ({
          id: '10000',
          key: 'TEST-1',
          self: 'https://site.atlassian.net/rest/api/3/issue/10000'
        })
      };
    });

    const { bulkCreateIssues } = await import('../../src/services/jiraService.js');

    const inputs: any[] = Array(5).fill({
      projectKey: 'TEST',
      summary: 'Test Issue',
      issueType: 'Task'
    });

    console.log('Starting benchmark with 5 items...');
    const start = Date.now();
    const results = await bulkCreateIssues('user-1', inputs);
    const end = Date.now();
    const duration = end - start;

    console.log(`Duration: ${duration}ms`);

    // Check results
    expect(results).toHaveLength(5);
    expect(results[0]).not.toBeNull();
  });

  it('handles partial failures correctly', async () => {
    mockFetch.mockImplementation(async (url, options) => {
      if (url.includes('accessible-resources')) {
        return { ok: true, json: async () => [{ id: 'cloud-id' }] };
      }

      if (options?.body && options.body.includes('FAIL')) {
         return { ok: false, status: 500, text: async () => 'Error' };
      }

      return { ok: true, status: 201, json: async () => ({ key: 'TEST-1' }) };
    });

    const { bulkCreateIssues } = await import('../../src/services/jiraService.js');

    const inputs: any[] = [
      { projectKey: 'TEST', summary: 'Success', issueType: 'Task' },
      { projectKey: 'TEST', summary: 'FAIL', issueType: 'Task' },
    ];

    const results = await bulkCreateIssues('user-1', inputs);

    expect(results).toHaveLength(2);
    expect(results[0]).not.toBeNull();
    expect(results[1]).toBeNull();
  });
});
