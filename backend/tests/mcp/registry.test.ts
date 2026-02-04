/**
 * MCP Registry Unit Tests
 * Tests tool registration, retrieval, and clearing functionality.
 * Run: npm test -- tests/mcp/registry.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { registerMcpTools, clearMcpTools, getMcpTools, type McpTool } from '../../src/mcp/registry.js';

describe('MCP Registry', () => {
  beforeEach(() => {
    // Clear any tools before each test to ensure a clean state
    clearMcpTools();
  });

  afterEach(() => {
    // Cleanup after each test
    clearMcpTools();
    vi.clearAllMocks();
  });

  describe('registerMcpTools', () => {
    it('should register a single tool', () => {
      const tool: McpTool = {
        name: 'test_tool',
        description: 'A test tool',
        input_schema: {
          type: 'object',
          properties: { arg1: { type: 'string' } },
          required: ['arg1'],
        },
      };

      registerMcpTools([tool]);
      const tools = getMcpTools();

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('test_tool');
      expect(tools[0].description).toBe('A test tool');
    });

    it('should register multiple tools at once', () => {
      const tools: McpTool[] = [
        {
          name: 'tool_a',
          description: 'Tool A',
          input_schema: { type: 'object', properties: {}, required: [] },
        },
        {
          name: 'tool_b',
          description: 'Tool B',
          input_schema: { type: 'object', properties: {}, required: [] },
        },
        {
          name: 'tool_c',
          description: 'Tool C',
          input_schema: { type: 'object', properties: {}, required: [] },
        },
      ];

      registerMcpTools(tools);
      const registered = getMcpTools();

      expect(registered).toHaveLength(3);
      expect(registered.map(t => t.name)).toEqual(['tool_a', 'tool_b', 'tool_c']);
    });

    it('should accumulate tools across multiple register calls', () => {
      const tool1: McpTool = {
        name: 'first_tool',
        description: 'First',
        input_schema: { type: 'object' },
      };
      const tool2: McpTool = {
        name: 'second_tool',
        description: 'Second',
        input_schema: { type: 'object' },
      };

      registerMcpTools([tool1]);
      registerMcpTools([tool2]);
      const tools = getMcpTools();

      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe('first_tool');
      expect(tools[1].name).toBe('second_tool');
    });

    it('should register tools with empty properties', () => {
      const tool: McpTool = {
        name: 'empty_props_tool',
        description: 'Tool with no properties',
        input_schema: {
          type: 'object',
          properties: {},
          required: [],
        },
      };

      registerMcpTools([tool]);
      const tools = getMcpTools();

      expect(tools).toHaveLength(1);
      expect(tools[0].input_schema.properties).toEqual({});
      expect(tools[0].input_schema.required).toEqual([]);
    });

    it('should register tools with complex input schemas', () => {
      const tool: McpTool = {
        name: 'complex_tool',
        description: 'Tool with complex schema',
        input_schema: {
          type: 'object',
          properties: {
            stringArg: { type: 'string', description: 'A string argument' },
            numberArg: { type: 'number', minimum: 0 },
            arrayArg: { type: 'array', items: { type: 'string' } },
            objectArg: { type: 'object', properties: { nested: { type: 'boolean' } } },
          },
          required: ['stringArg'],
        },
      };

      registerMcpTools([tool]);
      const tools = getMcpTools();

      expect(tools).toHaveLength(1);
      expect(tools[0].input_schema.properties).toHaveProperty('stringArg');
      expect(tools[0].input_schema.properties).toHaveProperty('numberArg');
      expect(tools[0].input_schema.properties).toHaveProperty('arrayArg');
      expect(tools[0].input_schema.properties).toHaveProperty('objectArg');
      expect(tools[0].input_schema.required).toEqual(['stringArg']);
    });

    it('should handle registering an empty array', () => {
      registerMcpTools([]);
      const tools = getMcpTools();

      expect(tools).toHaveLength(0);
    });

    it('should allow duplicate tool names (no deduplication)', () => {
      const tool: McpTool = {
        name: 'duplicate_tool',
        description: 'First instance',
        input_schema: { type: 'object' },
      };

      registerMcpTools([tool]);
      registerMcpTools([{ ...tool, description: 'Second instance' }]);
      const tools = getMcpTools();

      expect(tools).toHaveLength(2);
      expect(tools[0].description).toBe('First instance');
      expect(tools[1].description).toBe('Second instance');
    });
  });

  describe('clearMcpTools', () => {
    it('should clear all registered tools', () => {
      const tools: McpTool[] = [
        { name: 'tool1', description: 'T1', input_schema: { type: 'object' } },
        { name: 'tool2', description: 'T2', input_schema: { type: 'object' } },
      ];

      registerMcpTools(tools);
      expect(getMcpTools()).toHaveLength(2);

      clearMcpTools();
      expect(getMcpTools()).toHaveLength(0);
    });

    it('should be safe to call when no tools are registered', () => {
      clearMcpTools();
      expect(getMcpTools()).toHaveLength(0);

      clearMcpTools();
      expect(getMcpTools()).toHaveLength(0);
    });

    it('should allow registering tools after clearing', () => {
      const tool1: McpTool = { name: 'before', description: 'Before clear', input_schema: { type: 'object' } };
      const tool2: McpTool = { name: 'after', description: 'After clear', input_schema: { type: 'object' } };

      registerMcpTools([tool1]);
      clearMcpTools();
      registerMcpTools([tool2]);

      const tools = getMcpTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('after');
    });
  });

  describe('getMcpTools', () => {
    it('should return an empty array when no tools are registered', () => {
      const tools = getMcpTools();
      expect(tools).toEqual([]);
    });

    it('should return a copy of the tools array (not the original)', () => {
      const tool: McpTool = { name: 'test', description: 'Test', input_schema: { type: 'object' } };
      registerMcpTools([tool]);

      const tools1 = getMcpTools();
      const tools2 = getMcpTools();

      expect(tools1).not.toBe(tools2);
      expect(tools1).toEqual(tools2);
    });

    it('should preserve tool properties exactly', () => {
      const tool: McpTool = {
        name: 'exact_tool',
        description: 'An exact description with special chars: @#$%^&*()',
        input_schema: {
          type: 'object',
          properties: {
            param1: { type: 'string', enum: ['a', 'b', 'c'] },
          },
          required: ['param1'],
        },
      };

      registerMcpTools([tool]);
      const retrieved = getMcpTools()[0];

      expect(retrieved.name).toBe(tool.name);
      expect(retrieved.description).toBe(tool.description);
      expect(retrieved.input_schema).toEqual(tool.input_schema);
    });

    it('should return tools in registration order', () => {
      const toolNames = ['first', 'second', 'third', 'fourth', 'fifth'];
      const tools: McpTool[] = toolNames.map(name => ({
        name,
        description: `Tool ${name}`,
        input_schema: { type: 'object' },
      }));

      registerMcpTools(tools);
      const retrieved = getMcpTools();

      expect(retrieved.map(t => t.name)).toEqual(toolNames);
    });
  });

  describe('McpTool interface', () => {
    it('should accept minimal tool definition', () => {
      const minimal: McpTool = {
        name: 'minimal',
        description: '',
        input_schema: { type: 'object' },
      };

      registerMcpTools([minimal]);
      const tools = getMcpTools();

      expect(tools).toHaveLength(1);
      expect(tools[0].description).toBe('');
    });

    it('should accept tools with optional properties omitted', () => {
      const tool: McpTool = {
        name: 'optional_props',
        description: 'Has optional props',
        input_schema: {
          type: 'object',
          // properties and required are optional
        },
      };

      registerMcpTools([tool]);
      const tools = getMcpTools();

      expect(tools).toHaveLength(1);
      expect(tools[0].input_schema.properties).toBeUndefined();
      expect(tools[0].input_schema.required).toBeUndefined();
    });
  });

  describe('isolation and immutability', () => {
    it('should not allow external modification of internal tools array via getMcpTools', () => {
      const tool: McpTool = {
        name: 'immutable_test',
        description: 'Test immutability',
        input_schema: { type: 'object' },
      };

      registerMcpTools([tool]);
      const retrievedTools = getMcpTools();

      // Attempt to modify the returned array
      retrievedTools.push({
        name: 'injected_tool',
        description: 'This should not be in registry',
        input_schema: { type: 'object' },
      });

      // Original registry should be unchanged
      expect(getMcpTools()).toHaveLength(1);
      expect(getMcpTools()[0].name).toBe('immutable_test');
    });

    it('should not allow removal of tools via getMcpTools array manipulation', () => {
      const tools: McpTool[] = [
        { name: 'tool1', description: 'T1', input_schema: { type: 'object' } },
        { name: 'tool2', description: 'T2', input_schema: { type: 'object' } },
      ];

      registerMcpTools(tools);
      const retrievedTools = getMcpTools();

      // Attempt to remove a tool from returned array
      retrievedTools.pop();

      // Original registry should be unchanged
      expect(getMcpTools()).toHaveLength(2);
    });

    it('should maintain separate instances across multiple getMcpTools calls', () => {
      const tool: McpTool = {
        name: 'separate_instances',
        description: 'Test separate instances',
        input_schema: { type: 'object' },
      };

      registerMcpTools([tool]);

      const first = getMcpTools();
      const second = getMcpTools();
      const third = getMcpTools();

      // All should be equal but different objects
      expect(first).toEqual(second);
      expect(second).toEqual(third);
      expect(first).not.toBe(second);
      expect(second).not.toBe(third);
    });
  });

  describe('edge cases and boundary conditions', () => {
    it('should handle tools with very long names', () => {
      const longName = 'a'.repeat(1000);
      const tool: McpTool = {
        name: longName,
        description: 'Tool with very long name',
        input_schema: { type: 'object' },
      };

      registerMcpTools([tool]);
      const tools = getMcpTools();

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe(longName);
      expect(tools[0].name.length).toBe(1000);
    });

    it('should handle tools with very long descriptions', () => {
      const longDescription = 'b'.repeat(10000);
      const tool: McpTool = {
        name: 'long_desc_tool',
        description: longDescription,
        input_schema: { type: 'object' },
      };

      registerMcpTools([tool]);
      const tools = getMcpTools();

      expect(tools).toHaveLength(1);
      expect(tools[0].description).toBe(longDescription);
    });

    it('should handle tools with special characters in name', () => {
      const specialNames = ['tool-with-dashes', 'tool_with_underscores', 'tool.with.dots', 'tool:with:colons'];
      const tools: McpTool[] = specialNames.map(name => ({
        name,
        description: `Tool: ${name}`,
        input_schema: { type: 'object' },
      }));

      registerMcpTools(tools);
      const retrieved = getMcpTools();

      expect(retrieved).toHaveLength(4);
      expect(retrieved.map(t => t.name)).toEqual(specialNames);
    });

    it('should handle tools with unicode characters', () => {
      const tool: McpTool = {
        name: 'unicode_tool',
        description: 'Description with unicode: ',
        input_schema: { type: 'object' },
      };

      registerMcpTools([tool]);
      const tools = getMcpTools();

      expect(tools).toHaveLength(1);
      expect(tools[0].description).toContain('');
    });

    it('should handle tools with deeply nested input schemas', () => {
      const tool: McpTool = {
        name: 'deeply_nested',
        description: 'Tool with deeply nested schema',
        input_schema: {
          type: 'object',
          properties: {
            level1: {
              type: 'object',
              properties: {
                level2: {
                  type: 'object',
                  properties: {
                    level3: {
                      type: 'object',
                      properties: {
                        level4: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };

      registerMcpTools([tool]);
      const tools = getMcpTools();

      expect(tools).toHaveLength(1);
      const level1 = tools[0].input_schema.properties?.level1 as Record<string, unknown>;
      expect(level1).toBeDefined();
    });

    it('should handle registering a large number of tools', () => {
      const toolCount = 1000;
      const tools: McpTool[] = Array.from({ length: toolCount }, (_, i) => ({
        name: `tool_${i}`,
        description: `Tool number ${i}`,
        input_schema: { type: 'object' },
      }));

      registerMcpTools(tools);
      const retrieved = getMcpTools();

      expect(retrieved).toHaveLength(toolCount);
      expect(retrieved[0].name).toBe('tool_0');
      expect(retrieved[toolCount - 1].name).toBe(`tool_${toolCount - 1}`);
    });

    it('should handle tools with null-like values in schema properties', () => {
      const tool: McpTool = {
        name: 'null_props_tool',
        description: 'Tool with null-like properties',
        input_schema: {
          type: 'object',
          properties: {
            emptyString: { type: 'string', default: '' },
            zeroValue: { type: 'number', default: 0 },
            falseValue: { type: 'boolean', default: false },
          },
          required: [],
        },
      };

      registerMcpTools([tool]);
      const tools = getMcpTools();

      expect(tools).toHaveLength(1);
      const props = tools[0].input_schema.properties as Record<string, Record<string, unknown>>;
      expect(props.emptyString.default).toBe('');
      expect(props.zeroValue.default).toBe(0);
      expect(props.falseValue.default).toBe(false);
    });

    it('should handle tools with array-type required fields', () => {
      const tool: McpTool = {
        name: 'array_required',
        description: 'Tool with array required',
        input_schema: {
          type: 'object',
          properties: {
            a: { type: 'string' },
            b: { type: 'string' },
            c: { type: 'string' },
          },
          required: ['a', 'b', 'c'],
        },
      };

      registerMcpTools([tool]);
      const tools = getMcpTools();

      expect(tools[0].input_schema.required).toEqual(['a', 'b', 'c']);
      expect(tools[0].input_schema.required).toHaveLength(3);
    });
  });

  describe('concurrent operations', () => {
    it('should handle multiple sequential register and clear cycles', () => {
      for (let i = 0; i < 10; i++) {
        const tool: McpTool = {
          name: `cycle_tool_${i}`,
          description: `Cycle ${i}`,
          input_schema: { type: 'object' },
        };

        registerMcpTools([tool]);
        expect(getMcpTools()).toHaveLength(1);
        expect(getMcpTools()[0].name).toBe(`cycle_tool_${i}`);

        clearMcpTools();
        expect(getMcpTools()).toHaveLength(0);
      }
    });

    it('should accumulate tools correctly across many register calls', () => {
      const iterations = 50;

      for (let i = 0; i < iterations; i++) {
        const tool: McpTool = {
          name: `accumulated_tool_${i}`,
          description: `Accumulated ${i}`,
          input_schema: { type: 'object' },
        };
        registerMcpTools([tool]);
      }

      const tools = getMcpTools();
      expect(tools).toHaveLength(iterations);

      // Verify all tools are present and in order
      for (let i = 0; i < iterations; i++) {
        expect(tools[i].name).toBe(`accumulated_tool_${i}`);
      }
    });
  });

  describe('tool schema variations', () => {
    it('should handle tools with enum properties', () => {
      const tool: McpTool = {
        name: 'enum_tool',
        description: 'Tool with enum',
        input_schema: {
          type: 'object',
          properties: {
            mode: { type: 'string', enum: ['fast', 'slow', 'normal'] },
          },
        },
      };

      registerMcpTools([tool]);
      const tools = getMcpTools();

      expect(tools).toHaveLength(1);
      const modeSchema = tools[0].input_schema.properties?.mode as Record<string, unknown>;
      expect(modeSchema.enum).toEqual(['fast', 'slow', 'normal']);
    });

    it('should handle tools with oneOf/anyOf schemas', () => {
      const tool: McpTool = {
        name: 'union_tool',
        description: 'Tool with union type',
        input_schema: {
          type: 'object',
          properties: {
            value: {
              oneOf: [
                { type: 'string' },
                { type: 'number' },
              ],
            },
          },
        },
      };

      registerMcpTools([tool]);
      const tools = getMcpTools();

      expect(tools).toHaveLength(1);
      const valueSchema = tools[0].input_schema.properties?.value as Record<string, unknown>;
      expect(valueSchema.oneOf).toBeDefined();
    });

    it('should handle tools with array items schema', () => {
      const tool: McpTool = {
        name: 'array_items_tool',
        description: 'Tool with array items',
        input_schema: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: { type: 'string', minLength: 1 },
              minItems: 1,
              maxItems: 10,
            },
          },
        },
      };

      registerMcpTools([tool]);
      const tools = getMcpTools();

      expect(tools).toHaveLength(1);
      const itemsSchema = tools[0].input_schema.properties?.items as Record<string, unknown>;
      expect(itemsSchema.type).toBe('array');
      expect(itemsSchema.minItems).toBe(1);
      expect(itemsSchema.maxItems).toBe(10);
    });

    it('should handle tools with pattern validation', () => {
      const tool: McpTool = {
        name: 'pattern_tool',
        description: 'Tool with pattern validation',
        input_schema: {
          type: 'object',
          properties: {
            email: { type: 'string', pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$' },
            id: { type: 'string', format: 'uuid' },
          },
        },
      };

      registerMcpTools([tool]);
      const tools = getMcpTools();

      expect(tools).toHaveLength(1);
      const emailSchema = tools[0].input_schema.properties?.email as Record<string, unknown>;
      expect(emailSchema.pattern).toBeDefined();
    });

    it('should handle tools with additionalProperties setting', () => {
      const tool: McpTool = {
        name: 'additional_props_tool',
        description: 'Tool with additionalProperties',
        input_schema: {
          type: 'object',
          properties: {
            known: { type: 'string' },
          },
          additionalProperties: false,
        } as McpTool['input_schema'] & { additionalProperties: boolean },
      };

      registerMcpTools([tool]);
      const tools = getMcpTools();

      expect(tools).toHaveLength(1);
      const schema = tools[0].input_schema as Record<string, unknown>;
      expect(schema.additionalProperties).toBe(false);
    });

    it('should handle tools with default values', () => {
      const tool: McpTool = {
        name: 'defaults_tool',
        description: 'Tool with defaults',
        input_schema: {
          type: 'object',
          properties: {
            timeout: { type: 'number', default: 30000 },
            retries: { type: 'integer', default: 3 },
            enabled: { type: 'boolean', default: true },
          },
        },
      };

      registerMcpTools([tool]);
      const tools = getMcpTools();

      expect(tools).toHaveLength(1);
      const props = tools[0].input_schema.properties as Record<string, Record<string, unknown>>;
      expect(props.timeout.default).toBe(30000);
      expect(props.retries.default).toBe(3);
      expect(props.enabled.default).toBe(true);
    });
  });

  describe('error resilience', () => {
    it('should maintain state after failed getMcpTools mutation attempts', () => {
      const tool: McpTool = {
        name: 'resilient_tool',
        description: 'Test resilience',
        input_schema: { type: 'object' },
      };

      registerMcpTools([tool]);

      // Get tools and try various mutations
      const tools = getMcpTools();
      tools.length = 0;
      tools.push({ name: 'hacked', description: 'Hacked', input_schema: { type: 'object' } });

      // Registry should still be intact
      const freshTools = getMcpTools();
      expect(freshTools).toHaveLength(1);
      expect(freshTools[0].name).toBe('resilient_tool');
    });

    it('should handle repeated clear calls without issues', () => {
      registerMcpTools([{ name: 'test', description: 'Test', input_schema: { type: 'object' } }]);

      // Clear multiple times
      clearMcpTools();
      clearMcpTools();
      clearMcpTools();

      expect(getMcpTools()).toHaveLength(0);

      // Should still work after multiple clears
      registerMcpTools([{ name: 'after', description: 'After', input_schema: { type: 'object' } }]);
      expect(getMcpTools()).toHaveLength(1);
    });
  });
});
