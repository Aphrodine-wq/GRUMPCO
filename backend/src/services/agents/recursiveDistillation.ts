/**
 * RecursiveDistillation Service
 *
 * Self-compresses conversation patterns and builds personalized user models.
 * Implements recursive self-distillation to extract recurring patterns, preferences,
 * and constraints from conversation history.
 *
 * Key Features:
 * - Conversation pattern extraction
 * - User preference modeling
 * - Constraint/rule extraction
 * - Style and tone analysis
 * - Periodic compression cycles
 * - Knowledge graph building
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  sessionId: string;
  metadata?: Record<string, unknown>;
}

export interface ExtractedPattern {
  id: string;
  type: 'preference' | 'constraint' | 'style' | 'topic' | 'workflow' | 'correction';
  pattern: string;
  examples: string[];
  confidence: number;
  frequency: number;
  firstSeen: number;
  lastSeen: number;
  vector?: Float64Array;
}

export interface UserPreference {
  category: string;
  preference: string;
  positive: boolean; // true = likes, false = dislikes
  confidence: number;
  evidence: string[];
}

export interface Constraint {
  id: string;
  rule: string;
  context: string[];
  priority: number;
  softness: number; // 0 = hard constraint, 1 = soft preference
}

export interface StyleProfile {
  formality: number; // 0-1: casual to formal
  verbosity: number; // 0-1: concise to verbose
  technicality: number; // 0-1: simple to technical
  emotiveness: number; // 0-1: neutral to emotive
  directness: number; // 0-1: indirect to direct
  samples: string[];
}

export interface KnowledgeNode {
  id: string;
  type: 'concept' | 'entity' | 'action' | 'preference';
  label: string;
  properties: Record<string, unknown>;
  mentions: number;
  lastMentioned: number;
}

export interface KnowledgeEdge {
  from: string;
  to: string;
  relation: string;
  weight: number;
  evidence: string[];
}

export interface UserModel {
  userId: string;
  createdAt: number;
  updatedAt: number;
  version: number;

  preferences: UserPreference[];
  constraints: Constraint[];
  styleProfile: StyleProfile;
  patterns: ExtractedPattern[];

  // Knowledge graph
  nodes: Map<string, KnowledgeNode>;
  edges: KnowledgeEdge[];

  // Compressed representation
  embedding?: Float64Array;
  summary?: string;

  // Statistics
  totalConversations: number;
  totalTurns: number;
  distillationCycles: number;
}

export interface DistillationResult {
  patternsExtracted: number;
  preferencesUpdated: number;
  constraintsFound: number;
  compressionRatio: number;
  modelVersion: number;
}

// ============================================================================
// Pattern Extractor
// ============================================================================

export class PatternExtractor {
  private patternCounts: Map<string, number> = new Map();
  private patternExamples: Map<string, string[]> = new Map();

  /**
   * Extract patterns from a conversation
   */
  extractPatterns(turns: ConversationTurn[]): ExtractedPattern[] {
    const patterns: ExtractedPattern[] = [];

    // Extract different pattern types
    patterns.push(...this.extractPreferencePatterns(turns));
    patterns.push(...this.extractCorrectionPatterns(turns));
    patterns.push(...this.extractWorkflowPatterns(turns));
    patterns.push(...this.extractTopicPatterns(turns));

    return patterns;
  }

  /**
   * Extract preference patterns ("I prefer...", "I like...", "Don't use...")
   */
  private extractPreferencePatterns(turns: ConversationTurn[]): ExtractedPattern[] {
    const patterns: ExtractedPattern[] = [];
    const prefRegexes = [
      /i (?:prefer|like|want|need|love)\s+(.+?)(?:\.|$)/gi,
      /(?:don't|do not|never)\s+(?:use|include|add)\s+(.+?)(?:\.|$)/gi,
      /(?:always|usually|typically)\s+(.+?)(?:\.|$)/gi,
      /(?:please|can you)\s+(?:make sure|ensure)\s+(.+?)(?:\.|$)/gi,
      /(?:it should|it must|should always)\s+(.+?)(?:\.|$)/gi,
    ];

    for (const turn of turns) {
      if (turn.role !== 'user') continue;

      for (const regex of prefRegexes) {
        const matches = turn.content.matchAll(new RegExp(regex));
        for (const match of matches) {
          const pattern = match[1]?.trim();
          if (pattern && pattern.length > 3 && pattern.length < 200) {
            const count = (this.patternCounts.get(pattern) || 0) + 1;
            this.patternCounts.set(pattern, count);

            if (!this.patternExamples.has(pattern)) {
              this.patternExamples.set(pattern, []);
            }
            const examples = this.patternExamples.get(pattern);
            if (examples) {
              examples.push(turn.content.slice(0, 200));
            }

            patterns.push({
              id: `pref_${this.hashString(pattern)}`,
              type: 'preference',
              pattern,
              examples: [turn.content.slice(0, 200)],
              confidence: Math.min(0.9, 0.3 + count * 0.1),
              frequency: count,
              firstSeen: turn.timestamp,
              lastSeen: turn.timestamp,
            });
          }
        }
      }
    }

    return this.deduplicatePatterns(patterns);
  }

  /**
   * Extract correction patterns (when user corrects assistant)
   */
  private extractCorrectionPatterns(turns: ConversationTurn[]): ExtractedPattern[] {
    const patterns: ExtractedPattern[] = [];
    const correctionIndicators = [
      /(?:no,?\s+)?(?:that's|that is)\s+(?:not|wrong)/i,
      /(?:actually|instead|rather)\s+/i,
      /(?:i meant|i said|i wanted)\s+/i,
      /(?:please|can you)\s+(?:fix|change|update|correct)\s+/i,
      /(?:not quite|close but|almost)\s+/i,
    ];

    for (let i = 1; i < turns.length; i++) {
      const turn = turns[i];
      if (turn.role !== 'user') continue;

      // Check if this looks like a correction
      let isCorrection = false;
      for (const regex of correctionIndicators) {
        if (regex.test(turn.content)) {
          isCorrection = true;
          break;
        }
      }

      if (isCorrection) {
        // Extract what should be done instead
        const correctionMatch = turn.content.match(
          /(?:should|must|need to|have to)\s+(.+?)(?:\.|$)/i
        );

        const pattern = correctionMatch?.[1] || turn.content.slice(0, 100);

        patterns.push({
          id: `corr_${this.hashString(pattern)}`,
          type: 'correction',
          pattern,
          examples: [turn.content],
          confidence: 0.7,
          frequency: 1,
          firstSeen: turn.timestamp,
          lastSeen: turn.timestamp,
        });
      }
    }

    return patterns;
  }

  /**
   * Extract workflow patterns (sequence of actions)
   */
  private extractWorkflowPatterns(turns: ConversationTurn[]): ExtractedPattern[] {
    const patterns: ExtractedPattern[] = [];
    const workflowIndicators = [
      /(?:first|then|next|after that|finally)\s+/i,
      /(?:step \d|1\.|2\.|3\.)/i,
      /(?:before|after)\s+(?:doing|running|executing)\s+/i,
    ];

    for (const turn of turns) {
      if (turn.role !== 'user') continue;

      let hasWorkflow = false;
      for (const regex of workflowIndicators) {
        if (regex.test(turn.content)) {
          hasWorkflow = true;
          break;
        }
      }

      if (hasWorkflow) {
        // Extract the workflow description
        const steps = turn.content.split(/(?:then|next|after that|finally)/i);
        if (steps.length > 1) {
          const pattern = steps.map((s) => s.trim().slice(0, 50)).join(' → ');

          patterns.push({
            id: `wf_${this.hashString(pattern)}`,
            type: 'workflow',
            pattern,
            examples: [turn.content],
            confidence: 0.6,
            frequency: 1,
            firstSeen: turn.timestamp,
            lastSeen: turn.timestamp,
          });
        }
      }
    }

    return patterns;
  }

  /**
   * Extract topic patterns (recurring subjects)
   */
  private extractTopicPatterns(turns: ConversationTurn[]): ExtractedPattern[] {
    const patterns: ExtractedPattern[] = [];
    const topicCounts: Map<string, { count: number; examples: string[] }> = new Map();

    // Simple keyword extraction (could be replaced with NER or more sophisticated NLP)
    const topicRegexes = [
      /(?:working on|building|creating|implementing)\s+(?:a|an|the)?\s*(\w+(?:\s+\w+)?)/gi,
      /(?:for|in|with)\s+(?:my|the|our)\s+(\w+(?:\s+\w+)?)/gi,
      /(?:using|with)\s+(\w+\.?\w*)/gi, // technologies/frameworks
    ];

    for (const turn of turns) {
      if (turn.role !== 'user') continue;

      for (const regex of topicRegexes) {
        const matches = turn.content.matchAll(new RegExp(regex));
        for (const match of matches) {
          const topic = match[1]?.toLowerCase().trim();
          if (topic && topic.length > 2 && topic.length < 50) {
            if (!topicCounts.has(topic)) {
              topicCounts.set(topic, { count: 0, examples: [] });
            }
            const data = topicCounts.get(topic);
            if (data) {
              data.count++;
              if (data.examples.length < 5) {
                data.examples.push(turn.content.slice(0, 100));
              }
            }
          }
        }
      }
    }

    // Only include topics mentioned multiple times
    for (const [topic, data] of topicCounts) {
      if (data.count >= 2) {
        patterns.push({
          id: `topic_${this.hashString(topic)}`,
          type: 'topic',
          pattern: topic,
          examples: data.examples,
          confidence: Math.min(0.9, 0.4 + data.count * 0.1),
          frequency: data.count,
          firstSeen: Date.now(),
          lastSeen: Date.now(),
        });
      }
    }

    return patterns;
  }

  /**
   * Deduplicate and merge similar patterns
   */
  private deduplicatePatterns(patterns: ExtractedPattern[]): ExtractedPattern[] {
    const merged: Map<string, ExtractedPattern> = new Map();

    for (const pattern of patterns) {
      const key = pattern.id;
      const existing = merged.get(key);
      if (existing) {
        existing.frequency += pattern.frequency;
        existing.confidence = Math.max(existing.confidence, pattern.confidence);
        existing.lastSeen = Math.max(existing.lastSeen, pattern.lastSeen);
        existing.examples.push(...pattern.examples);
        if (existing.examples.length > 10) {
          existing.examples = existing.examples.slice(-10);
        }
      } else {
        merged.set(key, { ...pattern });
      }
    }

    return Array.from(merged.values());
  }

  /**
   * Simple hash function for pattern IDs
   */
  private hashString(s: string): string {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      const char = s.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}

// ============================================================================
// Style Analyzer
// ============================================================================

export class StyleAnalyzer {
  /**
   * Analyze user's communication style from their messages
   */
  analyzeStyle(userMessages: string[]): StyleProfile {
    const profile: StyleProfile = {
      formality: 0.5,
      verbosity: 0.5,
      technicality: 0.5,
      emotiveness: 0.5,
      directness: 0.5,
      samples: [],
    };

    if (userMessages.length === 0) return profile;

    let totalFormality = 0;
    let totalVerbosity = 0;
    let totalTechnicality = 0;
    let totalEmotiveness = 0;
    let totalDirectness = 0;

    for (const msg of userMessages) {
      totalFormality += this.measureFormality(msg);
      totalVerbosity += this.measureVerbosity(msg);
      totalTechnicality += this.measureTechnicality(msg);
      totalEmotiveness += this.measureEmotiveness(msg);
      totalDirectness += this.measureDirectness(msg);

      // Sample diverse messages
      if (profile.samples.length < 10 && msg.length > 20 && msg.length < 500) {
        profile.samples.push(msg);
      }
    }

    const n = userMessages.length;
    profile.formality = totalFormality / n;
    profile.verbosity = totalVerbosity / n;
    profile.technicality = totalTechnicality / n;
    profile.emotiveness = totalEmotiveness / n;
    profile.directness = totalDirectness / n;

    return profile;
  }

  /**
   * Measure formality level (0 = casual, 1 = formal)
   */
  private measureFormality(text: string): number {
    let score = 0.5;

    // Casual indicators
    const casualPatterns = [
      /\b(hey|hi|yo|sup|gonna|wanna|gotta|kinda|sorta|lol|haha|lmao)\b/gi,
      /!{2,}/g, // Multiple exclamation marks
      /\.{3,}/g, // Ellipsis overuse
    ];

    // Formal indicators
    const formalPatterns = [
      /\b(please|kindly|would you|could you|I would appreciate)\b/gi,
      /\b(therefore|furthermore|consequently|regarding|concerning)\b/gi,
    ];

    for (const pattern of casualPatterns) {
      const matches = text.match(pattern);
      score -= (matches?.length || 0) * 0.1;
    }

    for (const pattern of formalPatterns) {
      const matches = text.match(pattern);
      score += (matches?.length || 0) * 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Measure verbosity (0 = concise, 1 = verbose)
   */
  private measureVerbosity(text: string): number {
    const words = text.split(/\s+/).length;
    const sentences = text.split(/[.!?]+/).length;
    const avgWordsPerSentence = words / Math.max(1, sentences);

    // Map to 0-1 scale: <10 words/sentence = concise, >25 = verbose
    return Math.max(0, Math.min(1, (avgWordsPerSentence - 10) / 15));
  }

  /**
   * Measure technicality (0 = simple, 1 = technical)
   */
  private measureTechnicality(text: string): number {
    const techTerms = [
      /\b(api|sdk|cli|gui|ui|ux|db|sql|css|html|json|xml|yaml)\b/gi,
      /\b(function|class|method|variable|parameter|argument)\b/gi,
      /\b(async|await|promise|callback|thread|mutex|semaphore)\b/gi,
      /\b(deploy|compile|build|runtime|debug|refactor)\b/gi,
      /\b(algorithm|complexity|optimization|iteration|recursion)\b/gi,
    ];

    let techCount = 0;
    for (const pattern of techTerms) {
      const matches = text.match(pattern);
      techCount += matches?.length || 0;
    }

    const words = text.split(/\s+/).length;
    const techRatio = techCount / Math.max(1, words);

    // Scale: 0% tech terms = 0, 10%+ = 1
    return Math.min(1, techRatio * 10);
  }

  /**
   * Measure emotiveness (0 = neutral, 1 = emotive)
   */
  private measureEmotiveness(text: string): number {
    const emotivePatterns = [
      /[!]{1,}/g, // Exclamation marks
      /\b(love|hate|amazing|terrible|awesome|awful|great|horrible)\b/gi,
      /\b(excited|frustrated|happy|angry|annoyed|pleased|thrilled)\b/gi,
      /\b(really|very|so|extremely|incredibly|absolutely)\b/gi,
    ];

    let emotiveCount = 0;
    for (const pattern of emotivePatterns) {
      const matches = text.match(pattern);
      emotiveCount += matches?.length || 0;
    }

    const words = text.split(/\s+/).length;
    const emotiveRatio = emotiveCount / Math.max(1, words);

    return Math.min(1, emotiveRatio * 5);
  }

  /**
   * Measure directness (0 = indirect, 1 = direct)
   */
  private measureDirectness(text: string): number {
    let score = 0.5;

    // Direct indicators
    const directPatterns = [
      /^(?:do|make|create|add|remove|fix|update|change)/i, // Imperative start
      /\b(must|need to|should|have to)\b/gi,
    ];

    // Indirect indicators
    const indirectPatterns = [
      /\b(maybe|perhaps|possibly|might|could|would it be possible)\b/gi,
      /\b(I was wondering|I think|I believe|It seems like)\b/gi,
    ];

    for (const pattern of directPatterns) {
      if (pattern.test(text)) {
        score += 0.2;
      }
    }

    for (const pattern of indirectPatterns) {
      const matches = text.match(pattern);
      score -= (matches?.length || 0) * 0.15;
    }

    return Math.max(0, Math.min(1, score));
  }
}

// ============================================================================
// Knowledge Graph Builder
// ============================================================================

export class KnowledgeGraphBuilder {
  private nodes: Map<string, KnowledgeNode> = new Map();
  private edges: KnowledgeEdge[] = [];

  /**
   * Build/update knowledge graph from conversation
   */
  buildFromConversation(turns: ConversationTurn[]): void {
    for (const turn of turns) {
      if (turn.role !== 'user') continue;

      // Extract entities and concepts
      this.extractEntities(turn.content, turn.timestamp);
      this.extractRelations(turn.content);
    }
  }

  /**
   * Extract entities from text
   */
  private extractEntities(text: string, timestamp: number): void {
    // Technology/tool names
    const techPattern = /\b([A-Z][a-z]+(?:\.js|\.ts|\.py)?|[a-z]+(?:\.js|\.ts|\.py))\b/g;
    const techs = text.match(techPattern) || [];

    for (const tech of techs) {
      this.addOrUpdateNode({
        id: `tech_${tech.toLowerCase()}`,
        type: 'entity',
        label: tech,
        properties: { category: 'technology' },
        mentions: 1,
        lastMentioned: timestamp,
      });
    }

    // Project/file names
    const filePattern = /\b([\w-]+\.(js|ts|py|css|html|json|yaml|yml|md|txt))\b/gi;
    const files = text.match(filePattern) || [];

    for (const file of files) {
      this.addOrUpdateNode({
        id: `file_${file.toLowerCase()}`,
        type: 'entity',
        label: file,
        properties: { category: 'file' },
        mentions: 1,
        lastMentioned: timestamp,
      });
    }

    // Actions/verbs
    const actionPattern =
      /\b(create|build|fix|update|add|remove|refactor|test|deploy|implement)\s+(\w+(?:\s+\w+)?)/gi;
    let match;
    while ((match = actionPattern.exec(text)) !== null) {
      const action = match[1].toLowerCase();
      const target = match[2].toLowerCase();

      this.addOrUpdateNode({
        id: `action_${action}`,
        type: 'action',
        label: action,
        properties: {},
        mentions: 1,
        lastMentioned: timestamp,
      });

      // Add edge: action -> target
      this.addEdge(`action_${action}`, `concept_${target}`, 'targets', text.slice(0, 100));
    }
  }

  /**
   * Extract relations from text
   */
  private extractRelations(text: string): void {
    // "X uses Y" patterns
    const usesPattern = /(\w+)\s+(?:uses?|with|using)\s+(\w+)/gi;
    let match;
    while ((match = usesPattern.exec(text)) !== null) {
      this.addEdge(
        `concept_${match[1].toLowerCase()}`,
        `concept_${match[2].toLowerCase()}`,
        'uses',
        text.slice(0, 100)
      );
    }

    // "X depends on Y" patterns
    const dependsPattern = /(\w+)\s+(?:depends on|requires|needs)\s+(\w+)/gi;
    while ((match = dependsPattern.exec(text)) !== null) {
      this.addEdge(
        `concept_${match[1].toLowerCase()}`,
        `concept_${match[2].toLowerCase()}`,
        'depends_on',
        text.slice(0, 100)
      );
    }
  }

  /**
   * Add or update a node
   */
  private addOrUpdateNode(node: KnowledgeNode): void {
    const existing = this.nodes.get(node.id);
    if (existing) {
      existing.mentions += node.mentions;
      existing.lastMentioned = Math.max(existing.lastMentioned, node.lastMentioned);
    } else {
      this.nodes.set(node.id, { ...node });
    }
  }

  /**
   * Add an edge
   */
  private addEdge(from: string, to: string, relation: string, evidence: string): void {
    // Ensure nodes exist
    if (!this.nodes.has(from)) {
      this.nodes.set(from, {
        id: from,
        type: 'concept',
        label: from.replace(/^\w+_/, ''),
        properties: {},
        mentions: 1,
        lastMentioned: Date.now(),
      });
    }
    if (!this.nodes.has(to)) {
      this.nodes.set(to, {
        id: to,
        type: 'concept',
        label: to.replace(/^\w+_/, ''),
        properties: {},
        mentions: 1,
        lastMentioned: Date.now(),
      });
    }

    // Check for existing edge
    const existing = this.edges.find(
      (e) => e.from === from && e.to === to && e.relation === relation
    );
    if (existing) {
      existing.weight += 1;
      if (existing.evidence.length < 5) {
        existing.evidence.push(evidence);
      }
    } else {
      this.edges.push({
        from,
        to,
        relation,
        weight: 1,
        evidence: [evidence],
      });
    }
  }

  /**
   * Get nodes
   */
  getNodes(): Map<string, KnowledgeNode> {
    return this.nodes;
  }

  /**
   * Get edges
   */
  getEdges(): KnowledgeEdge[] {
    return this.edges;
  }

  /**
   * Get subgraph around a node
   */
  getSubgraph(
    nodeId: string,
    depth: number = 2
  ): { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] } {
    const visited = new Set<string>();
    const resultNodes: KnowledgeNode[] = [];
    const resultEdges: KnowledgeEdge[] = [];

    const traverse = (id: string, d: number): void => {
      if (d > depth || visited.has(id)) return;
      visited.add(id);

      const node = this.nodes.get(id);
      if (node) resultNodes.push(node);

      // Find connected edges
      for (const edge of this.edges) {
        if (edge.from === id || edge.to === id) {
          resultEdges.push(edge);
          const otherId = edge.from === id ? edge.to : edge.from;
          traverse(otherId, d + 1);
        }
      }
    };

    traverse(nodeId, 0);
    return { nodes: resultNodes, edges: resultEdges };
  }

  /**
   * Get most important nodes
   */
  getTopNodes(topK: number = 20): KnowledgeNode[] {
    return Array.from(this.nodes.values())
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, topK);
  }

  /**
   * Clear graph
   */
  clear(): void {
    this.nodes.clear();
    this.edges = [];
  }
}

// ============================================================================
// Model Compressor
// ============================================================================

export class ModelCompressor {
  private dimension: number;

  constructor(dimension: number = 512) {
    this.dimension = dimension;
  }

  /**
   * Compress user model to fixed-size embedding
   */
  compressModel(model: UserModel): Float64Array {
    const embedding = new Float64Array(this.dimension);

    // Encode style profile
    this.encodeStyle(model.styleProfile, embedding, 0);

    // Encode preferences
    this.encodePreferences(model.preferences, embedding, 10);

    // Encode constraints
    this.encodeConstraints(model.constraints, embedding, 100);

    // Encode patterns
    this.encodePatterns(model.patterns, embedding, 200);

    // Normalize
    const norm = Math.sqrt(embedding.reduce((a, b) => a + b * b, 0)) || 1;
    for (let i = 0; i < this.dimension; i++) {
      embedding[i] /= norm;
    }

    return embedding;
  }

  /**
   * Encode style profile
   */
  private encodeStyle(style: StyleProfile, embedding: Float64Array, offset: number): void {
    embedding[offset] = style.formality;
    embedding[offset + 1] = style.verbosity;
    embedding[offset + 2] = style.technicality;
    embedding[offset + 3] = style.emotiveness;
    embedding[offset + 4] = style.directness;
  }

  /**
   * Encode preferences
   */
  private encodePreferences(
    prefs: UserPreference[],
    embedding: Float64Array,
    offset: number
  ): void {
    for (let i = 0; i < Math.min(prefs.length, 45); i++) {
      const pref = prefs[i];
      const idx = offset + i * 2;

      // Encode preference direction and confidence
      embedding[idx] = pref.positive ? pref.confidence : -pref.confidence;
      embedding[idx + 1] = this.hashToFloat(pref.category + pref.preference);
    }
  }

  /**
   * Encode constraints
   */
  private encodeConstraints(
    constraints: Constraint[],
    embedding: Float64Array,
    offset: number
  ): void {
    for (let i = 0; i < Math.min(constraints.length, 50); i++) {
      const constraint = constraints[i];
      const idx = offset + i * 2;

      embedding[idx] = constraint.priority * (1 - constraint.softness);
      embedding[idx + 1] = this.hashToFloat(constraint.rule);
    }
  }

  /**
   * Encode patterns
   */
  private encodePatterns(
    patterns: ExtractedPattern[],
    embedding: Float64Array,
    offset: number
  ): void {
    for (let i = 0; i < Math.min(patterns.length, 150); i++) {
      const pattern = patterns[i];
      const idx = offset + i * 2;

      embedding[idx] = (pattern.confidence * pattern.frequency) / 10;
      embedding[idx + 1] = this.hashToFloat(pattern.pattern);
    }
  }

  /**
   * Hash string to float in [-1, 1]
   */
  private hashToFloat(s: string): number {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      const char = s.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return (hash % 1000) / 500 - 1;
  }

  /**
   * Generate text summary from model
   */
  generateSummary(model: UserModel): string {
    const parts: string[] = [];

    // Style summary
    const styleDesc = [];
    if (model.styleProfile.formality > 0.7) styleDesc.push('formal');
    else if (model.styleProfile.formality < 0.3) styleDesc.push('casual');

    if (model.styleProfile.verbosity > 0.7) styleDesc.push('verbose');
    else if (model.styleProfile.verbosity < 0.3) styleDesc.push('concise');

    if (model.styleProfile.technicality > 0.7) styleDesc.push('technical');
    if (model.styleProfile.directness > 0.7) styleDesc.push('direct');

    if (styleDesc.length > 0) {
      parts.push(`Communication style: ${styleDesc.join(', ')}`);
    }

    // Top preferences
    const topPrefs = model.preferences
      .filter((p) => p.confidence > 0.5)
      .slice(0, 5)
      .map((p) => `${p.positive ? 'Prefers' : 'Avoids'}: ${p.preference}`);

    if (topPrefs.length > 0) {
      parts.push(`Key preferences: ${topPrefs.join('; ')}`);
    }

    // Top patterns
    const topPatterns = model.patterns
      .filter((p) => p.confidence > 0.5)
      .slice(0, 5)
      .map((p) => `${p.type}: ${p.pattern}`);

    if (topPatterns.length > 0) {
      parts.push(`Common patterns: ${topPatterns.join('; ')}`);
    }

    // Constraints
    const hardConstraints = model.constraints
      .filter((c) => c.softness < 0.3)
      .slice(0, 3)
      .map((c) => c.rule);

    if (hardConstraints.length > 0) {
      parts.push(`Constraints: ${hardConstraints.join('; ')}`);
    }

    return parts.join('\n');
  }
}

// ============================================================================
// Main Recursive Distillation Service
// ============================================================================

export class RecursiveDistiller extends EventEmitter {
  private patternExtractor: PatternExtractor;
  private styleAnalyzer: StyleAnalyzer;
  private knowledgeBuilder: KnowledgeGraphBuilder;
  private modelCompressor: ModelCompressor;

  private conversationBuffer: ConversationTurn[] = [];
  private userModels: Map<string, UserModel> = new Map();

  private distillationInterval: ReturnType<typeof setInterval> | null = null;
  private bufferThreshold: number = 50;
  private autoDistill: boolean = false;

  constructor() {
    super();
    this.patternExtractor = new PatternExtractor();
    this.styleAnalyzer = new StyleAnalyzer();
    this.knowledgeBuilder = new KnowledgeGraphBuilder();
    this.modelCompressor = new ModelCompressor(512);
  }

  /**
   * Add a conversation turn
   */
  addTurn(turn: ConversationTurn): void {
    this.conversationBuffer.push(turn);
    this.emit('turnAdded', turn);

    // Auto-distill if buffer exceeds threshold
    if (this.autoDistill && this.conversationBuffer.length >= this.bufferThreshold) {
      this.distill(turn.sessionId);
    }
  }

  /**
   * Add multiple turns at once
   */
  addConversation(turns: ConversationTurn[]): void {
    for (const turn of turns) {
      this.conversationBuffer.push(turn);
    }
    this.emit('conversationAdded', { count: turns.length });
  }

  /**
   * Run distillation cycle
   */
  distill(userId: string = 'default'): DistillationResult {
    // Get or create user model
    let model = this.userModels.get(userId);
    if (!model) {
      model = this.createEmptyModel(userId);
      this.userModels.set(userId, model);
    }

    const startPatterns = model.patterns.length;
    const startPrefs = model.preferences.length;

    // Get user turns from buffer
    const userTurns = this.conversationBuffer.filter(
      (t) => t.sessionId.startsWith(userId) || userId === 'default'
    );

    // Extract patterns
    const newPatterns = this.patternExtractor.extractPatterns(userTurns);
    this.mergePatterns(model, newPatterns);

    // Analyze and update style
    const userMessages = userTurns.filter((t) => t.role === 'user').map((t) => t.content);

    const newStyle = this.styleAnalyzer.analyzeStyle(userMessages);
    this.mergeStyle(model, newStyle);

    // Extract constraints
    const newConstraints = this.extractConstraints(userTurns);
    this.mergeConstraints(model, newConstraints);

    // Extract preferences
    const newPrefs = this.extractPreferences(userTurns);
    this.mergePreferences(model, newPrefs);

    // Build knowledge graph
    this.knowledgeBuilder.buildFromConversation(userTurns);
    model.nodes = this.knowledgeBuilder.getNodes();
    model.edges = this.knowledgeBuilder.getEdges();

    // Compress model
    model.embedding = this.modelCompressor.compressModel(model);
    model.summary = this.modelCompressor.generateSummary(model);

    // Update metadata
    model.updatedAt = Date.now();
    model.version++;
    model.totalTurns += userTurns.length;
    model.distillationCycles++;

    // Clear processed turns from buffer
    this.conversationBuffer = this.conversationBuffer.filter(
      (t) => !(t.sessionId.startsWith(userId) || userId === 'default')
    );

    const result: DistillationResult = {
      patternsExtracted: model.patterns.length - startPatterns,
      preferencesUpdated: model.preferences.length - startPrefs,
      constraintsFound: model.constraints.length,
      compressionRatio: model.embedding
        ? (model.totalTurns * 500) / (model.embedding.length * 8)
        : 1,
      modelVersion: model.version,
    };

    this.emit('distillationComplete', { userId, result });
    return result;
  }

  /**
   * Create empty user model
   */
  private createEmptyModel(userId: string): UserModel {
    return {
      userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 0,
      preferences: [],
      constraints: [],
      styleProfile: {
        formality: 0.5,
        verbosity: 0.5,
        technicality: 0.5,
        emotiveness: 0.5,
        directness: 0.5,
        samples: [],
      },
      patterns: [],
      nodes: new Map(),
      edges: [],
      totalConversations: 0,
      totalTurns: 0,
      distillationCycles: 0,
    };
  }

  /**
   * Extract constraints from turns
   */
  private extractConstraints(turns: ConversationTurn[]): Constraint[] {
    const constraints: Constraint[] = [];
    const constraintPatterns = [
      /(?:must|always)\s+(.+?)(?:\.|$)/gi,
      /(?:never|don't ever)\s+(.+?)(?:\.|$)/gi,
      /(?:make sure|ensure)\s+(.+?)(?:\.|$)/gi,
    ];

    for (const turn of turns) {
      if (turn.role !== 'user') continue;

      for (const pattern of constraintPatterns) {
        const matches = turn.content.matchAll(new RegExp(pattern));
        for (const match of matches) {
          const rule = match[1]?.trim();
          if (rule && rule.length > 5 && rule.length < 200) {
            const isNegative = /never|don't/i.test(match[0]);

            constraints.push({
              id: `c_${this.hashString(rule)}`,
              rule: isNegative ? `Do not ${rule}` : rule,
              context: [turn.content.slice(0, 100)],
              priority: isNegative ? 0.9 : 0.7,
              softness: 0.2,
            });
          }
        }
      }
    }

    return constraints;
  }

  /**
   * Extract preferences from turns
   */
  private extractPreferences(turns: ConversationTurn[]): UserPreference[] {
    const prefs: UserPreference[] = [];

    const positivePatterns = [/i (?:prefer|like|love|want)\s+(.+?)(?:\.|,|$)/gi];

    const negativePatterns = [/i (?:don't like|hate|dislike|don't want)\s+(.+?)(?:\.|,|$)/gi];

    for (const turn of turns) {
      if (turn.role !== 'user') continue;

      // Positive preferences
      for (const pattern of positivePatterns) {
        const matches = turn.content.matchAll(new RegExp(pattern));
        for (const match of matches) {
          const pref = match[1]?.trim();
          if (pref && pref.length > 3) {
            prefs.push({
              category: this.categorizePreference(pref),
              preference: pref,
              positive: true,
              confidence: 0.7,
              evidence: [turn.content.slice(0, 100)],
            });
          }
        }
      }

      // Negative preferences
      for (const pattern of negativePatterns) {
        const matches = turn.content.matchAll(new RegExp(pattern));
        for (const match of matches) {
          const pref = match[1]?.trim();
          if (pref && pref.length > 3) {
            prefs.push({
              category: this.categorizePreference(pref),
              preference: pref,
              positive: false,
              confidence: 0.7,
              evidence: [turn.content.slice(0, 100)],
            });
          }
        }
      }
    }

    return prefs;
  }

  /**
   * Categorize a preference
   */
  private categorizePreference(pref: string): string {
    const categories: Array<{ name: string; keywords: string[] }> = [
      {
        name: 'code_style',
        keywords: ['tabs', 'spaces', 'indent', 'format', 'style', 'naming'],
      },
      {
        name: 'technology',
        keywords: ['framework', 'library', 'tool', 'language', 'database'],
      },
      {
        name: 'workflow',
        keywords: ['process', 'step', 'first', 'before', 'after'],
      },
      {
        name: 'communication',
        keywords: ['explain', 'verbose', 'brief', 'detailed', 'simple'],
      },
      {
        name: 'output',
        keywords: ['output', 'return', 'result', 'response', 'format'],
      },
    ];

    const prefLower = pref.toLowerCase();
    for (const cat of categories) {
      for (const keyword of cat.keywords) {
        if (prefLower.includes(keyword)) {
          return cat.name;
        }
      }
    }

    return 'general';
  }

  /**
   * Merge new patterns into model
   */
  private mergePatterns(model: UserModel, newPatterns: ExtractedPattern[]): void {
    for (const newPattern of newPatterns) {
      const existing = model.patterns.find((p) => p.id === newPattern.id);
      if (existing) {
        existing.frequency += newPattern.frequency;
        existing.confidence = Math.max(existing.confidence, newPattern.confidence);
        existing.lastSeen = Math.max(existing.lastSeen, newPattern.lastSeen);
        existing.examples.push(...newPattern.examples);
        if (existing.examples.length > 10) {
          existing.examples = existing.examples.slice(-10);
        }
      } else {
        model.patterns.push({ ...newPattern });
      }
    }

    // Sort by confidence * frequency
    model.patterns.sort((a, b) => b.confidence * b.frequency - a.confidence * a.frequency);

    // Keep top patterns
    if (model.patterns.length > 200) {
      model.patterns = model.patterns.slice(0, 200);
    }
  }

  /**
   * Merge style profile (exponential moving average)
   */
  private mergeStyle(model: UserModel, newStyle: StyleProfile): void {
    const alpha = 0.3; // Weight of new data

    model.styleProfile.formality =
      (1 - alpha) * model.styleProfile.formality + alpha * newStyle.formality;
    model.styleProfile.verbosity =
      (1 - alpha) * model.styleProfile.verbosity + alpha * newStyle.verbosity;
    model.styleProfile.technicality =
      (1 - alpha) * model.styleProfile.technicality + alpha * newStyle.technicality;
    model.styleProfile.emotiveness =
      (1 - alpha) * model.styleProfile.emotiveness + alpha * newStyle.emotiveness;
    model.styleProfile.directness =
      (1 - alpha) * model.styleProfile.directness + alpha * newStyle.directness;

    // Add new samples
    model.styleProfile.samples.push(...newStyle.samples);
    if (model.styleProfile.samples.length > 20) {
      model.styleProfile.samples = model.styleProfile.samples.slice(-20);
    }
  }

  /**
   * Merge constraints
   */
  private mergeConstraints(model: UserModel, newConstraints: Constraint[]): void {
    for (const newConstraint of newConstraints) {
      const existing = model.constraints.find((c) => c.id === newConstraint.id);
      if (existing) {
        existing.priority = Math.max(existing.priority, newConstraint.priority);
        existing.context.push(...newConstraint.context);
        if (existing.context.length > 5) {
          existing.context = existing.context.slice(-5);
        }
      } else {
        model.constraints.push({ ...newConstraint });
      }
    }

    // Sort by priority
    model.constraints.sort((a, b) => b.priority - a.priority);

    // Keep top constraints
    if (model.constraints.length > 50) {
      model.constraints = model.constraints.slice(0, 50);
    }
  }

  /**
   * Merge preferences
   */
  private mergePreferences(model: UserModel, newPrefs: UserPreference[]): void {
    for (const newPref of newPrefs) {
      const existing = model.preferences.find(
        (p) =>
          p.category === newPref.category &&
          p.preference.toLowerCase() === newPref.preference.toLowerCase()
      );

      if (existing) {
        // Update confidence and evidence
        existing.confidence = Math.max(existing.confidence, newPref.confidence);
        existing.evidence.push(...newPref.evidence);
        if (existing.evidence.length > 5) {
          existing.evidence = existing.evidence.slice(-5);
        }
      } else {
        model.preferences.push({ ...newPref });
      }
    }

    // Sort by confidence
    model.preferences.sort((a, b) => b.confidence - a.confidence);

    // Keep top preferences
    if (model.preferences.length > 100) {
      model.preferences = model.preferences.slice(0, 100);
    }
  }

  /**
   * Simple hash function
   */
  private hashString(s: string): string {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      const char = s.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get user model
   */
  getModel(userId: string): UserModel | undefined {
    return this.userModels.get(userId);
  }

  /**
   * Get model summary
   */
  getModelSummary(userId: string): string | undefined {
    return this.userModels.get(userId)?.summary;
  }

  /**
   * Get model embedding
   */
  getModelEmbedding(userId: string): Float64Array | undefined {
    return this.userModels.get(userId)?.embedding;
  }

  /**
   * Start automatic distillation
   */
  startAutoDistill(intervalMs: number = 60000): void {
    this.autoDistill = true;

    if (this.distillationInterval) {
      clearInterval(this.distillationInterval);
    }

    this.distillationInterval = setInterval(() => {
      // Distill for each active user
      const sessions = new Set(this.conversationBuffer.map((t) => t.sessionId.split('_')[0]));
      for (const userId of sessions) {
        if (this.conversationBuffer.filter((t) => t.sessionId.startsWith(userId)).length >= 10) {
          this.distill(userId);
        }
      }
    }, intervalMs);

    this.emit('autoDistillStarted', { intervalMs });
  }

  /**
   * Stop automatic distillation
   */
  stopAutoDistill(): void {
    this.autoDistill = false;
    if (this.distillationInterval) {
      clearInterval(this.distillationInterval);
      this.distillationInterval = null;
    }
    this.emit('autoDistillStopped');
  }

  /**
   * Set buffer threshold
   */
  setBufferThreshold(threshold: number): void {
    this.bufferThreshold = threshold;
  }

  /**
   * Get knowledge graph for user
   */
  getKnowledgeGraph(
    userId: string
  ): { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] } | undefined {
    const model = this.userModels.get(userId);
    if (!model) return undefined;

    return {
      nodes: Array.from(model.nodes.values()),
      edges: model.edges,
    };
  }

  /**
   * Get statistics
   */
  getStats(): {
    bufferSize: number;
    userCount: number;
    totalPatterns: number;
    totalPreferences: number;
    totalConstraints: number;
  } {
    let totalPatterns = 0;
    let totalPreferences = 0;
    let totalConstraints = 0;

    for (const model of this.userModels.values()) {
      totalPatterns += model.patterns.length;
      totalPreferences += model.preferences.length;
      totalConstraints += model.constraints.length;
    }

    return {
      bufferSize: this.conversationBuffer.length,
      userCount: this.userModels.size,
      totalPatterns,
      totalPreferences,
      totalConstraints,
    };
  }

  /**
   * Export model for persistence
   */
  exportModel(userId: string):
    | {
        model: Omit<UserModel, 'nodes' | 'edges'> & {
          nodes: Array<[string, KnowledgeNode]>;
          edges: KnowledgeEdge[];
        };
      }
    | undefined {
    const model = this.userModels.get(userId);
    if (!model) return undefined;

    return {
      model: {
        ...model,
        nodes: Array.from(model.nodes.entries()),
        edges: model.edges,
        embedding: model.embedding
          ? (Array.from(model.embedding) as unknown as Float64Array)
          : undefined,
      },
    };
  }

  /**
   * Import model from persistence
   */
  importModel(data: {
    model: Omit<UserModel, 'nodes' | 'edges' | 'embedding'> & {
      nodes: Array<[string, KnowledgeNode]>;
      edges: KnowledgeEdge[];
      embedding?: number[] | Float64Array;
    };
  }): void {
    const model: UserModel = {
      ...data.model,
      nodes: new Map(data.model.nodes),
      edges: data.model.edges,
      embedding: data.model.embedding
        ? data.model.embedding instanceof Float64Array
          ? data.model.embedding
          : new Float64Array(data.model.embedding)
        : undefined,
    };

    this.userModels.set(model.userId, model);
    this.emit('modelImported', { userId: model.userId });
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.conversationBuffer = [];
    this.userModels.clear();
    this.knowledgeBuilder.clear();
    this.emit('cleared');
  }
}

// ============================================================================
// Singleton Service
// ============================================================================

export class RecursiveDistillationService {
  private static instance: RecursiveDistillationService;
  private distiller: RecursiveDistiller;

  private constructor() {
    this.distiller = new RecursiveDistiller();
  }

  static getInstance(): RecursiveDistillationService {
    if (!RecursiveDistillationService.instance) {
      RecursiveDistillationService.instance = new RecursiveDistillationService();
    }
    return RecursiveDistillationService.instance;
  }

  /**
   * Get the distiller instance
   */
  getDistiller(): RecursiveDistiller {
    return this.distiller;
  }

  /**
   * Convenience: Add conversation turn
   */
  addTurn(turn: ConversationTurn): void {
    this.distiller.addTurn(turn);
  }

  /**
   * Convenience: Run distillation
   */
  distill(userId?: string): DistillationResult {
    return this.distiller.distill(userId);
  }

  /**
   * Convenience: Get user model
   */
  getModel(userId: string): UserModel | undefined {
    return this.distiller.getModel(userId);
  }

  /**
   * Convenience: Get model summary
   */
  getSummary(userId: string): string | undefined {
    return this.distiller.getModelSummary(userId);
  }
}

export default RecursiveDistillationService;
