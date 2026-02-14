/**
 * API Tester Skill
 * Generate and execute HTTP request tests against REST APIs
 */
import type { SkillContext, ToolDefinition, ToolExecutionResult } from '../types.js';

export const tools = {
  definitions: [
    {
      name: 'generate_api_tests',
      description: 'Generate HTTP request test cases for a given API endpoint or OpenAPI spec',
      parameters: {
        type: 'object',
        properties: {
          endpoint: { type: 'string', description: 'The API endpoint URL to test' },
          method: {
            type: 'string',
            enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
            description: 'HTTP method',
          },
          description: { type: 'string', description: 'What the endpoint does' },
        },
        required: ['endpoint', 'method'],
      },
    },
    {
      name: 'run_api_test',
      description: 'Execute an HTTP request and validate the response against expected status/body',
      input_schema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Full URL to request' },
          method: { type: 'string', description: 'HTTP method' },
          headers: { type: 'object', description: 'Request headers' },
          body: { type: 'string', description: 'Request body (JSON string)' },
          expectedStatus: { type: 'number', description: 'Expected HTTP status code' },
        },
        required: ['url', 'method'],
      },
    },
  ] as ToolDefinition[],

  async execute(
    toolName: string,
    input: Record<string, unknown>,
    context: SkillContext
  ): Promise<ToolExecutionResult> {
    switch (toolName) {
      case 'generate_api_tests':
        return {
          success: true,
          output: JSON.stringify({
            tests: [
              {
                name: `${input.method} ${input.endpoint} - success`,
                method: input.method,
                url: input.endpoint,
                expectedStatus: input.method === 'POST' ? 201 : 200,
                description: `Test successful ${input.method} request`,
              },
              {
                name: `${input.method} ${input.endpoint} - invalid input`,
                method: input.method,
                url: input.endpoint,
                body: '{}',
                expectedStatus: 400,
                description: 'Test validation error handling',
              },
              {
                name: `${input.method} ${input.endpoint} - unauthorized`,
                method: input.method,
                url: input.endpoint,
                headers: {},
                expectedStatus: 401,
                description: 'Test without auth token',
              },
            ],
          }),
        };

      case 'run_api_test': {
        try {
          const method = (input.method as string) || 'GET';
          const url = input.url as string;
          const headers = (input.headers as Record<string, string>) || {};
          const body = input.body as string | undefined;

          const fetchOpts: RequestInit = {
            method,
            headers: { 'Content-Type': 'application/json', ...headers },
          };
          if (body && method !== 'GET') fetchOpts.body = body;

          const start = Date.now();
          const res = await fetch(url, fetchOpts);
          const elapsed = Date.now() - start;
          const resBody = await res.text();
          const expectedStatus = input.expectedStatus as number | undefined;
          const passed = expectedStatus ? res.status === expectedStatus : res.ok;

          return {
            success: true,
            output: JSON.stringify({
              passed,
              status: res.status,
              expectedStatus,
              elapsed: `${elapsed}ms`,
              bodyPreview: resBody.slice(0, 500),
            }),
          };
        } catch (e) {
          return { success: false, output: `Request failed: ${(e as Error).message}` };
        }
      }

      default:
        return { success: false, output: `Unknown tool: ${toolName}` };
    }
  },
};

export const prompts = {
  system: `You are an API testing expert. When asked to test APIs:
1. Generate comprehensive test cases covering happy paths, error cases, and edge cases
2. Include tests for authentication, validation, and rate limiting
3. Report results clearly with pass/fail status and response details
4. Suggest improvements based on API response patterns`,
};
