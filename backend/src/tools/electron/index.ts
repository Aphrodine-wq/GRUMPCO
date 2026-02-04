/**
 * Electron-specific tool definitions
 */

import type { Tool } from '../types.js';

// ============================================================================
// CAMERA TOOL
// ============================================================================

export const cameraCaptureTool: Tool = {
  name: 'camera_capture',
  description: 'Capture image from device camera.',
  input_schema: { type: 'object', properties: {} },
};

// ============================================================================
// SCREEN RECORD TOOL
// ============================================================================

export const screenRecordTool: Tool = {
  name: 'screen_record',
  description: 'Start or stop screen recording.',
  input_schema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['start', 'stop'] },
    },
    required: ['action'],
  },
};

// ============================================================================
// LOCATION TOOL
// ============================================================================

export const locationGetTool: Tool = {
  name: 'location_get',
  description: 'Get device location.',
  input_schema: { type: 'object', properties: {} },
};

// ============================================================================
// SYSTEM EXEC TOOL
// ============================================================================

export const systemExecTool: Tool = {
  name: 'system_exec',
  description: 'Execute system command on host.',
  input_schema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Command to execute' },
    },
    required: ['command'],
  },
};

// ============================================================================
// CANVAS UPDATE TOOL
// ============================================================================

export const canvasUpdateTool: Tool = {
  name: 'canvas_update',
  description: 'Update elements on Live Canvas.',
  input_schema: {
    type: 'object',
    properties: {
      sessionId: { type: 'string', description: 'Canvas session ID' },
      action: { type: 'string', enum: ['create', 'update', 'delete'] },
      elementId: { type: 'string', description: 'Element ID' },
      element: { type: 'object', description: 'Element data' },
    },
    required: ['sessionId', 'action'],
  },
};

// ============================================================================
// EXPORT ALL ELECTRON TOOLS
// ============================================================================

export const ELECTRON_TOOLS: Tool[] = [
  cameraCaptureTool,
  screenRecordTool,
  locationGetTool,
  systemExecTool,
  canvasUpdateTool,
];
