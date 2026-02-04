/**
 * @fileoverview Intent Parser Service for diagram and project request analysis.
 *
 * This module pre-processes user input to detect:
 * - **Diagram type**: flowchart, sequence, class, ER, state, C4, etc.
 * - **C4 abstraction level**: context, container, component, or code
 * - **Project type**: web app, mobile, API, SaaS, fullstack
 * - **Constraints**: complexity, style, focus areas, exclusions
 * - **Tech stack**: React, Vue, Node.js, PostgreSQL, etc.
 *
 * ## How It Works
 *
 * The parser uses regex pattern matching to score different categories and
 * returns confidence scores for ambiguous requests. This enables:
 *
 * 1. **Smart defaults** - Automatically select the best diagram type
 * 2. **Clarification prompts** - Ask users when intent is unclear
 * 3. **Enriched prompts** - Add context to LLM system prompts
 *
 * ## Usage
 *
 * ```typescript
 * import { analyzeIntent, getIntentAugmentation } from './intentParser';
 *
 * const intent = analyzeIntent("Create a microservices architecture for an e-commerce site");
 *
 * console.log(intent);
 * // {
 * //   isValid: true,
 * //   confidence: 0.85,
 * //   suggestedType: 'c4-container',
 * //   c4Level: 'container',
 * //   constraints: { complexity: 'standard' },
 * //   requiresClarification: false,
 * //   project: {
 * //     isProjectRequest: true,
 * //     projectType: 'fullstack',
 * //     phase: 'architecture',
 * //     techStack: [],
 * //     features: []
 * //   }
 * // }
 * ```
 *
 * @module services/intentParser
 */

import type { C4Level } from "../prompts/shared/c4-examples.js";

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Supported Mermaid diagram types.
 * Includes standard Mermaid types plus C4 architecture diagrams.
 */
export type DiagramType =
  | "flowchart"
  | "sequence"
  | "class"
  | "er"
  | "state"
  | "gantt"
  | "c4-context"
  | "c4-container"
  | "c4-component"
  | "mindmap"
  | "pie"
  | "journey";

/** Software project categories for vibe coder mode */
export type ProjectType =
  | "web"
  | "mobile"
  | "api"
  | "fullstack"
  | "saas"
  | "general";

/** Development phase for project requests */
export type ProjectPhase = "intent" | "architecture" | "coding";

/**
 * User-specified constraints for diagram generation.
 * Extracted from natural language cues in the request.
 */
export interface Constraints {
  /** Desired level of detail */
  complexity?: "simple" | "detailed" | "mvp" | "standard" | "enterprise";
  /** Specific areas to emphasize */
  focusAreas?: string[];
  /** Areas to exclude from the diagram */
  excludeAreas?: string[];
  /** Target audience style */
  style?: "technical" | "business";
}

/**
 * Analysis result for project-style requests (vibe coder mode).
 * Captures software development context.
 */
export interface ProjectAnalysis {
  /** Whether this appears to be a software project request */
  isProjectRequest: boolean;
  /** Detected project category */
  projectType: ProjectType | null;
  /** Current development phase */
  phase: ProjectPhase;
  /** Mentioned technologies */
  techStack: string[];
  /** Mentioned features/capabilities */
  features: string[];
}

/**
 * Complete intent analysis result.
 * Contains all extracted information about the user's request.
 */
export interface IntentAnalysis {
  /** Whether the request appears valid for diagram/project generation */
  isValid: boolean;
  /** Confidence score from 0.0 to 1.0 */
  confidence: number;
  /** Best-guess diagram type (null if undetermined) */
  suggestedType: DiagramType | null;
  /** Detected C4 abstraction level */
  c4Level?: C4Level;
  /** Extracted user constraints */
  constraints: Constraints;
  /** Whether clarification should be requested */
  requiresClarification: boolean;
  /** Explanation for why clarification is needed */
  clarificationContext?: string;
  /** Project analysis for vibe coder mode */
  project?: ProjectAnalysis;
}

// =============================================================================
// Detection Patterns
// =============================================================================

// =============================================================================
// Diagram Type Detection
// =============================================================================

// Keyword patterns for diagram type detection
const DIAGRAM_PATTERNS: Record<DiagramType, RegExp[]> = {
  flowchart: [
    /\b(flow|process|workflow|steps?|procedure|algorithm|decision\s*tree)\b/i,
    /\b(if|then|else|branch|path|route)\b/i,
    /\b(flow\s*chart|flowchart)\b/i,
  ],
  sequence: [
    /\b(sequence|interaction|call|request|response|message|communicate)\b/i,
    /\b(api\s*calls?|http|rest|endpoint|service\s*calls?)\b/i,
    /\b(actor|user\s*journey|step\s*by\s*step)\b/i,
  ],
  class: [
    /\b(class|interface|inheritance|extends|implements|object|oop)\b/i,
    /\b(method|property|attribute|member|encapsulation)\b/i,
    /\b(uml|class\s*diagram)\b/i,
  ],
  er: [
    /\b(entity|relationship|database|schema|table|foreign\s*key)\b/i,
    /\b(erd?|data\s*model|one\s*to\s*many|many\s*to\s*many)\b/i,
    /\b(primary\s*key|column|record)\b/i,
  ],
  state: [
    /\b(state|transition|status|lifecycle|finite\s*state)\b/i,
    /\b(machine|fsm|current\s*state|next\s*state)\b/i,
  ],
  gantt: [
    /\b(gantt|timeline|schedule|project\s*plan|milestone)\b/i,
    /\b(duration|deadline|task|phase|sprint)\b/i,
  ],
  "c4-context": [
    /\b(system\s*context|high\s*level|external\s*system|actor)\b/i,
    /\b(c4\s*context|big\s*picture|overview)\b/i,
  ],
  "c4-container": [
    /\b(container|microservice|service|application|api\s*server)\b/i,
    /\b(c4\s*container|internal\s*service|deployment)\b/i,
    /\b(docker|kubernetes|backend|frontend)\b/i,
  ],
  "c4-component": [
    /\b(component|module|controller|service\s*layer|repository)\b/i,
    /\b(c4\s*component|internal\s*structure)\b/i,
  ],
  mindmap: [
    /\b(mindmap|mind\s*map|brainstorm|ideas?|hierarchy)\b/i,
    /\b(concept|topic|branch\s*out)\b/i,
  ],
  pie: [
    /\b(pie|percentage|proportion|distribution|breakdown)\b/i,
    /\b(share|ratio|part\s*of)\b/i,
  ],
  journey: [
    /\b(user\s*journey|customer\s*journey|experience|touchpoint)\b/i,
    /\b(satisfaction|emotion|feeling)\b/i,
  ],
};

// =============================================================================
// C4 Level Detection
// =============================================================================

// C4 level detection patterns
const C4_LEVEL_PATTERNS: Record<C4Level, RegExp[]> = {
  context: [
    /\b(system\s*context|high\s*level|bird'?s?\s*eye|overview|external)\b/i,
    /\b(actors?|users?\s*and\s*systems?|landscape)\b/i,
  ],
  container: [
    /\b(container|services?|applications?|microservices?)\b/i,
    /\b(deployment|infrastructure|backend|frontend|api)\b/i,
    /\b(databases?|message\s*queue|cache)\b/i,
  ],
  component: [
    /\b(components?|modules?|internal|controllers?|handlers?)\b/i,
    /\b(layers?|repository|service\s*layer)\b/i,
  ],
  code: [
    /\b(code|class|implementation|method|function)\b/i,
    /\b(detail|specific|exact)\b/i,
  ],
};

// =============================================================================
// Constraint Detection
// =============================================================================

// Architecture keywords that suggest C4-style diagrams
const ARCHITECTURE_KEYWORDS =
  /\b(architecture|system\s*design|infrastructure|tech\s*stack|deployment)\b/i;

// Complexity level patterns
const COMPLEXITY_PATTERNS = {
  simple: /\b(simple|minimal|basic|quick|brief|just|only|overview)\b/i,
  detailed:
    /\b(detailed|comprehensive|complete|thorough|full|in-depth|elaborate)\b/i,
  mvp: /\b(mvp|minimum\s*viable|prototype|quick|fast|basic\s*version)\b/i,
  enterprise:
    /\b(enterprise|production|scalable|robust|secure|comprehensive)\b/i,
};

const STYLE_PATTERNS = {
  technical: /\b(technical|developer|engineer|code|implementation)\b/i,
  business: /\b(business|stakeholder|executive|non-technical|simple)\b/i,
};

// =============================================================================
// Project/Vibe Coder Detection
// =============================================================================

// Project type detection patterns for vibe coder
const PROJECT_PATTERNS: Record<ProjectType, RegExp[]> = {
  web: [
    /\b(web\s*app|website|web\s*application|browser|spa|single\s*page)\b/i,
    /\b(react|vue|angular|next\.?js|nuxt|svelte)\b/i,
  ],
  mobile: [
    /\b(mobile\s*app|ios|android|react\s*native|flutter|phone|tablet)\b/i,
    /\b(app\s*store|play\s*store|native\s*app)\b/i,
  ],
  api: [
    /\b(api|rest|graphql|backend\s*service|microservice|endpoint)\b/i,
    /\b(server|express|fastapi|django|rails)\b/i,
  ],
  fullstack: [
    /\b(full\s*stack|fullstack|end\s*to\s*end|complete\s*app)\b/i,
    /\b(frontend\s*and\s*backend|front\s*end.*back\s*end)\b/i,
  ],
  saas: [
    /\b(saas|software\s*as\s*a\s*service|subscription|platform|multi-tenant)\b/i,
    /\b(billing|subscription|tenant|pricing\s*plan)\b/i,
  ],
  general: [], // fallback
};

// Project intent indicators
const BUILD_VERBS =
  /\b(build|create|make|develop|implement|design|architect)\b/i;

// Tech stack detection patterns
const TECH_STACK_PATTERNS: Record<string, RegExp> = {
  react: /\breact\b/i,
  vue: /\bvue(\.?js)?\b/i,
  angular: /\bangular\b/i,
  "next.js": /\bnext\.?js\b/i,
  "node.js": /\bnode(\.?js)?\b/i,
  express: /\bexpress(\.?js)?\b/i,
  python: /\bpython\b/i,
  fastapi: /\bfastapi\b/i,
  django: /\bdjango\b/i,
  postgresql: /\b(postgres|postgresql|psql)\b/i,
  mongodb: /\bmongo(db)?\b/i,
  supabase: /\bsupabase\b/i,
  firebase: /\bfirebase\b/i,
  typescript: /\btypescript\b/i,
  tailwind: /\btailwind(\s*css)?\b/i,
  prisma: /\bprisma\b/i,
};

// =============================================================================
// Public API Functions
// =============================================================================

/**
 * Detects the most likely diagram type from a user message.
 *
 * Uses keyword pattern matching to score each diagram type and returns
 * the highest-scoring match with a confidence level.
 *
 * @param message - User's natural language request
 * @returns Object with detected type and confidence (0.0-1.0)
 *
 * @example
 * ```typescript
 * detectDiagramType("Show me the user login flow")
 * // => { type: 'flowchart', confidence: 0.8 }
 *
 * detectDiagramType("API request/response between services")
 * // => { type: 'sequence', confidence: 0.7 }
 * ```
 */
export function detectDiagramType(message: string): {
  type: DiagramType | null;
  confidence: number;
} {
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
 * Detects the C4 abstraction level from a user message.
 *
 * C4 levels (from high-level to detailed):
 * - `context`: System context - external actors and systems
 * - `container`: Containers - applications, services, databases
 * - `component`: Components - internal modules and layers
 * - `code`: Code - class-level implementation details
 *
 * @param message - User's natural language request
 * @returns Detected C4 level, or null if not applicable
 *
 * @example
 * ```typescript
 * detectC4Level("Show the microservices and databases")
 * // => 'container'
 *
 * detectC4Level("Internal controller and service layer")
 * // => 'component'
 * ```
 */
export function detectC4Level(message: string): C4Level | null {
  const lowerMessage = message.toLowerCase();

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

  const isArchitectureRequest =
    ARCHITECTURE_KEYWORDS.test(lowerMessage) ||
    lowerMessage.includes("c4") ||
    /(container|component|context)\s*(diagram|view|level)/i.test(lowerMessage);

  // Default to container for general architecture requests
  if (isArchitectureRequest) {
    return "container";
  }

  return null;
}

/**
 * Extracts user constraints from a message.
 *
 * Detects preferences for:
 * - Complexity (simple, detailed, MVP, enterprise)
 * - Style (technical vs business audience)
 * - Focus areas ("focus on authentication")
 * - Exclusions ("without the payment system")
 *
 * @param message - User's natural language request
 * @returns Extracted constraints object
 *
 * @example
 * ```typescript
 * extractConstraints("Create a simple diagram focusing on auth, without billing")
 * // => {
 * //   complexity: 'simple',
 * //   focusAreas: ['auth'],
 * //   excludeAreas: ['billing']
 * // }
 * ```
 */
export function extractConstraints(message: string): Constraints {
  const constraints: Constraints = {};
  const lowerMessage = message.toLowerCase();

  // Detect complexity preference
  if (COMPLEXITY_PATTERNS.simple.test(lowerMessage)) {
    constraints.complexity = "simple";
  } else if (COMPLEXITY_PATTERNS.detailed.test(lowerMessage)) {
    constraints.complexity = "detailed";
  }

  // Detect style preference
  if (STYLE_PATTERNS.business.test(lowerMessage)) {
    constraints.style = "business";
  } else if (STYLE_PATTERNS.technical.test(lowerMessage)) {
    constraints.style = "technical";
  }

  // Extract focus areas (quoted strings or "focus on X" patterns)
  const focusMatch = message.match(/focus(?:ing)?\s+on\s+([^,.]+)/i);
  if (focusMatch) {
    constraints.focusAreas = [focusMatch[1].trim()];
  }

  // Extract exclusions
  const excludeMatch = message.match(
    /(?:without|exclude|skip|ignore)\s+([^,.]+)/i,
  );
  if (excludeMatch) {
    constraints.excludeAreas = [excludeMatch[1].trim()];
  }

  return constraints;
}

/**
 * Determines if a request is diagram-related.
 *
 * Checks for diagram-related verbs (draw, create, show, generate) and
 * context indicators (architecture, flow, process, system).
 *
 * @param message - User's message to analyze
 * @returns True if the message appears to request a diagram
 */
export function isDiagramRequest(message: string): boolean {
  const diagramIndicators =
    /\b(diagram|chart|visual|draw|create|show|generate|make|build|map|model)\b/i;
  const contextIndicators =
    /\b(architecture|flow|process|system|database|class|sequence|state)\b/i;

  return diagramIndicators.test(message) || contextIndicators.test(message);
}

/**
 * Detects the software project type from a message.
 *
 * @param message - User's natural language request
 * @returns Object with detected project type and confidence
 *
 * @example
 * ```typescript
 * detectProjectType("Build a React web application")
 * // => { type: 'web', confidence: 0.8 }
 *
 * detectProjectType("Create a REST API with Express")
 * // => { type: 'api', confidence: 0.7 }
 * ```
 */
export function detectProjectType(message: string): {
  type: ProjectType | null;
  confidence: number;
} {
  const lowerMessage = message.toLowerCase();
  const scores: Record<string, number> = {};

  for (const [type, patterns] of Object.entries(PROJECT_PATTERNS)) {
    if (type === "general") continue;
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
      return { type: "general", confidence: 0.3 };
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
 * Detects technology stack mentions in a message.
 *
 * Scans for known technologies including:
 * - Frontend: React, Vue, Angular, Next.js, Svelte, Tailwind
 * - Backend: Node.js, Express, Python, FastAPI, Django
 * - Database: PostgreSQL, MongoDB, Supabase, Firebase
 * - Tools: TypeScript, Prisma
 *
 * @param message - User's message to analyze
 * @returns Array of detected technology names
 *
 * @example
 * ```typescript
 * detectTechStack("Build with React, Node.js, and PostgreSQL")
 * // => ['react', 'node.js', 'postgresql']
 * ```
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
 * Detects the current development phase from message context.
 *
 * Phases:
 * - `intent`: Initial request, understanding requirements
 * - `architecture`: System design and planning
 * - `coding`: Implementation phase
 *
 * @param message - User's message to analyze
 * @returns Detected development phase
 */
export function detectPhase(message: string): ProjectPhase {
  const lowerMessage = message.toLowerCase();

  // Check for coding phase indicators
  if (
    /\b(code|implement|write|create\s*the|build\s*the|start\s*coding)\b/i.test(
      lowerMessage,
    ) &&
    /\b(frontend|backend|database|api|auth|component|service)\b/i.test(
      lowerMessage,
    )
  ) {
    return "coding";
  }

  // Check for architecture phase indicators
  if (
    /\b(architect|design|plan|structure|diagram|flow|overview)\b/i.test(
      lowerMessage,
    )
  ) {
    return "architecture";
  }

  // Default to intent phase for new requests
  return "intent";
}

/**
 * Checks if this is a software project build request.
 *
 * A project request requires:
 * 1. A build verb (build, create, make, develop, implement)
 * 2. A project indicator (app, application, platform, system, etc.)
 *
 * @param message - User's message to analyze
 * @returns True if this appears to be a project request
 */
export function isProjectRequest(message: string): boolean {
  const lowerMessage = message.toLowerCase();

  // Must have a build verb
  if (!BUILD_VERBS.test(lowerMessage)) {
    return false;
  }

  // Check for project indicators
  const projectIndicators =
    /\b(app|application|platform|system|service|website|site|tool|product|software)\b/i;
  return projectIndicators.test(lowerMessage);
}

/**
 * Analyzes project intent for vibe coder mode.
 *
 * Performs comprehensive analysis of a project request including:
 * - Project type detection
 * - Tech stack extraction
 * - Development phase detection
 * - Feature extraction (auth, payments, search, etc.)
 *
 * @param message - User's project request
 * @returns Complete project analysis
 *
 * @example
 * ```typescript
 * analyzeProjectIntent("Build a SaaS dashboard with React and Supabase, include auth and billing")
 * // => {
 * //   isProjectRequest: true,
 * //   projectType: 'saas',
 * //   phase: 'intent',
 * //   techStack: ['react', 'supabase'],
 * //   features: ['authentication', 'billing']
 * // }
 * ```
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
 * Main intent analysis function - the primary entry point.
 *
 * Performs comprehensive analysis of a user's request to determine:
 * - Whether it's a valid diagram or project request
 * - The best diagram type to generate
 * - C4 abstraction level (for architecture diagrams)
 * - User constraints and preferences
 * - Whether clarification is needed
 * - Project context for vibe coder mode
 *
 * @param message - User's natural language request
 * @returns Complete intent analysis with confidence scores
 *
 * @example
 * ```typescript
 * const intent = analyzeIntent("Create a detailed sequence diagram for user checkout");
 *
 * if (intent.requiresClarification) {
 *   // Ask user for more details
 *   const augmentation = getIntentAugmentation(intent);
 * } else {
 *   // Proceed with generation
 *   generateDiagram(message, { c4Level: intent.c4Level, ...intent.constraints });
 * }
 * ```
 */
export function analyzeIntent(message: string): IntentAnalysis {
  if (!message || typeof message !== "string") {
    return {
      isValid: false,
      confidence: 0,
      suggestedType: null,
      constraints: {},
      requiresClarification: true,
      clarificationContext: "Empty or invalid input",
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
      constraints.complexity = "mvp";
    } else if (COMPLEXITY_PATTERNS.enterprise.test(trimmedMessage)) {
      constraints.complexity = "enterprise";
    } else {
      constraints.complexity = "standard";
    }
  }

  // Determine if clarification is needed (less aggressive for project requests)
  const requiresClarification =
    !project.isProjectRequest && confidence < 0.6 && isValid;

  // Generate clarification context
  let clarificationContext: string | undefined;
  if (requiresClarification) {
    if (type === null) {
      clarificationContext =
        "Unable to determine appropriate diagram type from the request";
    } else if (confidence < 0.4) {
      clarificationContext = `Low confidence (${Math.round(confidence * 100)}%) in diagram type selection`;
    } else {
      clarificationContext =
        "Multiple diagram types could work for this request";
    }
  }

  return {
    isValid,
    confidence: project.isProjectRequest
      ? Math.max(confidence, 0.7)
      : confidence,
    suggestedType: type,
    c4Level: c4Level ?? undefined,
    constraints,
    requiresClarification,
    clarificationContext,
    project,
  };
}

/**
 * Generates a clarification prompt augmentation for the LLM.
 *
 * When intent analysis indicates clarification is needed, this function
 * generates context that can be appended to the LLM system prompt to
 * encourage asking the user for more details.
 *
 * @param analysis - Intent analysis result
 * @returns Augmentation string to add to the prompt, or null if not needed
 *
 * @example
 * ```typescript
 * const intent = analyzeIntent("make a diagram");
 * const augmentation = getIntentAugmentation(intent);
 *
 * if (augmentation) {
 *   systemPrompt += '\n\n' + augmentation;
 *   // LLM will now ask user to clarify what type of diagram they want
 * }
 * ```
 */
export function getIntentAugmentation(analysis: IntentAnalysis): string | null {
  if (!analysis.requiresClarification) {
    return null;
  }

  const parts: string[] = [];

  parts.push("[Intent Analysis Context]");
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

  parts.push(
    "Action: Ask the user to clarify their requirements before generating the diagram.",
  );

  return parts.join("\n");
}
