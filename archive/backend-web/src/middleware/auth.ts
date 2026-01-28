import type { Request, Response, NextFunction } from 'express'
import { auth } from '../services/supabaseClient.js'
import pino from 'pino'

const logger = pino({ level: process.env.LOG_LEVEL || 'info' })

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    email?: string
    user_metadata?: Record<string, unknown>
    created_at?: string
  }
  token?: string
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header', type: 'unauthorized' })
    return
  }
  const token = authHeader.substring(7)
  try {
    const { data, error } = await auth.getUser(token)
    if (error || !data.user) {
      logger.warn({ err: error?.message }, 'Auth failed')
      res.status(401).json({ error: 'Invalid or expired token', type: 'unauthorized' })
      return
    }
    req.user = data.user as AuthenticatedRequest['user']
    req.token = token
    next()
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'Auth middleware error')
    res.status(500).json({ error: 'Authentication service unavailable', type: 'internal_error' })
  }
}

export async function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = undefined
    next()
    return
  }
  const token = authHeader.substring(7)
  try {
    const { data, error } = await auth.getUser(token)
    if (error || !data.user) {
      req.user = undefined
      req.token = undefined
    } else {
      req.user = data.user as AuthenticatedRequest['user']
      req.token = token
    }
  } catch {
    req.user = undefined
    req.token = undefined
  }
  next()
}
