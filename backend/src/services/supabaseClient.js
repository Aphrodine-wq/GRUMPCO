import { createClient } from '@supabase/supabase-js';
import logger from '../middleware/logger.js';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
// Check if Supabase is configured
const MOCK_MODE = !SUPABASE_URL || !SUPABASE_SERVICE_KEY ||
    SUPABASE_URL === 'https://your-project.supabase.co';
if (MOCK_MODE) {
    logger.warn('Supabase running in MOCK MODE - no credentials configured');
    logger.warn('Set SUPABASE_URL and SUPABASE_SERVICE_KEY in backend/.env');
}
else {
    logger.info('Supabase client configured');
}
// Create real client or null for mock mode
const supabaseClient = MOCK_MODE ? null : createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});
// Mock user database for development
const mockUsers = new Map();
const mockSessions = new Map();
// Wrapped auth functions that work in both modes
export async function getUser(token) {
    if (MOCK_MODE) {
        if (!token)
            return { data: { user: null }, error: { message: 'No token provided' } };
        const session = mockSessions.get(token);
        if (!session)
            return { data: { user: null }, error: { message: 'Invalid token' } };
        const user = mockUsers.get(session.userId);
        return { data: { user }, error: null };
    }
    return supabaseClient.auth.getUser(token);
}
export async function signUp({ email, password, options }) {
    if (MOCK_MODE) {
        if (mockUsers.has(email)) {
            return { data: { user: null }, error: { message: 'User already exists' } };
        }
        const user = {
            id: `mock-${Date.now()}`,
            email,
            created_at: new Date().toISOString(),
            user_metadata: options?.data || {}
        };
        mockUsers.set(email, user);
        const token = `mock-token-${Date.now()}`;
        mockSessions.set(token, { userId: email, expiresAt: Date.now() + 3600000 });
        return {
            data: { user, session: { access_token: token } },
            error: null
        };
    }
    return supabaseClient.auth.signUp({ email, password, options });
}
export async function signInWithPassword({ email, password }) {
    if (MOCK_MODE) {
        const user = mockUsers.get(email);
        if (!user) {
            return { data: { user: null }, error: { message: 'Invalid credentials' } };
        }
        const token = `mock-token-${Date.now()}`;
        mockSessions.set(token, { userId: email, expiresAt: Date.now() + 3600000 });
        return {
            data: { user, session: { access_token: token } },
            error: null
        };
    }
    return supabaseClient.auth.signInWithPassword({ email, password });
}
export async function signOut(token) {
    if (MOCK_MODE) {
        mockSessions.delete(token);
        return { error: null };
    }
    return supabaseClient.auth.signOut();
}
// Database query helper
export function from(table) {
    if (MOCK_MODE) {
        return {
            select: () => ({ data: [], error: null }),
            insert: () => ({ data: null, error: null }),
            update: () => ({ data: null, error: null }),
            delete: () => ({ data: null, error: null }),
            eq: function () { return this; },
            single: () => ({ data: null, error: null })
        };
    }
    return supabaseClient.from(table);
}
// Export auth object with wrapped methods
export const auth = {
    getUser,
    signUp,
    signInWithPassword,
    signOut
};
// Export db interface
export const db = { from };
export const isMockMode = MOCK_MODE;
export default supabaseClient;
//# sourceMappingURL=supabaseClient.js.map