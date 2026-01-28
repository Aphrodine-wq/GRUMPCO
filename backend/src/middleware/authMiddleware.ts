import type { Request, Response, NextFunction } from 'express';
import { auth } from '../services/supabaseClient.js';
import { getRequestLogger } from './logger.js';
import { env } from '../config/env.js';

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
 * Authentication middleware - verifies JWT token from Authorization header (Supabase).
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

    log.info({ userId: data.user.id }, 'User authenticated');
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
 * Check if a user has admin privileges.
 *
 * Admin access is determined by:
 * 1. user_metadata.role === 'admin' (set via Supabase dashboard or service key)
 * 2. app_metadata.role === 'admin' (more secure, can't be self-modified)
 * 3. In development only: email ending with '@admin.local' for testing
 *
 * @param user - The authenticated user object
 * @returns true if user has admin privileges
 */
function checkAdminRole(user: AuthenticatedRequest['user']): boolean {
  if (!user) return false;

  // Check app_metadata first (most secure - user can't modify)
  const appMetadata = user.user_metadata?.app_metadata as Record<string, unknown> | undefined;
  if (appMetadata?.role === 'admin') {
    return true;
  }

  // Check user_metadata role (can be set by service key)
  if (user.user_metadata?.role === 'admin') {
    return true;
  }

  // Development-only convenience: allow @admin.local emails
  // This MUST NOT work in production as it can be spoofed
  if (env.NODE_ENV === 'development' && user.email?.endsWith('@admin.local')) {
    return true;
  }

  return false;
}

/**
 * Admin-only middleware - requires authenticated user with admin role.
 *
 * Security: In production, admin role must be set via Supabase user_metadata
 * or app_metadata. The @admin.local email shortcut only works in development.
 */
export async function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const log = getRequestLogger();

  // First run standard auth
  await requireAuth(req, res, () => {
    if (!req.user) return; // requireAuth already sent response

    const isAdmin = checkAdminRole(req.user);

    if (!isAdmin) {
      log.warn(
        { userId: req.user.id, email: req.user.email },
        'Admin access denied - insufficient privileges'
      );
      res.status(403).json({
        error: 'Admin access required',
        type: 'forbidden',
      });
      return;
    }

    log.info({ userId: req.user.id }, 'Admin access granted');
    next();
  });
}

/** Path prefixes that may require auth when REQUIRE_AUTH_FOR_API=true */
const PROTECTED_API_PATHS = ['/api/chat', '/api/ship', '/api/codegen'];

function isProtectedApiPath(path: string): boolean {
  return PROTECTED_API_PATHS.some((p) => path === p || path.startsWith(p + '/'));
}

/**
 * Conditional API auth: when REQUIRE_AUTH_FOR_API=true, expensive routes
 * (chat, ship, codegen) require auth; otherwise optionalAuth for all.
 */
export async function apiAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (env.REQUIRE_AUTH_FOR_API && isProtectedApiPath(req.path)) {
    await requireAuth(req, res, next);
    return;
  }
  await optionalAuth(req, res, next);
}

export default { requireAuth, optionalAuth, requireAdmin, apiAuthMiddleware };
