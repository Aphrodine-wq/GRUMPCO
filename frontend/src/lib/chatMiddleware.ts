//! Chat Middleware - Lightweight integration point for verdict system
//! Hook this into RefactoredChatInterface to enable verdict commands

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  detectVerdictCommand,
  formatVerdictAsMessage,
  generateMockVerdict,
} from './verdictChatIntegration';

/**
 * Process user message through verdict middleware
 * Returns transformed message stream if verdict command detected
 */
export async function processMessageWithVerdictSupport(
  userMessage: string,
  onVerdictDetected?: (verdict: any) => void
): Promise<{ isVerdictCommand: boolean; transformedMessage?: string }> {
  const command = detectVerdictCommand(userMessage);

  if (command.type === 'none') {
    // Not a verdict command, pass through normally
    return { isVerdictCommand: false };
  }

  // Verdict command detected
  if (onVerdictDetected) {
    // Simulate API call to verdict engine
    const verdict = generateMockVerdict(userMessage);
    onVerdictDetected(verdict);
  }

  return {
    isVerdictCommand: true,
    transformedMessage: `I'll analyze this using the verdict engine: ${userMessage}`,
  };
}

/**
 * Middleware hook function to add to chat component
 * Usage: Call this in handleSubmit before sending message
 */
export async function verdictMiddleware(
  userMessage: string,
  onVerdictResult: (blocks: any[]) => void
): Promise<boolean> {
  const command = detectVerdictCommand(userMessage);

  if (command.type === 'none') {
    return false; // Not a verdict command
  }

  // Generate mock verdict (in production, calls actual Rust API)
  const verdict = generateMockVerdict(userMessage);
  const formattedBlocks = formatVerdictAsMessage(verdict);

  // Call callback to inject verdict into chat
  onVerdictResult(formattedBlocks);

  return true; // Command handled
}

/**
 * Export verdict system capabilities to chat
 */
export const VerdictCommands = {
  analyze: {
    pattern: /analyze\s+(@[\w-]+)?\s+(?:for\s+)?(.+)/i,
    description: 'Analyze a founder or startup idea',
    example: 'analyze @alice-dev for SaaS platform',
  },
  verdict: {
    pattern: /what'?s?\s+(?:the\s+)?verdict\s+on\s+(.+)/i,
    description: 'Get verdict for a market or idea',
    example: "what's the verdict on AI developer tools?",
  },
  network: {
    pattern: /network\s+(?:analysis\s+)?(?:for\s+)?(.+)/i,
    description: 'Analyze founder network',
    example: 'network analysis for alice-chen',
  },
  market: {
    pattern: /market\s+(?:check|analysis)?\s+(?:for\s+)?(.+)/i,
    description: 'Check market opportunity',
    example: 'market check for enterprise AI',
  },
  batch: {
    pattern: /batch\s+(?:upload|analyze)\s+(.+)/i,
    description: 'Process multiple founders',
    example: 'batch upload founders.csv',
  },
};

/**
 * Get help text for verdict commands
 */
export function getVerdictCommandsHelp(): string {
  return `
🎯 **Verdict Engine Commands**

${Object.entries(VerdictCommands)
  .map(([cmd, data]) => `**${cmd}**: ${data.description}\n  Example: "${data.example}"`)
  .join('\n\n')}

Just type any of these commands in chat to get instant founder analysis!
  `.trim();
}
