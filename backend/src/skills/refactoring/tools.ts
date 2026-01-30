/**
 * Refactoring Skill - Tool Definitions
 */

import type { ToolDefinition } from '../types.js';

export const extractFunctionTool: ToolDefinition = {
  name: 'extract_function',
  description: 'Extract a portion of code into a new function',
  input_schema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The code containing the section to extract',
      },
      startLine: {
        type: 'number',
        description: 'Start line of the code to extract',
      },
      endLine: {
        type: 'number',
        description: 'End line of the code to extract',
      },
      functionName: {
        type: 'string',
        description: 'Name for the new function',
      },
      language: {
        type: 'string',
        description: 'Programming language',
      },
    },
    required: ['code', 'startLine', 'endLine', 'functionName'],
  },
};

export const extractVariableTool: ToolDefinition = {
  name: 'extract_variable',
  description: 'Extract an expression into a named variable',
  input_schema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The code containing the expression',
      },
      expression: {
        type: 'string',
        description: 'The expression to extract',
      },
      variableName: {
        type: 'string',
        description: 'Name for the new variable',
      },
      language: {
        type: 'string',
        description: 'Programming language',
      },
    },
    required: ['code', 'expression', 'variableName'],
  },
};

export const renameSymbolTool: ToolDefinition = {
  name: 'rename_symbol',
  description: 'Rename a variable, function, or class throughout the code',
  input_schema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The code containing the symbol',
      },
      oldName: {
        type: 'string',
        description: 'Current name of the symbol',
      },
      newName: {
        type: 'string',
        description: 'New name for the symbol',
      },
      symbolType: {
        type: 'string',
        enum: ['variable', 'function', 'class', 'interface', 'type'],
        description: 'Type of symbol being renamed',
      },
    },
    required: ['code', 'oldName', 'newName'],
  },
};

export const simplifyCodeTool: ToolDefinition = {
  name: 'simplify_code',
  description: 'Simplify code by reducing complexity and improving readability',
  input_schema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The code to simplify',
      },
      language: {
        type: 'string',
        description: 'Programming language',
      },
      focus: {
        type: 'string',
        enum: ['conditionals', 'loops', 'duplication', 'naming', 'all'],
        description: 'Area to focus simplification on',
        default: 'all',
      },
    },
    required: ['code'],
  },
};

export const inlineFunctionTool: ToolDefinition = {
  name: 'inline_function',
  description: 'Inline a function call by replacing it with the function body',
  input_schema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The code containing the function to inline',
      },
      functionName: {
        type: 'string',
        description: 'Name of the function to inline',
      },
    },
    required: ['code', 'functionName'],
  },
};

export const applyPatternTool: ToolDefinition = {
  name: 'apply_pattern',
  description: 'Apply a design pattern to restructure code',
  input_schema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The code to refactor',
      },
      pattern: {
        type: 'string',
        enum: ['strategy', 'factory', 'decorator', 'observer', 'builder', 'singleton'],
        description: 'Design pattern to apply',
      },
      language: {
        type: 'string',
        description: 'Programming language',
      },
    },
    required: ['code', 'pattern'],
  },
};

export const suggestRefactoringsTool: ToolDefinition = {
  name: 'suggest_refactorings',
  description: 'Analyze code and suggest potential refactorings',
  input_schema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The code to analyze',
      },
      language: {
        type: 'string',
        description: 'Programming language',
      },
    },
    required: ['code'],
  },
};

export const definitions: ToolDefinition[] = [
  extractFunctionTool,
  extractVariableTool,
  renameSymbolTool,
  simplifyCodeTool,
  inlineFunctionTool,
  applyPatternTool,
  suggestRefactoringsTool,
];
