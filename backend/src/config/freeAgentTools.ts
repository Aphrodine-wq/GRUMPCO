/**
 * @deprecated This file is deprecated. Use gAgentTools.ts instead.
 * This file re-exports from gAgentTools for backward compatibility.
 */

export {
  CAPABILITY_DESCRIPTIONS,
  getToolsForCapability,
  getAllowedToolNames,
  isCapabilityAvailable,
  getAvailableCapabilities,
  CAPABILITY_PRESETS,
} from './gAgentTools.js';

// Re-export the type for backward compatibility
export type { GAgentCapabilityKey as FreeAgentCapabilityKey } from '../types/settings.js';
