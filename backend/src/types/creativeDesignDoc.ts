/**
 * Creative Design Document (CDD) Types
 * First-class artifact for layout, UI/UX principles, key screens, and UX flows
 */

export interface LayoutRegion {
  id: string;
  name: string;
  description: string;
  placement: 'header' | 'sidebar' | 'main' | 'footer' | 'modal' | 'drawer' | 'floating';
  breakpoints?: { minWidth?: number; maxWidth?: number; label: string }[];
}

export interface LayoutSpec {
  regions: LayoutRegion[];
  breakpoints: { label: string; minWidth: number; maxWidth?: number }[];
  gridDescription: string;
}

export interface UIPrinciples {
  visualHierarchy: string[];
  spacing: string[];
  typography: string[];
  keyInteractions: string[];
}

export interface KeyScreen {
  id: string;
  name: string;
  purpose: string;
  mainElements: string[];
}

export interface UXFlow {
  id: string;
  name: string;
  steps: string[];
}

export interface CreativeDesignDoc {
  id: string;
  layout: LayoutSpec;
  uiPrinciples: UIPrinciples;
  keyScreens: KeyScreen[];
  uxFlows: UXFlow[];
  accessibilityNotes: string[];
  responsivenessNotes: string[];
  metadata: {
    createdAt: string;
    projectName?: string;
  };
}

export interface PRDOverviewForCDD {
  vision?: string;
  problem?: string;
  solution?: string;
  targetMarket?: string;
}
