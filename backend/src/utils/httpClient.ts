/**
 * HTTP Client with Connection Pooling
 * Optimized for making external API calls with connection reuse
 */

import https from 'https';
import http from 'http';
import logger from '../middleware/logger.js';

export interface HttpClientOptions {
  maxSockets?: number;
  maxFreeSockets?: number;
  timeout?: number;
  keepAlive?: boolean;
  keepAliveMsecs?: number;
}

export class HttpClient {
  private httpsAgent: https.Agent;
  private httpAgent: http.Agent;

  constructor(options: HttpClientOptions = {}) {
    const agentOptions = {
      maxSockets: options.maxSockets || 50, // Max concurrent connections per host
      maxFreeSockets: options.maxFreeSockets || 10, // Max idle connections to keep
      timeout: options.timeout || 60000, // Socket timeout
      keepAlive: options.keepAlive ?? true,
      keepAliveMsecs: options.keepAliveMsecs || 1000,
    };

    this.httpsAgent = new https.Agent(agentOptions);
    this.httpAgent = new http.Agent(agentOptions);

    logger.info({ options: agentOptions }, 'HTTP client initialized with connection pooling');
  }

  /**
   * Make a fetch request with connection pooling
   */
  public async fetch(url: string | URL, options: RequestInit = {}): Promise<Response> {
    const urlObj = typeof url === 'string' ? new URL(url) : url;
    const isHttps = urlObj.protocol === 'https:';

    // Add agent for connection pooling
    const fetchOptions: RequestInit = {
      ...options,
      // @ts-expect-error - Node.js fetch supports agent
      agent: isHttps ? this.httpsAgent : this.httpAgent,
    };

    try {
      const response = await fetch(url, fetchOptions);
      return response;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          url: urlObj.toString(),
        },
        'HTTP request failed'
      );
      throw error;
    }
  }

  /**
   * Get agent statistics
   */
  public getStats(): {
    https: { sockets: number; freeSockets: number; requests: number };
    http: { sockets: number; freeSockets: number; requests: number };
  } {
    return {
      https: {
        sockets: Object.keys(this.httpsAgent.sockets).length,
        freeSockets: Object.keys(this.httpsAgent.freeSockets).length,
        requests: Object.keys(this.httpsAgent.requests || {}).length,
      },
      http: {
        sockets: Object.keys(this.httpAgent.sockets).length,
        freeSockets: Object.keys(this.httpAgent.freeSockets).length,
        requests: Object.keys(this.httpAgent.requests || {}).length,
      },
    };
  }

  /**
   * Destroy all agents and close connections
   */
  public destroy(): void {
    this.httpsAgent.destroy();
    this.httpAgent.destroy();
    logger.info('HTTP client destroyed');
  }
}

// Singleton instance
let httpClient: HttpClient | null = null;

/**
 * Get or create the global HTTP client
 */
export function getHttpClient(): HttpClient {
  if (!httpClient) {
    httpClient = new HttpClient();
  }
  return httpClient;
}

/**
 * Destroy the HTTP client
 */
export function destroyHttpClient(): void {
  if (httpClient) {
    httpClient.destroy();
    httpClient = null;
  }
}

/**
 * Helper function for making pooled HTTP requests
 */
export async function pooledFetch(url: string | URL, options: RequestInit = {}): Promise<Response> {
  const client = getHttpClient();
  return client.fetch(url, options);
}
