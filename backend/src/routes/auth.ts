import express, { type Request, type Response, type Router } from 'express';
import { body, validationResult, type ValidationChain } from 'express-validator';
import { auth, isMockMode } from '../services/platform/supabaseClient.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { getRequestLogger } from '../middleware/logger.js';

const router: Router = express.Router();

// Validation middleware
const validateSignup: ValidationChain[] = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
];

const validateLogin: ValidationChain[] = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
];

function handleValidationErrors(req: Request, res: Response, next: () => void): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      error: 'Validation failed',
      type: 'validation_error',
      details: errors.array(),
    });
    return;
  }
  next();
}

interface SignupRequestBody extends Request {
  body: {
    email: string;
    password: string;
    name?: string;
  };
}

interface LoginRequestBody extends Request {
  body: {
    email: string;
    password: string;
  };
}

// POST /auth/signup - Create new account
router.post(
  '/signup',
  validateSignup,
  handleValidationErrors,
  async (req: SignupRequestBody, res: Response) => {
    const log = getRequestLogger();
    const { email, password, name } = req.body;

    try {
      const { data, error } = await auth.signUp({
        email,
        password,
        options: {
          data: { name: name || email.split('@')[0] },
        },
      });

      if (error) {
        log.warn({ error: error.message, email }, 'Signup failed');
        res.status(400).json({
          error: error.message,
          type: 'signup_error',
        });
        return;
      }

      log.info({ userId: data.user?.id, email }, 'User signed up');
      res.status(201).json({
        success: true,
        user: {
          id: data.user?.id || '',
          email: data.user?.email || email,
          name: data.user?.user_metadata?.name as string | undefined,
        },
        session: data.session
          ? {
              access_token:
                typeof data.session === 'object' && 'access_token' in data.session
                  ? data.session.access_token
                  : '',
              expires_at:
                typeof data.session === 'object' && 'expires_at' in data.session
                  ? data.session.expires_at
                  : undefined,
            }
          : null,
      });
    } catch (err) {
      const error = err as Error;
      log.error({ error: error.message }, 'Signup error');
      res.status(500).json({
        error: 'Signup service unavailable',
        type: 'internal_error',
      });
    }
  }
);

// POST /auth/login - Sign in existing user
router.post(
  '/login',
  validateLogin,
  handleValidationErrors,
  async (req: LoginRequestBody, res: Response) => {
    const log = getRequestLogger();
    const { email, password } = req.body;

    try {
      const { data, error } = await auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        log.warn({ error: error.message, email }, 'Login failed');
        res.status(401).json({
          error: 'Invalid email or password',
          type: 'auth_error',
        });
        return;
      }

      log.info({ userId: data.user?.id, email }, 'User logged in');
      res.json({
        success: true,
        user: {
          id: data.user?.id || '',
          email: data.user?.email || email,
          name: data.user?.user_metadata?.name as string | undefined,
        },
        session: {
          access_token:
            data.session && typeof data.session === 'object' && 'access_token' in data.session
              ? data.session.access_token
              : '',
          expires_at:
            data.session && typeof data.session === 'object' && 'expires_at' in data.session
              ? data.session.expires_at
              : undefined,
        },
      });
    } catch (err) {
      const error = err as Error;
      log.error({ error: error.message }, 'Login error');
      res.status(500).json({
        error: 'Login service unavailable',
        type: 'internal_error',
      });
    }
  }
);

// POST /auth/logout - Sign out
router.post('/logout', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const log = getRequestLogger();

  try {
    const { error } = await auth.signOut(req.token);
    if (error) {
      log.warn({ error: error.message }, 'Logout failed');
    }
    log.info({ userId: req.user?.id }, 'User logged out');
    res.json({ success: true });
  } catch (err) {
    const error = err as Error;
    log.error({ error: error.message }, 'Logout error');
    res.status(500).json({
      error: 'Logout service unavailable',
      type: 'internal_error',
    });
  }
});

// GET /auth/me - Get current user
router.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    user: {
      id: req.user?.id || '',
      email: req.user?.email,
      name: req.user?.user_metadata?.name as string | undefined,
      created_at: req.user?.created_at,
    },
  });
});

// GET /auth/status - Check auth configuration (public)
router.get('/status', (_req: Request, res: Response) => {
  res.json({
    configured: true,
    mock: isMockMode,
    providers: ['email', 'google', 'github', 'discord'],
  });
});

// POST /auth/verify - Verify an API key/token (used by CLI)
router.post('/verify', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const log = getRequestLogger();

  log.info({ userId: req.user?.id }, 'Token verified via /auth/verify');

  res.json({
    valid: true,
    user: {
      id: req.user?.id || '',
      email: req.user?.email,
      name: req.user?.user_metadata?.name as string | undefined,
    },
  });
});

export default router;
