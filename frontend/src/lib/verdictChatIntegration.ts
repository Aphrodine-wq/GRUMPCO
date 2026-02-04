//! Verdict Chat Integration - Lightweight hook for existing chat system
//! Detects verdict commands in user messages and routes to verdict engine

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { ContentBlock, Message } from '../types';

export interface VerdictCommand {
  type: 'verdict' | 'network' | 'batch' | 'market' | 'none';
  query: string;
  founder_id?: string;
  github?: string;
  twitter?: string;
}

/**
 * Detect if a message is a verdict command
 */
export function detectVerdictCommand(message: string): VerdictCommand {
  const text = message.toLowerCase().trim();

  // Verdict patterns
  if (
    text.includes('verdict') ||
    text.includes('analyze') ||
    text.includes('founder') ||
    text.match(/@[\w-]+/)
  ) {
    return {
      type: 'verdict',
      query: message,
      github: extractHandle(message, '@'),
      twitter: extractHandle(message, 'twitter:'),
    };
  }

  if (text.includes('network') || text.includes('connections')) {
    return {
      type: 'network',
      query: message,
    };
  }

  if (text.includes('batch') || text.includes('csv')) {
    return {
      type: 'batch',
      query: message,
    };
  }

  if (text.includes('market') || text.includes('opportunity')) {
    return {
      type: 'market',
      query: message,
    };
  }

  return { type: 'none', query: message };
}

function extractHandle(text: string, prefix: string): string | undefined {
  const regex = new RegExp(`${prefix}([\\w-]+)`, 'i');
  const match = text.match(regex);
  return match ? match[1] : undefined;
}

/**
 * Format verdict response as chat message
 */
export function formatVerdictAsMessage(verdict: any): ContentBlock[] {
  return [
    {
      type: 'text',
      content: `
🎯 **VERDICT: ${verdict.verdict}**
**Confidence:** ${(verdict.confidence * 100).toFixed(0)}% | **Success Probability:** ${(verdict.success_probability * 100).toFixed(0)}%

**📝 Semantic Analysis**
• Intent: ${verdict.analysis.semantic.intent_type}
• Complexity: ${(verdict.analysis.semantic.complexity_score * 100).toFixed(0)}%
• Clarity: ${(verdict.analysis.semantic.clarity_score * 100).toFixed(0)}%

**🧠 Founder Psychology**
• Archetype: ${verdict.analysis.psychology.archetype}
• Consistency: ${(verdict.analysis.psychology.consistency * 100).toFixed(0)}%
• Resilience: ${(verdict.analysis.psychology.resilience * 100).toFixed(0)}%
• Burnout Risk: ${(verdict.analysis.psychology.burnout_risk * 100).toFixed(0)}%

**📊 Market**
• TAM: ${verdict.analysis.market.tam}
• Growth: ${(verdict.analysis.market.growth_rate * 100).toFixed(0)}% YoY
• Competition: ${verdict.analysis.market.competition}
• Opportunity Score: ${(verdict.analysis.market.opportunity_score * 100).toFixed(0)}%

**🌐 Network**
• Size: ${verdict.analysis.network.size} connections
• Mentor Strength: ${(verdict.analysis.network.mentor_strength * 100).toFixed(0)}%
• Investor Credibility: ${(verdict.analysis.network.investor_credibility * 100).toFixed(0)}%
• Pattern: ${verdict.analysis.network.winning_pattern}

**🤖 ML Prediction**
• Success: ${(verdict.analysis.ml_prediction.success_probability * 100).toFixed(0)}%
• Revenue: ${verdict.analysis.ml_prediction.revenue_potential}

**💡 Key Factors**
Success:
${verdict.analysis.ml_prediction.success_factors.map((f) => `• ${f}`).join('\n')}

Risks:
${verdict.analysis.ml_prediction.risk_factors.map((f) => `• ${f}`).join('\n')}

**✨ Reasoning**
${verdict.reasoning.map((r) => `• ${r}`).join('\n')}
`.trim(),
    },
  ];
}

/**
 * Generate mock verdict for UI preview
 */
export function generateMockVerdict(_query: string): any {
  return {
    verdict: 'BuildNow',
    confidence: 0.78,
    success_probability: 0.73,
    analysis: {
      semantic: {
        intent_type: 'CREATE',
        complexity_score: 0.72,
        clarity_score: 0.85,
        extracted_features: ['user auth', 'collaboration', 'real-time'],
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
        winning_pattern: 'Strong learning network',
      },
      ml_prediction: {
        success_probability: 0.73,
        revenue_potential: '$1-10M ARR by year 3',
        success_factors: [
          'Strong founder fundamentals',
          'Clear market gap',
          'Good network support',
        ],
        risk_factors: ['Market timing risk', 'Competitive pressure', 'Execution complexity'],
      },
    },
    reasoning: [
      'Strong founder fundamentals based on GitHub signals',
      'Adequate market opportunity with clear differentiation',
      'Solid network support from mentors and investors',
    ],
  };
}

/**
 * Inject verdict response into existing message stream
 */
export function injectVerdictIntoChat(
  messages: Message[],
  userMessage: string,
  verdictResponse: ContentBlock[]
): Message[] {
  // Add user message
  const updatedMessages = [
    ...messages,
    {
      role: 'user',
      content: userMessage,
    },
  ];

  // Add verdict response
  updatedMessages.push({
    role: 'assistant',
    content: verdictResponse,
  });

  return updatedMessages;
}

/**
 * Generate system prompt for verdict integration
 */
export function getVerdictSystemPrompt(): string {
  return `You are G-Rump, an advanced startup advisor with access to a comprehensive verdict engine.

When users ask about founders, startup ideas, or market opportunities, you can use the verdict system to provide:
- Real-time founder analysis (psychology, GitHub signals, Twitter sentiment)
- Market opportunity assessment (TAM, growth rate, competitive landscape)
- Network intelligence (mentor strength, investor credibility, peer quality)
- ML predictions (success probability, revenue potential)
- Risk and opportunity analysis

Verdict Commands:
• "analyze @github_handle for [idea]" - Get comprehensive founder verdict
• "what's the verdict on [startup]?" - Quick verdict for idea
• "network analysis for [founder]" - Analyze founder's network
• "market check for [domain]" - Assess market opportunity
• "batch upload [csv]" - Process multiple founders

Always provide verdicts with reasoning and actionable insights. When users ask founder-related questions, offer to run a verdict analysis.`;
}
