//! Verdict Integration Layer for Chat
//! Bridges the intent compiler verdict system with the chat interface.
//! Enables founders to get real-time verdicts through natural conversation.

// ============================================================================
// Verdict Request/Response Types
// ============================================================================

export interface VerdictQuery {
  type: 'founder_analysis' | 'batch_upload' | 'network_analysis' | 'market_check';
  content: string;
  founder_id?: string;
  github_handle?: string;
  twitter_handle?: string;
  market_domain?: string;
  team_size?: number;
  funding_stage?: string;
  timestamp: string;
}

export interface VerdictResult {
  request_id: string;
  verdict: string;
  confidence: number;
  success_probability: number;
  analysis: {
    semantic: {
      intent_type: string;
      complexity_score: number;
      clarity_score: number;
      extracted_features: string[];
    };
    psychology: {
      archetype: string;
      consistency: number;
      learning_orientation: number;
      resilience: number;
      burnout_risk: number;
    };
    market: {
      tam: string;
      growth_rate: number;
      competition: string;
      opportunity_score: number;
    };
    network: {
      size: number;
      mentor_strength: number;
      investor_credibility: number;
      peer_quality: number;
      winning_pattern: string;
    };
    ml_prediction: {
      success_probability: number;
      revenue_potential: string;
      success_factors: string[];
      risk_factors: string[];
    };
  };
  implicit_requirements: string[];
  contradictions: string[];
  reasoning: string[];
  timestamp: string;
}

// ============================================================================
// Chat Command Parser
// ============================================================================

export function parseVerdictCommand(message: string): VerdictQuery | null {
  // Pattern 1: "analyze @github_handle on twitter_handle for [idea]"
  const analyzeMatch = message.match(
    /analyze\s+(?:@?(\w+))?\s+(?:on\s+twitter\s+(?:@)?(\w+))?\s+(?:for\s+)?(.+)/i
  );
  if (analyzeMatch) {
    return {
      type: 'founder_analysis',
      content: message,
      github_handle: analyzeMatch[1],
      twitter_handle: analyzeMatch[2],
      market_domain: analyzeMatch[3],
      timestamp: new Date().toISOString(),
    };
  }

  // Pattern 2: "what's the verdict on [idea]?"
  const verdictMatch = message.match(/what'?s?\s+(?:the\s+)?verdict\s+on\s+(.+)\??/i);
  if (verdictMatch) {
    return {
      type: 'founder_analysis',
      content: message,
      market_domain: verdictMatch[1],
      timestamp: new Date().toISOString(),
    };
  }

  // Pattern 3: "network analysis for [founder_id]"
  const networkMatch = message.match(/network\s+(?:analysis\s+)?for\s+(\w+)/i);
  if (networkMatch) {
    return {
      type: 'network_analysis',
      content: message,
      founder_id: networkMatch[1],
      timestamp: new Date().toISOString(),
    };
  }

  // Pattern 4: "batch upload [csv link or data]"
  const batchMatch = message.match(/batch\s+(?:upload|analyze)\s+(.+)/i);
  if (batchMatch) {
    return {
      type: 'batch_upload',
      content: message,
      market_domain: batchMatch[1],
      timestamp: new Date().toISOString(),
    };
  }

  // Pattern 5: "market check for [domain]"
  const marketMatch = message.match(/market\s+check\s+(?:for\s+)?(.+)/i);
  if (marketMatch) {
    return {
      type: 'market_check',
      content: message,
      market_domain: marketMatch[1],
      timestamp: new Date().toISOString(),
    };
  }

  return null;
}

// ============================================================================
// Verdict Generation (Simulated - connects to actual engine)
// ============================================================================

export async function getVerdictFromEngine(_query: VerdictQuery): Promise<VerdictResult> {
  // In production, this would call the actual Rust verdict API
  // For now, simulate the response structure

  const mockResult: VerdictResult = {
    request_id: `req_${Date.now()}`,
    verdict: 'BuildNow',
    confidence: 0.78,
    success_probability: 0.73,
    analysis: {
      semantic: {
        intent_type: 'CREATE',
        complexity_score: 0.72,
        clarity_score: 0.85,
        extracted_features: ['user authentication', 'team collaboration', 'real-time features'],
      },
      psychology: {
        archetype: 'Builder',
        consistency: 0.78,
        learning_orientation: 0.85,
        resilience: 0.82,
        burnout_risk: 0.15,
      },
      market: {
        tam: '$2.5B',
        growth_rate: 0.35,
        competition: 'Moderate (12 competitors)',
        opportunity_score: 0.78,
      },
      network: {
        size: 45,
        mentor_strength: 0.78,
        investor_credibility: 0.68,
        peer_quality: 0.75,
        winning_pattern: 'Strong learning network + investor access',
      },
      ml_prediction: {
        success_probability: 0.73,
        revenue_potential: '$1-10M ARR by year 3',
        success_factors: [
          'Strong founder fundamentals',
          'Clear market gap',
          'Good network support',
          'Growing demand',
        ],
        risk_factors: ['Market timing risk', 'Competitive pressure', 'Execution complexity'],
      },
    },
    implicit_requirements: [
      'Customer validation needed before heavy investment',
      'Build MVP in 6 weeks to test market fit',
      'Focus on founder work-life balance',
    ],
    contradictions: ['Feature scope vs minimal MVP approach'],
    reasoning: [
      'Strong founder fundamentals based on GitHub signals',
      'Adequate market opportunity',
      'Solid network support',
      'High resilience and learning capacity',
    ],
    timestamp: new Date().toISOString(),
  };

  return mockResult;
}

// ============================================================================
// Chat Message Formatting
// ============================================================================

export function formatVerdictForChat(result: VerdictResult): string {
  const verdictLabel =
    {
      BuildNow: '[BUILD NOW]',
      BuildButPivot: '[PIVOT]',
      Skip: '[SKIP]',
      ThinkHarder: '[RECONSIDER]',
    }[result.verdict] || '[VERDICT]';

  return `
${verdictLabel} **VERDICT: ${result.verdict}**
Confidence: ${(result.confidence * 100).toFixed(0)}% | Success Probability: ${(result.success_probability * 100).toFixed(0)}%

**Semantic Analysis:**
- Intent Type: ${result.analysis.semantic.intent_type}
- Complexity: ${(result.analysis.semantic.complexity_score * 100).toFixed(0)}%
- Clarity: ${(result.analysis.semantic.clarity_score * 100).toFixed(0)}%
- Features: ${result.analysis.semantic.extracted_features.join(', ')}

**Founder Psychology:**
- Archetype: ${result.analysis.psychology.archetype}
- Consistency: ${(result.analysis.psychology.consistency * 100).toFixed(0)}%
- Learning Orientation: ${(result.analysis.psychology.learning_orientation * 100).toFixed(0)}%
- Resilience: ${(result.analysis.psychology.resilience * 100).toFixed(0)}%
- Burnout Risk: ${(result.analysis.psychology.burnout_risk * 100).toFixed(0)}% [!]

**Market Intelligence:**
- TAM: ${result.analysis.market.tam}
- Growth Rate: ${(result.analysis.market.growth_rate * 100).toFixed(0)}% YoY
- Competition: ${result.analysis.market.competition}
- Opportunity Score: ${(result.analysis.market.opportunity_score * 100).toFixed(0)}%

**Network Analysis:**
- Network Size: ${result.analysis.network.size} connections
- Mentor Strength: ${(result.analysis.network.mentor_strength * 100).toFixed(0)}%
- Investor Credibility: ${(result.analysis.network.investor_credibility * 100).toFixed(0)}%
- Peer Quality: ${(result.analysis.network.peer_quality * 100).toFixed(0)}%
- Pattern: ${result.analysis.network.winning_pattern}

**ML Prediction:**
- Success Probability: ${(result.analysis.ml_prediction.success_probability * 100).toFixed(0)}%
- Revenue Potential: ${result.analysis.ml_prediction.revenue_potential}
- Top Success Factors:
${result.analysis.ml_prediction.success_factors.map((f) => `  + ${f}`).join('\n')}
- Top Risk Factors:
${result.analysis.ml_prediction.risk_factors.map((f) => `  ! ${f}`).join('\n')}

**Implicit Requirements:**
${result.implicit_requirements.map((r) => `- ${r}`).join('\n')}

**Contradictions:**
${result.contradictions.length > 0 ? result.contradictions.map((c) => `- ${c}`).join('\n') : 'None detected'}

**Reasoning:**
${result.reasoning.map((r) => `- ${r}`).join('\n')}
  `;
}

// ============================================================================
// Stream Verdict Response
// ============================================================================

export async function* streamVerdictResponse(
  result: VerdictResult
): AsyncGenerator<string, void, unknown> {
  const sections = [
    {
      label: '[VERDICT]',
      content: `${result.verdict} (${(result.confidence * 100).toFixed(0)}% confidence)`,
    },
    {
      label: '[SEMANTIC]',
      content: `Intent: ${result.analysis.semantic.intent_type}, Clarity: ${(result.analysis.semantic.clarity_score * 100).toFixed(0)}%`,
    },
    {
      label: '[PSYCHOLOGY]',
      content: `${result.analysis.psychology.archetype} archetype, Resilience: ${(result.analysis.psychology.resilience * 100).toFixed(0)}%`,
    },
    {
      label: '[MARKET]',
      content: `TAM: ${result.analysis.market.tam}, Growth: ${(result.analysis.market.growth_rate * 100).toFixed(0)}%`,
    },
    {
      label: '[NETWORK]',
      content: `${result.analysis.network.size} connections, Pattern: ${result.analysis.network.winning_pattern}`,
    },
    {
      label: '[ML PREDICTION]',
      content: `Success: ${(result.analysis.ml_prediction.success_probability * 100).toFixed(0)}%, Revenue: ${result.analysis.ml_prediction.revenue_potential}`,
    },
  ];

  for (const section of sections) {
    yield `**${section.label}**\n${section.content}\n\n`;
    // Simulate streaming delay
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}

// ============================================================================
// Chat Integration Hook
// ============================================================================

export async function processVerdictInChat(
  userMessage: string,
  onStream: (chunk: string) => void
): Promise<VerdictResult | null> {
  const query = parseVerdictCommand(userMessage);

  if (!query) {
    return null;
  }

  // Show thinking indicator
  onStream('[ANALYZING] Analyzing founder intent and market opportunity...\n');
  await new Promise((resolve) => setTimeout(resolve, 500));

  try {
    const result = await getVerdictFromEngine(query);

    // Stream the response section by section
    for await (const chunk of streamVerdictResponse(result)) {
      onStream(chunk);
    }

    return result;
  } catch (error) {
    onStream(`[ERROR] Error processing verdict: ${error}\n`);
    return null;
  }
}

// ============================================================================
// Batch Processing
// ============================================================================

export interface BatchVerdictRequest {
  founders: Array<{
    founder_id: string;
    intent: string;
    github?: string;
    twitter?: string;
  }>;
}

export async function processBatchVerdicts(
  request: BatchVerdictRequest,
  onProgress: (current: number, total: number) => void
): Promise<VerdictResult[]> {
  const results: VerdictResult[] = [];

  for (let i = 0; i < request.founders.length; i++) {
    const founder = request.founders[i];
    const query: VerdictQuery = {
      type: 'founder_analysis',
      content: founder.intent,
      founder_id: founder.founder_id,
      github_handle: founder.github,
      twitter_handle: founder.twitter,
      timestamp: new Date().toISOString(),
    };

    const result = await getVerdictFromEngine(query);
    results.push(result);
    onProgress(i + 1, request.founders.length);
  }

  return results;
}

// ============================================================================
// Verdict History & Caching
// ============================================================================

export interface VerdictHistory {
  founder_id: string;
  verdict: VerdictResult;
  created_at: string;
  updated_at: string;
}

const verdictCache = new Map<string, VerdictResult>();

export function cacheVerdict(founder_id: string, result: VerdictResult): void {
  verdictCache.set(founder_id, result);
}

export function getCachedVerdict(founder_id: string): VerdictResult | null {
  return verdictCache.get(founder_id) || null;
}

export function clearVerdictCache(): void {
  verdictCache.clear();
}

// ============================================================================
// Network Visualization Data
// ============================================================================

export interface NetworkVisualizationData {
  nodes: Array<{
    id: string;
    label: string;
    type: 'mentor' | 'investor' | 'peer' | 'founder';
    influence: number;
  }>;
  edges: Array<{
    source: string;
    target: string;
    relationship: string;
    strength: number;
  }>;
  metrics: {
    density: number;
    clustering_coefficient: number;
    reach: number;
  };
}

export function generateNetworkVisualization(result: VerdictResult): NetworkVisualizationData {
  // Generate network visualization from verdict analysis
  return {
    nodes: [
      { id: 'founder', label: 'Founder', type: 'founder', influence: 1.0 },
      {
        id: 'mentor1',
        label: 'Mentor 1',
        type: 'mentor',
        influence: result.analysis.network.mentor_strength,
      },
      {
        id: 'investor1',
        label: 'Investor 1',
        type: 'investor',
        influence: result.analysis.network.investor_credibility,
      },
      {
        id: 'peer1',
        label: 'Peer 1',
        type: 'peer',
        influence: result.analysis.network.peer_quality,
      },
    ],
    edges: [
      { source: 'founder', target: 'mentor1', relationship: 'mentorship', strength: 0.8 },
      { source: 'founder', target: 'investor1', relationship: 'funding', strength: 0.7 },
      { source: 'founder', target: 'peer1', relationship: 'collaboration', strength: 0.75 },
      { source: 'mentor1', target: 'investor1', relationship: 'connection', strength: 0.6 },
    ],
    metrics: {
      density: 0.5,
      clustering_coefficient: 0.67,
      reach: result.analysis.network.size,
    },
  };
}
