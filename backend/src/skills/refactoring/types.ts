/**
 * Refactoring Skill - Type Definitions
 */

export type RefactoringType =
  | 'extract-function'
  | 'extract-variable'
  | 'extract-class'
  | 'rename'
  | 'inline'
  | 'move'
  | 'simplify'
  | 'apply-pattern';

export interface RefactoringRequest {
  code: string;
  language?: string;
  type: RefactoringType;
  options?: RefactoringOptions;
}

export interface RefactoringOptions {
  // Extract function
  startLine?: number;
  endLine?: number;
  functionName?: string;

  // Extract variable
  expression?: string;
  variableName?: string;

  // Rename
  oldName?: string;
  newName?: string;
  symbolType?: 'variable' | 'function' | 'class' | 'interface' | 'type';

  // Inline
  targetName?: string;

  // Pattern
  pattern?: DesignPattern;
}

export type DesignPattern =
  | 'strategy'
  | 'factory'
  | 'decorator'
  | 'observer'
  | 'builder'
  | 'singleton'
  | 'adapter'
  | 'facade';

export interface RefactoringResult {
  success: boolean;
  original: string;
  refactored: string;
  changes: CodeChange[];
  explanation: string;
  warnings?: string[];
}

export interface CodeChange {
  type: 'insert' | 'delete' | 'replace';
  startLine: number;
  endLine?: number;
  oldText?: string;
  newText: string;
  description: string;
}

export interface RefactoringSuggestion {
  type: RefactoringType;
  location: {
    startLine: number;
    endLine: number;
  };
  description: string;
  impact: 'high' | 'medium' | 'low';
  preview?: {
    before: string;
    after: string;
  };
}

export interface ExtractFunctionResult {
  extractedFunction: string;
  callSite: string;
  parameters: Array<{
    name: string;
    type?: string;
  }>;
  returnType?: string;
}

export interface RenameResult {
  occurrences: number;
  files: Array<{
    path: string;
    changes: Array<{
      line: number;
      before: string;
      after: string;
    }>;
  }>;
}
