/**
 * Code Review Skill - Type Definitions
 */

export type ReviewType = "quick" | "deep" | "security" | "performance";

export interface ReviewRequest {
  code: string;
  language?: string;
  reviewType?: ReviewType;
  context?: string;
  filePath?: string;
}

export interface ReviewIssue {
  severity: "critical" | "warning" | "suggestion" | "info";
  category: "quality" | "security" | "performance" | "logic" | "style";
  line?: number;
  endLine?: number;
  message: string;
  suggestion?: string;
  code?: string;
}

export interface ReviewResult {
  summary: string;
  issues: ReviewIssue[];
  positives: string[];
  overallScore?: number;
  metrics?: ReviewMetrics;
}

export interface ReviewMetrics {
  linesOfCode: number;
  complexity?: number;
  maintainability?: number;
  issueCount: {
    critical: number;
    warning: number;
    suggestion: number;
    info: number;
  };
}

export interface FileAnalysis {
  filePath: string;
  language: string;
  content: string;
  review: ReviewResult;
}

export interface ImprovementSuggestion {
  title: string;
  description: string;
  before: string;
  after: string;
  impact: "high" | "medium" | "low";
  category: string;
}
