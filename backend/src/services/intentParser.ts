// Intent Parser Service
// Pre-processes user input to detect diagram type, C4 level, project type, and constraints

import type { C4Level } from '../prompts/shared/c4-examples.js';

export type DiagramType =
  | 'flowchart' | 'sequence' | 'class' | 'er' | 'state' | 'gantt'
  | 'c4-context' | 'c4-container' | 'c4-component' | 'mindmap' | 'pie' | 'journey';

export type ProjectType = 'web' | 'mobile' | 'api' | 'fullstack' | 'saas' | 'general';
export type ProjectPhase = 'intent' | 'architecture' | 'coding';

export interface Constraints {
  complexity?: 'simple' | 'detailed' | 'mvp' | 'standard' | 'enterprise';
  focusAreas?: string[];
  excludeAreas?: string[];
  style?: 'technical' | 'business';
}

export interface ProjectAnalysis {
  isProjectRequest: boolean;
  projectType: ProjectType | null;
  phase: ProjectPhase;
  techStack: string[];
  features: string[];
}

export interface IntentAnalysis {
  isValid: boolean;
  confidence: number; // 0.0 to 1.0
  suggestedType: DiagramType | null;
  c4Level?: C4Level;
  constraints: Constraints;
  requiresClarification: boolean;
  clarificationContext?: string;
  // Vibe coder additions
  project?: ProjectAnalysis;
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
  mvp: /\b(mvp|minimum\s*viable|prototype|quick|fast|basic\s*version)\b/i,
  enterprise: /\b(enterprise|production|scalable|robust|secure|comprehensive)\b/i,
};

const STYLE_PATTERNS = {
  technical: /\b(technical|developer|engineer|code|implementation)\b/i,
  business: /\b(business|stakeholder|executive|non-technical|simple)\b/i,
};

// Project type detection patterns for vibe coder
const PROJECT_PATTERNS: Record<ProjectType, RegExp[]> = {
  'web': [
    /\b(web\s*app|website|web\s*application|browser|spa|single\s*page)\b/i,
    /\b(react|vue|angular|next\.?js|nuxt|svelte)\b/i,
  ],
  'mobile': [
    /\b(mobile\s*app|ios|android|react\s*native|flutter|phone|tablet)\b/i,
    /\b(app\s*store|play\s*store|native\s*app)\b/i,
  ],
  'api': [
    /\b(api|rest|graphql|backend\s*service|microservice|endpoint)\b/i,
    /\b(server|express|fastapi|django|rails)\b/i,
  ],
  'fullstack': [
    /\b(full\s*stack|fullstack|end\s*to\s*end|complete\s*app)\b/i,
    /\b(frontend\s*and\s*backend|front\s*end.*back\s*end)\b/i,
  ],
  'saas': [
    /\b(saas|software\s*as\s*a\s*service|subscription|platform|multi-tenant)\b/i,
    /\b(billing|subscription|tenant|pricing\s*plan)\b/i,
  ],
  'general': [], // fallback
};

// Project intent indicators
const BUILD_VERBS = /\b(build|create|make|develop|implement|design|architect)\b/i;

// Tech stack detection patterns
const TECH_STACK_PATTERNS: Record<string, RegExp> = {
  'react': /\breact\b/i,
  'vue': /\bvue(\.?js)?\b/i,
  'angular': /\bangular\b/i,
  'next.js': /\bnext\.?js\b/i,
  'node.js': /\bnode(\.?js)?\b/i,
  'express': /\bexpress(\.?js)?\b/i,
  'python': /\bpython\b/i,
  'fastapi': /\bfastapi\b/i,
  'django': /\bdjango\b/i,
  'postgresql': /\b(postgres|postgresql|psql)\b/i,
  'mongodb': /\bmongo(db)?\b/i,
  'supabase': /\bsupabase\b/i,
  'firebase': /\bfirebase\b/i,
  'typescript': /\btypescript\b/i,
  'tailwind': /\btailwind(\s*css)?\b/i,
  'prisma': /\bprisma\b/i,
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
 * Detect project type from message
 */
export function detectProjectType(message: string): { type: ProjectType | null; confidence: number } {
  const lowerMessage = message.toLowerCase();
  const scores: Record<string, number> = {};

  for (const [type, patterns] of Object.entries(PROJECT_PATTERNS)) {
    if (type === 'general') continue;
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

  const entries = Object.entries(scores);
  if (entries.length === 0) {
    // Check if it's a general build request
    if (BUILD_VERBS.test(lowerMessage)) {
      return { type: 'general', confidence: 0.3 };
    }
    return { type: null, confidence: 0 };
  }

  entries.sort((a, b) => b[1] - a[1]);
  const [bestType, bestScore] = entries[0];

  return {
    type: bestType as ProjectType,
    confidence: Math.min(bestScore, 1.0),
  };
}

/**
 * Detect tech stack mentioned in message
 */
export function detectTechStack(message: string): string[] {
  const detected: string[] = [];
  const lowerMessage = message.toLowerCase();

  for (const [tech, pattern] of Object.entries(TECH_STACK_PATTERNS)) {
    if (pattern.test(lowerMessage)) {
      detected.push(tech);
    }
  }

  return detected;
}

/**
 * Detect current phase from message context
 */
export function detectPhase(message: string): ProjectPhase {
  const lowerMessage = message.toLowerCase();

  // Check for coding phase indicators
  if (/\b(code|implement|write|create\s*the|build\s*the|start\s*coding)\b/i.test(lowerMessage) &&
      /\b(frontend|backend|database|api|auth|component|service)\b/i.test(lowerMessage)) {
    return 'coding';
  }

  // Check for architecture phase indicators
  if (/\b(architect|design|plan|structure|diagram|flow|overview)\b/i.test(lowerMessage)) {
    return 'architecture';
  }

  // Default to intent phase for new requests
  return 'intent';
}

/**
 * Check if this is a software project build request
 */
export function isProjectRequest(message: string): boolean {
  const lowerMessage = message.toLowerCase();

  // Must have a build verb
  if (!BUILD_VERBS.test(lowerMessage)) {
    return false;
  }

  // Check for project indicators
  const projectIndicators = /\b(app|application|platform|system|service|website|site|tool|product|software)\b/i;
  return projectIndicators.test(lowerMessage);
}

/**
 * Analyze project intent for vibe coder mode
 */
export function analyzeProjectIntent(message: string): ProjectAnalysis {
  const isProject = isProjectRequest(message);
  const { type: projectType } = detectProjectType(message);
  const techStack = detectTechStack(message);
  const phase = detectPhase(message);

  // Extract potential features from message
  const features: string[] = [];
  const featurePatterns = [
    /\b(authentication|auth|login|signup)\b/i,
    /\b(dashboard|analytics)\b/i,
    /\b(payment|billing|subscription)\b/i,
    /\b(user\s*management|users)\b/i,
    /\b(notification|email|sms)\b/i,
    /\b(search|filter)\b/i,
    /\b(upload|storage|files?)\b/i,
    /\b(chat|messaging|real-?time)\b/i,
    /\b(admin|management)\b/i,
  ];

  for (const pattern of featurePatterns) {
    const match = message.match(pattern);
    if (match) {
      features.push(match[0].toLowerCase());
    }
  }

  return {
    isProjectRequest: isProject,
    projectType,
    phase,
    techStack,
    features,
  };
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

  // Analyze project intent for vibe coder mode
  const project = analyzeProjectIntent(trimmedMessage);

  // Check if this is a diagram request OR a project request
  const isDiagram = isDiagramRequest(trimmedMessage);
  const isValid = isDiagram || project.isProjectRequest;

  // Detect diagram type
  const { type, confidence } = detectDiagramType(trimmedMessage);

  // Detect C4 level
  const c4Level = detectC4Level(trimmedMessage);

  // Extract constraints
  const constraints = extractConstraints(trimmedMessage);

  // Add complexity from project context
  if (project.isProjectRequest && !constraints.complexity) {
    if (COMPLEXITY_PATTERNS.mvp.test(trimmedMessage)) {
      constraints.complexity = 'mvp';
    } else if (COMPLEXITY_PATTERNS.enterprise.test(trimmedMessage)) {
      constraints.complexity = 'enterprise';
    } else {
      constraints.complexity = 'standard';
    }
  }

  // Determine if clarification is needed (less aggressive for project requests)
  const requiresClarification = !project.isProjectRequest && confidence < 0.6 && isValid;

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
    confidence: project.isProjectRequest ? Math.max(confidence, 0.7) : confidence,
    suggestedType: type,
    c4Level: c4Level ?? undefined,
    constraints,
    requiresClarification,
    clarificationContext,
    project,
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
