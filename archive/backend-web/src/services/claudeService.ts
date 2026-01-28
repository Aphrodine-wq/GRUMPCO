/**
 * Claude service - uses managed API keys and records usage.
 * Keys come from apiKeyManager; usage is sent to usageTracker.
 */
import Anthropic from '@anthropic-ai/sdk'
import { acquireKey } from './apiKeyManager.js'
import { recordTokenUsage } from './usageTracker.js'
import pino from 'pino'

const logger = pino({ level: process.env.LOG_LEVEL || 'info' })

const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514'

/**
 * Create an Anthropic client using the next key from the pool.
 * Returns null if no key is configured.
 */
export function getClient(): Anthropic | null {
  const apiKey = acquireKey()
  if (!apiKey) {
    logger.warn('Claude: no API key available')
    return null
  }
  return new Anthropic({ apiKey })
}

/**
 * Call Claude and record token usage for a user.
 * Returns the text response or null on error.
 */
export async function complete(
  userId: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  system?: string
): Promise<{ text: string; usage: { inputTokens: number; outputTokens: number } } | null> {
  const client = getClient()
  if (!client) return null
  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: system ?? undefined,
      messages,
    })
    const content = resp.content?.[0]
    const text = content && 'text' in content ? content.text : ''
    const inputTokens = resp.usage?.input_tokens ?? 0
    const outputTokens = resp.usage?.output_tokens ?? 0
    recordTokenUsage(userId, MODEL, inputTokens, outputTokens)
    return { text, usage: { inputTokens, outputTokens } }
  } catch (err) {
    logger.error({ err: (err as Error).message, userId }, 'Claude complete error')
    return null
  }
}
