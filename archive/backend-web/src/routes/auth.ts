import express, { Request, Response, Router } from 'express'
import { body, validationResult } from 'express-validator'
import { auth } from '../services/supabaseClient.js'
import { requireAuth } from '../middleware/auth.js'
import type { AuthenticatedRequest } from '../middleware/auth.js'
import pino from 'pino'

const logger = pino({ level: process.env.LOG_LEVEL || 'info' })
const router: Router = express.Router()

const validateLogin = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
]

const validateRegister = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
]

function handleValidationErrors(req: Request, res: Response, next: () => void): void {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Validation failed', type: 'validation_error', details: errors.array() })
    return
  }
  next()
}

router.post(
  '/login',
  validateLogin,
  handleValidationErrors,
  async (req: Request<object, object, { email: string; password: string }>, res: Response) => {
    const { email, password } = req.body
    try {
      const { data, error } = await auth.signInWithPassword({ email, password })
      if (error) {
        logger.warn({ err: error.message, email }, 'Login failed')
        res.status(401).json({ error: 'Invalid email or password', type: 'auth_error' })
        return
      }
      const user = data.user as { id?: string; email?: string; user_metadata?: Record<string, unknown> } | null
      const session = data.session as { access_token?: string; expires_at?: number } | null
      logger.info({ userId: user?.id, email }, 'User logged in')
      res.json({
        success: true,
        user: { id: user?.id ?? '', email: user?.email ?? email, ...user },
        session: session
          ? { access_token: session.access_token ?? '', expires_at: session.expires_at }
          : null,
      })
    } catch (err) {
      logger.error({ err: (err as Error).message }, 'Login error')
      res.status(500).json({ error: 'Login service unavailable', type: 'internal_error' })
    }
  }
)

router.post(
  '/register',
  validateRegister,
  handleValidationErrors,
  async (req: Request<object, object, { email: string; password: string }>, res: Response) => {
    const { email, password } = req.body
    try {
      const { data, error } = await auth.signUp({
        email,
        password,
        options: { data: { name: email.split('@')[0] } },
      })
      if (error) {
        logger.warn({ err: error.message, email }, 'Signup failed')
        res.status(400).json({ error: error.message, type: 'signup_error' })
        return
      }
      const user = data.user as { id?: string; email?: string; user_metadata?: Record<string, unknown> } | null
      const session = data.session as { access_token?: string; expires_at?: number } | null
      logger.info({ userId: user?.id, email }, 'User signed up')
      res.status(201).json({
        success: true,
        user: { id: user?.id ?? '', email: user?.email ?? email, ...user },
        session: session
          ? { access_token: session.access_token ?? '', expires_at: session.expires_at }
          : null,
      })
    } catch (err) {
      logger.error({ err: (err as Error).message }, 'Signup error')
      res.status(500).json({ error: 'Signup service unavailable', type: 'internal_error' })
    }
  }
)

router.post('/logout', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await auth.signOut(req.token)
    logger.info({ userId: req.user?.id }, 'User logged out')
    res.json({ success: true })
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'Logout error')
    res.status(500).json({ error: 'Logout service unavailable', type: 'internal_error' })
  }
})

router.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    user: {
      id: req.user?.id ?? '',
      email: req.user?.email,
      user_metadata: req.user?.user_metadata,
      created_at: req.user?.created_at,
    },
  })
})

router.get('/status', (_req: Request, res: Response) => {
  res.json({
    configured: true,
    providers: ['email'],
  })
})

export default router
