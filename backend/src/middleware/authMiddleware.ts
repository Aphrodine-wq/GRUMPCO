import type { Request, Response, NextFunction } from 'express';
import { auth, isMockMode } from '../services/supabaseClient.js';
import { getRequestLogger } from './logger.js';

// Extend Express Request type
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
    created_at?: string;
  };
  token?: string;
}

/**
 * Authentication middleware - verifies JWT token from Authorization header
 * In mock mode, accepts any token starting with 'mock-token-'
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const log = getRequestLogger();
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Missing or invalid authorization header',
      type: 'unauthorized',
    });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const { data, error } = await auth.getUser(token);

    if (error || !data.user) {
      log.warn({ error: error?.message }, 'Auth failed');
      res.status(401).json({
        error: 'Invalid or expired token',
        type: 'unauthorized',
      });
      return;
    }

    // Attach user to request for downstream handlers
    req.user = data.user;
    req.token = token;

    log.info({ userId: data.user.id, mock: isMockMode }, 'User authenticated');
    next();
  } catch (err) {
    const error = err as Error;
    log.error({ error: error.message }, 'Auth middleware error');
    res.status(500).json({
      error: 'Authentication service unavailable',
      type: 'internal_error',
    });
  }
}

/**
 * Optional auth - attaches user if token provided, but doesn't require it
 */
export async function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = undefined;
    next();
    return;
  }

  const token = authHeader.substring(7);

  try {
    const { data, error } = await auth.getUser(token);
    if (error || !data.user) {
      req.user = undefined;
      req.token = undefined;
    } else {
      req.user = data.user;
      req.token = token;
    }
  } catch {
    req.user = undefined;
    req.token = undefined;
  }

  next();
}

/**
 * Admin-only middleware - requires authenticated user with admin role
 */
export async function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  // First run standard auth
  await requireAuth(req, res, () => {
    if (!req.user) return; // requireAuth already sent response

    // Check for admin role in user metadata
    const isAdmin =
      req.user.user_metadata?.role === 'admin' ||
      req.user.email?.endsWith('@admin.local'); // Dev convenience

    if (!isAdmin) {
      res.status(403).json({
        error: 'Admin access required',
        type: 'forbidden',
      });
      return;
    }

    next();
  });
}

export default { requireAuth, optionalAuth, requireAdmin };
