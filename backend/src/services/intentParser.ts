// Intent Parser Service
// Pre-processes user input to detect diagram type, C4 level, and constraints

import type { C4Level } from '../prompts/shared/c4-examples.js';

export type DiagramType = 
  | 'flowchart' | 'sequence' | 'class' | 'er' | 'state' | 'gantt'
  | 'c4-context' | 'c4-container' | 'c4-component' | 'mindmap' | 'pie' | 'journey';

export interface Constraints {
  complexity?: 'simple' | 'detailed';
  focusAreas?: string[];
  excludeAreas?: string[];
  style?: 'technical' | 'business';
}

export interface IntentAnalysis {
  isValid: boolean;
  confidence: number; // 0.0 to 1.0
  suggestedType: DiagramType | null;
  c4Level?: C4Level;
  constraints: Constraints;
  requiresClarification: boolean;
  clarificationContext?: string;
}

// Keyword patterns for diagram type detection
const DIAGRAM_PATTERNS: Record<DiagramType, RegExp[]> = {
  'flowchart': [
    /\b(flow|process|workflow|steps?|procedure|algorithm|decision\s*tree)\b/i,
    /\b(if|then|else|branch|path|route)\b/i,
  ],
  'sequence': [
    /\b(sequence|interaction|call|request|response|message|communicate)\b/i,
    /\b(api\s*call|http|rest|endpoint|service\s*call)\b/i,
    /\b(actor|user\s*journey|step\s*by\s*step)\b/i,
  ],
  'class': [
    /\b(class|interface|inheritance|extends|implements|object|oop)\b/i,
    /\b(method|property|attribute|member|encapsulation)\b/i,
    /\b(uml|class\s*diagram)\b/i,
  ],
  'er': [
    /\b(entity|relationship|database|schema|table|foreign\s*key)\b/i,
    /\b(erd?|data\s*model|one\s*to\s*many|many\s*to\s*many)\b/i,
    /\b(primary\s*key|column|record)\b/i,
  ],
  'state': [
    /\b(state|transition|status|lifecycle|finite\s*state)\b/i,
    /\b(machine|fsm|current\s*state|next\s*state)\b/i,
  ],
  'gantt': [
    /\b(gantt|timeline|schedule|project\s*plan|milestone)\b/i,
    /\b(duration|deadline|task|phase|sprint)\b/i,
  ],
  'c4-context': [
    /\b(system\s*context|high\s*level|external\s*system|actor)\b/i,
    /\b(c4\s*context|big\s*picture|overview)\b/i,
  ],
  'c4-container': [
    /\b(container|microservice|service|application|api\s*server)\b/i,
    /\b(c4\s*container|internal\s*service|deployment)\b/i,
    /\b(docker|kubernetes|backend|frontend)\b/i,
  ],
  'c4-component': [
    /\b(component|module|controller|service\s*layer|repository)\b/i,
    /\b(c4\s*component|internal\s*structure)\b/i,
  ],
  'mindmap': [
    /\b(mindmap|mind\s*map|brainstorm|ideas?|hierarchy)\b/i,
    /\b(concept|topic|branch\s*out)\b/i,
  ],
  'pie': [
    /\b(pie|percentage|proportion|distribution|breakdown)\b/i,
    /\b(share|ratio|part\s*of)\b/i,
  ],
  'journey': [
    /\b(user\s*journey|customer\s*journey|experience|touchpoint)\b/i,
    /\b(satisfaction|emotion|feeling)\b/i,
  ],
};

// C4 level detection patterns
const C4_LEVEL_PATTERNS: Record<C4Level, RegExp[]> = {
  'context': [
    /\b(system\s*context|high\s*level|bird'?s?\s*eye|overview|external)\b/i,
    /\b(actors?|users?\s*and\s*systems?|landscape)\b/i,
  ],
  'container': [
    /\b(container|services?|applications?|microservices?)\b/i,
    /\b(deployment|infrastructure|backend|frontend|api)\b/i,
    /\b(databases?|message\s*queue|cache)\b/i,
  ],
  'component': [
    /\b(components?|modules?|internal|controllers?|handlers?)\b/i,
    /\b(layers?|repository|service\s*layer)\b/i,
  ],
  'code': [
    /\b(code|class|implementation|method|function)\b/i,
    /\b(detail|specific|exact)\b/i,
  ],
};

// Architecture keywords that suggest C4-style diagrams
const ARCHITECTURE_KEYWORDS = /\b(architecture|system\s*design|infrastructure|tech\s*stack|deployment)\b/i;

// Constraint detection patterns
const COMPLEXITY_PATTERNS = {
  simple: /\b(simple|minimal|basic|quick|brief|just|only|overview)\b/i,
  detailed: /\b(detailed|comprehensive|complete|thorough|full|in-depth|elaborate)\b/i,
};

const STYLE_PATTERNS = {
  technical: /\b(technical|developer|engineer|code|implementation)\b/i,
  business: /\b(business|stakeholder|executive|non-technical|simple)\b/i,
};

/**
 * Detect the most likely diagram type from user message
 */
export function detectDiagramType(message: string): { type: DiagramType | null; confidence: number } {
  const scores: Record<string, number> = {};
  const lowerMessage = message.toLowerCase();
  
  // Check each diagram type's patterns
  for (const [type, patterns] of Object.entries(DIAGRAM_PATTERNS)) {
    let matchCount = 0;
    for (const pattern of patterns) {
      if (pattern.test(lowerMessage)) {
        matchCount++;
      }
    }
    if (matchCount > 0) {
      scores[type] = matchCount / patterns.length;
    }
  }
  
  // Find the highest scoring type
  const entries = Object.entries(scores);
  if (entries.length === 0) {
    return { type: null, confidence: 0 };
  }
  
  entries.sort((a, b) => b[1] - a[1]);
  const [bestType, bestScore] = entries[0];
  
  // Check for competing high scores (ambiguity)
  const hasCompetition = entries.length > 1 && entries[1][1] > bestScore * 0.7;
  const adjustedConfidence = hasCompetition ? bestScore * 0.6 : bestScore;
  
  return {
    type: bestType as DiagramType,
    confidence: Math.min(adjustedConfidence, 1.0),
  };
}

/**
 * Detect C4 abstraction level from user message
 */
export function detectC4Level(message: string): C4Level | null {
  const lowerMessage = message.toLowerCase();
  
  // Check if this is even an architecture request
  if (!ARCHITECTURE_KEYWORDS.test(lowerMessage) && 
      !lowerMessage.includes('c4') &&
      !/(container|component|context)\s*(diagram|view|level)/i.test(lowerMessage)) {
    return null;
  }
  
  // Score each C4 level
  const scores: Record<C4Level, number> = {
    context: 0,
    container: 0,
    component: 0,
    code: 0,
  };
  
  for (const [level, patterns] of Object.entries(C4_LEVEL_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(lowerMessage)) {
        scores[level as C4Level]++;
      }
    }
  }
  
  // Find highest scoring level
  const entries = Object.entries(scores) as [C4Level, number][];
  entries.sort((a, b) => b[1] - a[1]);
  
  if (entries[0][1] > 0) {
    return entries[0][0];
  }
  
  // Default to container for general architecture requests
  if (ARCHITECTURE_KEYWORDS.test(lowerMessage)) {
    return 'container';
  }
  
  return null;
}

/**
 * Extract user constraints from message
 */
export function extractConstraints(message: string): Constraints {
  const constraints: Constraints = {};
  const lowerMessage = message.toLowerCase();
  
  // Detect complexity preference
  if (COMPLEXITY_PATTERNS.simple.test(lowerMessage)) {
    constraints.complexity = 'simple';
  } else if (COMPLEXITY_PATTERNS.detailed.test(lowerMessage)) {
    constraints.complexity = 'detailed';
  }
  
  // Detect style preference
  if (STYLE_PATTERNS.business.test(lowerMessage)) {
    constraints.style = 'business';
  } else if (STYLE_PATTERNS.technical.test(lowerMessage)) {
    constraints.style = 'technical';
  }
  
  // Extract focus areas (quoted strings or "focus on X" patterns)
  const focusMatch = message.match(/focus(?:ing)?\s+on\s+([^,.]+)/i);
  if (focusMatch) {
    constraints.focusAreas = [focusMatch[1].trim()];
  }
  
  // Extract exclusions
  const excludeMatch = message.match(/(?:without|exclude|skip|ignore)\s+([^,.]+)/i);
  if (excludeMatch) {
    constraints.excludeAreas = [excludeMatch[1].trim()];
  }
  
  return constraints;
}

/**
 * Determine if request is actually diagram-related
 */
export function isDiagramRequest(message: string): boolean {
  const diagramIndicators = /\b(diagram|chart|visual|draw|create|show|generate|make|build|map|model)\b/i;
  const contextIndicators = /\b(architecture|flow|process|system|database|class|sequence|state)\b/i;
  
  return diagramIndicators.test(message) || contextIndicators.test(message);
}

/**
 * Main intent analysis function
 */
export function analyzeIntent(message: string): IntentAnalysis {
  if (!message || typeof message !== 'string') {
    return {
      isValid: false,
      confidence: 0,
      suggestedType: null,
      constraints: {},
      requiresClarification: true,
      clarificationContext: 'Empty or invalid input',
    };
  }
  
  const trimmedMessage = message.trim();
  
  // Check if this is even a diagram request
  const isValid = isDiagramRequest(trimmedMessage);
  
  // Detect diagram type
  const { type, confidence } = detectDiagramType(trimmedMessage);
  
  // Detect C4 level
  const c4Level = detectC4Level(trimmedMessage);
  
  // Extract constraints
  const constraints = extractConstraints(trimmedMessage);
  
  // Determine if clarification is needed
  const requiresClarification = confidence < 0.6 && isValid;
  
  // Generate clarification context
  let clarificationContext: string | undefined;
  if (requiresClarification) {
    if (type === null) {
      clarificationContext = 'Unable to determine appropriate diagram type from the request';
    } else if (confidence < 0.4) {
      clarificationContext = `Low confidence (${Math.round(confidence * 100)}%) in diagram type selection`;
    } else {
      clarificationContext = 'Multiple diagram types could work for this request';
    }
  }
  
  return {
    isValid,
    confidence,
    suggestedType: type,
    c4Level: c4Level ?? undefined,
    constraints,
    requiresClarification,
    clarificationContext,
  };
}

/**
 * Generate clarification prompt augmentation for Claude
 */
export function getIntentAugmentation(analysis: IntentAnalysis): string | null {
  if (!analysis.requiresClarification) {
    return null;
  }
  
  const parts: string[] = [];
  
  parts.push('[Intent Analysis Context]');
  parts.push(`Confidence: ${Math.round(analysis.confidence * 100)}%`);
  
  if (analysis.suggestedType) {
    parts.push(`Detected type hint: ${analysis.suggestedType}`);
  }
  
  if (analysis.c4Level) {
    parts.push(`Detected C4 level hint: ${analysis.c4Level}`);
  }
  
  if (analysis.clarificationContext) {
    parts.push(`Note: ${analysis.clarificationContext}`);
  }
  
  parts.push('Action: Ask the user to clarify their requirements before generating the diagram.');
  
  return parts.join('\n');
}
