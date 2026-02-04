/**
 * Frontend Designer Skill - Type Definitions
 */

export type DesignType =
  | 'component'
  | 'page'
  | 'layout'
  | 'section'
  | 'form'
  | 'modal'
  | 'card'
  | 'dashboard'
  | 'navigation';

export type DesignTier = 'minimal' | 'polished' | 'premium';

export interface DesignRequest {
  description: string;
  designType?: DesignType;
  tier?: DesignTier;
  responsive?: boolean;
  animated?: boolean;
  existingFile?: string;
  context?: string;
}

export interface DesignResult {
  componentName: string;
  code: string;
  designType: DesignType;
  tier: DesignTier;
  features: string[];
  tokensUsed: string[];
  accessibilityNotes: string[];
}

export interface DesignReviewIssue {
  severity: 'critical' | 'warning' | 'suggestion';
  category: 'tokens' | 'accessibility' | 'responsive' | 'animation' | 'theme' | 'structure';
  message: string;
  line?: number;
  fix?: string;
}

export interface DesignReviewResult {
  summary: string;
  score: number;
  issues: DesignReviewIssue[];
  strengths: string[];
  tokenCoverage: number;
  themeCompliance: boolean;
  accessibilityScore: number;
}
