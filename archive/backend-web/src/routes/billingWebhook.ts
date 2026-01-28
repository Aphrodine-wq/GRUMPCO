/**
 * Stripe webhook handler (raw body).
 * Mounted separately so express.raw() applies only to this route.
 */
import type { Request, Response } from 'express'
import { handleWebhook } from '../services/stripeService.js'

export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
  const payload = req.body
  const signature = (req.headers['stripe-signature'] as string) || ''
  if (!Buffer.isBuffer(payload) && typeof payload !== 'string') {
    res.status(400).json({ error: 'Invalid webhook body' })
    return
  }
  const raw = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'utf8')
  const { handled, error } = await handleWebhook(raw, signature)
  if (!handled) {
    res.status(400).json({ error: error || 'Webhook handling failed' })
    return
  }
  res.status(200).send()
}
