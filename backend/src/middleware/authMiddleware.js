import { auth, isMockMode } from '../services/supabaseClient.js';
import { getRequestLogger } from './logger.js';
/**
 * Authentication middleware - verifies JWT token from Authorization header
 * In mock mode, accepts any token starting with 'mock-token-'
 */
export async function requireAuth(req, res, next) {
    const log = getRequestLogger();
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            error: 'Missing or invalid authorization header',
            type: 'unauthorized'
        });
    }
    const token = authHeader.substring(7);
    try {
        const { data, error } = await auth.getUser(token);
        if (error || !data.user) {
            log.warn({ error: error?.message }, 'Auth failed');
            return res.status(401).json({
                error: 'Invalid or expired token',
                type: 'unauthorized'
            });
        }
        // Attach user to request for downstream handlers
        req.user = data.user;
        req.token = token;
        log.info({ userId: data.user.id, mock: isMockMode }, 'User authenticated');
        next();
    }
    catch (err) {
        log.error({ error: err.message }, 'Auth middleware error');
        return res.status(500).json({
            error: 'Authentication service unavailable',
            type: 'internal_error'
        });
    }
}
/**
 * Optional auth - attaches user if token provided, but doesn't require it
 */
export async function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        req.user = null;
        return next();
    }
    const token = authHeader.substring(7);
    try {
        const { data, error } = await auth.getUser(token);
        req.user = error ? null : data.user;
        req.token = error ? null : token;
    }
    catch {
        req.user = null;
    }
    next();
}
/**
 * Admin-only middleware - requires authenticated user with admin role
 */
export async function requireAdmin(req, res, next) {
    // First run standard auth
    await requireAuth(req, res, () => {
        if (!req.user)
            return; // requireAuth already sent response
        // Check for admin role in user metadata
        const isAdmin = req.user.user_metadata?.role === 'admin' ||
            req.user.email?.endsWith('@admin.local'); // Dev convenience
        if (!isAdmin) {
            return res.status(403).json({
                error: 'Admin access required',
                type: 'forbidden'
            });
        }
        next();
    });
}
export default { requireAuth, optionalAuth, requireAdmin };
//# sourceMappingURL=authMiddleware.js.map