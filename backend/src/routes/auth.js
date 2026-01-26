import express from 'express';
import { body, validationResult } from 'express-validator';
import { auth, isMockMode } from '../services/supabaseClient.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { getRequestLogger } from '../middleware/logger.js';
const router = express.Router();
// Validation middleware
const validateSignup = [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
];
const validateLogin = [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required')
];
function handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            type: 'validation_error',
            details: errors.array()
        });
    }
    next();
}
// POST /auth/signup - Create new account
router.post('/signup', validateSignup, handleValidationErrors, async (req, res) => {
    const log = getRequestLogger();
    const { email, password, name } = req.body;
    try {
        const { data, error } = await auth.signUp({
            email,
            password,
            options: {
                data: { name: name || email.split('@')[0] }
            }
        });
        if (error) {
            log.warn({ error: error.message, email }, 'Signup failed');
            return res.status(400).json({
                error: error.message,
                type: 'signup_error'
            });
        }
        log.info({ userId: data.user?.id, email, mock: isMockMode }, 'User signed up');
        res.status(201).json({
            success: true,
            user: {
                id: data.user.id,
                email: data.user.email,
                name: data.user.user_metadata?.name
            },
            session: data.session ? {
                access_token: data.session.access_token,
                expires_at: data.session.expires_at
            } : null,
            mock: isMockMode
        });
    }
    catch (err) {
        log.error({ error: err.message }, 'Signup error');
        res.status(500).json({
            error: 'Signup service unavailable',
            type: 'internal_error'
        });
    }
});
// POST /auth/login - Sign in existing user
router.post('/login', validateLogin, handleValidationErrors, async (req, res) => {
    const log = getRequestLogger();
    const { email, password } = req.body;
    try {
        const { data, error } = await auth.signInWithPassword({
            email,
            password
        });
        if (error) {
            log.warn({ error: error.message, email }, 'Login failed');
            return res.status(401).json({
                error: 'Invalid email or password',
                type: 'auth_error'
            });
        }
        log.info({ userId: data.user?.id, email, mock: isMockMode }, 'User logged in');
        res.json({
            success: true,
            user: {
                id: data.user.id,
                email: data.user.email,
                name: data.user.user_metadata?.name
            },
            session: {
                access_token: data.session.access_token,
                expires_at: data.session.expires_at
            },
            mock: isMockMode
        });
    }
    catch (err) {
        log.error({ error: err.message }, 'Login error');
        res.status(500).json({
            error: 'Login service unavailable',
            type: 'internal_error'
        });
    }
});
// POST /auth/logout - Sign out
router.post('/logout', requireAuth, async (req, res) => {
    const log = getRequestLogger();
    try {
        const { error } = await auth.signOut(req.token);
        if (error) {
            log.warn({ error: error.message }, 'Logout failed');
        }
        log.info({ userId: req.user.id }, 'User logged out');
        res.json({ success: true });
    }
    catch (err) {
        log.error({ error: err.message }, 'Logout error');
        res.status(500).json({
            error: 'Logout service unavailable',
            type: 'internal_error'
        });
    }
});
// GET /auth/me - Get current user
router.get('/me', requireAuth, (req, res) => {
    res.json({
        user: {
            id: req.user.id,
            email: req.user.email,
            name: req.user.user_metadata?.name,
            created_at: req.user.created_at
        },
        mock: isMockMode
    });
});
// GET /auth/status - Check auth configuration (public)
router.get('/status', (req, res) => {
    res.json({
        configured: !isMockMode,
        mock: isMockMode,
        providers: isMockMode ? ['email'] : ['email', 'google', 'github']
    });
});
export default router;
//# sourceMappingURL=auth.js.map