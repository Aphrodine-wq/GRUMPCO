/**
 * SHIP Mode Types (Frontend)
 * Re-exports from shared-types with frontend-specific additions
 */

// Re-export all SHIP types from shared package
export type {
  ShipPhase,
  ShipRunnablePhase,
  ShipSession,
  ShipPreferences,
  DesignPhaseResult,
  SpecPhaseResult,
  PlanPhaseResult,
  CodePhaseResult,
  ShipStartRequest,
  ShipPhaseResponse,
  ShipStreamEvent,
} from '@grump/shared-types';

// Import types needed for CreativeDesignDocSummary
import type { CreativeDesignDoc } from '@grump/shared-types';

/** Minimal Creative Design Document shape for UI display (subset of full CreativeDesignDoc) */
export interface CreativeDesignDocSummary {
  layout?: { gridDescription?: string; regions?: Array<{ name: string; description: string }> };
  uiPrinciples?: { visualHierarchy?: string[]; keyInteractions?: string[] };
  keyScreens?: Array<{ name: string; purpose: string }>;
  uxFlows?: Array<{ name: string; steps?: string[] }>;
  accessibilityNotes?: string[];
  responsivenessNotes?: string[];
}

/** Helper to convert full CreativeDesignDoc to summary for UI display */
export function toCreativeDesignDocSummary(doc: CreativeDesignDoc): CreativeDesignDocSummary {
  return {
    layout: {
      gridDescription: doc.layout.gridDescription,
      regions: doc.layout.regions.map((r) => ({ name: r.name, description: r.description })),
    },
    uiPrinciples: {
      visualHierarchy: doc.uiPrinciples.visualHierarchy,
      keyInteractions: doc.uiPrinciples.keyInteractions,
    },
    keyScreens: doc.keyScreens.map((s) => ({ name: s.name, purpose: s.purpose })),
    uxFlows: doc.uxFlows.map((f) => ({ name: f.name, steps: f.steps })),
    accessibilityNotes: doc.accessibilityNotes,
    responsivenessNotes: doc.responsivenessNotes,
  };
}
