/**
 * Mock Anthropic SDK
 * Provides configurable mock responses for Claude API calls
 */

import type { MessageStreamEvent } from '@anthropic-ai/sdk';

export interface MockClaudeResponse {
  content?: string;
  toolUse?: Array<{
    id: string;
    name: string;
    input: Record<string, any>;
  }>;
  error?: {
    status?: number;
    message: string;
    code?: string;
  };
  delay?: number;
}

export class MockAnthropicClient {
  private responses: Map<string, MockClaudeResponse> = new Map();
  private defaultDelay = 0;
  private shouldFail = false;
  private failAfter = 0;
  private callCount = 0;

  /**
   * Set a mock response for a specific request pattern
   */
  setResponse(key: string, response: MockClaudeResponse): void {
    this.responses.set(key, response);
  }

  /**
   * Set default delay for all requests
   */
  setDefaultDelay(ms: number): void {
    this.defaultDelay = ms;
  }

  /**
   * Configure to fail after N calls
   */
  setFailAfter(count: number): void {
    this.shouldFail = true;
    this.failAfter = count;
  }

  /**
   * Reset all mock state
   */
  reset(): void {
    this.responses.clear();
    this.defaultDelay = 0;
    this.shouldFail = false;
    this.failAfter = 0;
    this.callCount = 0;
  }

  /**
   * Get call count
   */
  getCallCount(): number {
    return this.callCount;
  }

  /**
   * Mock messages.create
   */
  async messages = {
    create: async (params: any): Promise<any> => {
      this.callCount++;
      
      if (this.shouldFail && this.callCount > this.failAfter) {
        throw new Error('Mock API failure');
      }

      const key = this._getRequestKey(params);
      const response = this.responses.get(key) || this.responses.get('default') || {
        content: 'Mock response',
      };

      if (response.delay || this.defaultDelay) {
        await this._delay(response.delay || this.defaultDelay);
      }

      if (response.error) {
        const error: any = new Error(response.error.message);
        error.status = response.error.status;
        error.code = response.error.code;
        throw error;
      }

      return {
        content: [{ type: 'text', text: response.content || 'Mock response' }],
      };
    },

    stream: async function* (params: any): AsyncGenerator<MessageStreamEvent, void, unknown> {
      const mockClient = this as unknown as MockAnthropicClient;
      mockClient.callCount++;

      if (mockClient.shouldFail && mockClient.callCount > mockClient.failAfter) {
        throw new Error('Mock stream failure');
      }

      const key = mockClient._getRequestKey(params);
      const response = mockClient.responses.get(key) || mockClient.responses.get('default') || {
        content: 'Mock stream response',
      };

      if (response.delay || mockClient.defaultDelay) {
        await mockClient._delay(response.delay || mockClient.defaultDelay);
      }

      if (response.error) {
        const error: any = new Error(response.error.message);
        error.status = response.error.status;
        error.code = response.error.code;
        throw error;
      }

      // Yield text deltas
      if (response.content) {
        const words = response.content.split(' ');
        for (const word of words) {
          yield {
            type: 'content_block_delta',
            delta: {
              type: 'text_delta',
              text: word + ' ',
            },
            index: 0,
          } as MessageStreamEvent;
        }
      }

      // Yield tool use if specified
      if (response.toolUse) {
        for (const tool of response.toolUse) {
          yield {
            type: 'content_block_start',
            content_block: {
              type: 'tool_use',
              id: tool.id,
              name: tool.name,
              input: tool.input,
            },
            index: 0,
          } as MessageStreamEvent;
        }
      }

      yield {
        type: 'message_stop',
      } as MessageStreamEvent;
    },
  };

  private _getRequestKey(params: any): string {
    // Create a key from request parameters
    return JSON.stringify({
      model: params.model,
      system: params.system?.substring(0, 50),
      messageCount: params.messages?.length,
      hasTools: !!params.tools,
    });
  }

  private _delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create a mock Anthropic client instance
 */
export function createMockAnthropicClient(): MockAnthropicClient {
  return new MockAnthropicClient();
}
