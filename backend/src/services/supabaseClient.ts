import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import {
  createClient,
  type SupabaseClient,
  type AuthUser as User,
  type AuthSession as Session,
} from '@supabase/supabase-js';
import logger from '../middleware/logger.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const isProduction = process.env.NODE_ENV === 'production';

// Production: require real Supabase; fail startup if not configured.
if (isProduction) {
  if (
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_KEY ||
    SUPABASE_URL === 'https://your-project.supabase.co'
  ) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_KEY are required in production. Set them in your environment.'
    );
  }
}

// Dev only: allow mock when Supabase not configured. Never use mock in production.
const MOCK_MODE =
  !isProduction &&
  (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || SUPABASE_URL === 'https://your-project.supabase.co');

if (MOCK_MODE) {
  logger.warn('Supabase running in MOCK MODE (dev only) - no credentials configured');
  logger.warn('Set SUPABASE_URL and SUPABASE_SERVICE_KEY in backend/.env for real auth');
} else {
  logger.info('Supabase client configured');
}

const supabaseClient: SupabaseClient | null = (() => {
  if (MOCK_MODE) return null;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
})();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSupabaseClient(): any {
  if (!supabaseClient) throw new Error('Supabase not configured');
  return supabaseClient;
}

interface MockUser {
  id: string;
  email: string;
  created_at: string;
  user_metadata: Record<string, unknown>;
  password_hash: string;
}

type MockUserPublic = Omit<MockUser, 'password_hash'>;

interface MockSession {
  userId: string;
  expiresAt: number;
}

const mockUsers = new Map<string, MockUser>();
const mockSessions = new Map<string, MockSession>();

const MOCK_SESSION_TTL_MS = 60 * 60 * 1000;

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

function verifyPassword(password: string, expectedHash: string): boolean {
  const actualHash = hashPassword(password);
  if (actualHash.length !== expectedHash.length) return false;
  return timingSafeEqual(Buffer.from(actualHash), Buffer.from(expectedHash));
}

function createMockToken(): string {
  return `mock-token-${randomUUID()}`;
}

function pruneExpiredSessions(now = Date.now()): void {
  for (const [token, session] of mockSessions.entries()) {
    if (session.expiresAt <= now) {
      mockSessions.delete(token);
    }
  }
}

function createMockSession(userId: string): {
  token: string;
  expiresAt: number;
  expiresAtSeconds: number;
} {
  const token = createMockToken();
  const expiresAt = Date.now() + MOCK_SESSION_TTL_MS;
  mockSessions.set(token, { userId, expiresAt });
  return { token, expiresAt, expiresAtSeconds: Math.floor(expiresAt / 1000) };
}

function toPublicUser(user: MockUser): MockUserPublic {
  const { password_hash: _passwordHash, ...publicUser } = user;
  return publicUser;
}

interface AuthResponse<T> {
  data: T;
  error: { message: string } | null;
}

interface SignUpOptions {
  email: string;
  password: string;
  options?: {
    data?: Record<string, unknown>;
  };
}

interface SignInOptions {
  email: string;
  password: string;
}

export async function getUser(
  token: string
): Promise<AuthResponse<{ user: MockUserPublic | User | null }>> {
  if (MOCK_MODE) {
    pruneExpiredSessions();
    if (!token) return { data: { user: null }, error: { message: 'No token provided' } };
    const session = mockSessions.get(token);
    if (!session) return { data: { user: null }, error: { message: 'Invalid token' } };
    const user = mockUsers.get(session.userId);
    if (!user) {
      mockSessions.delete(token);
      return { data: { user: null }, error: { message: 'Invalid token' } };
    }
    return { data: { user: toPublicUser(user) }, error: null };
  }
  return getSupabaseClient().auth.getUser(token);
}

export async function signUp({ email, password, options }: SignUpOptions): Promise<
  AuthResponse<{
    user: MockUserPublic | User | null;
    session: { access_token: string; expires_at?: number } | Session | null;
  }>
> {
  if (MOCK_MODE) {
    if (mockUsers.has(email)) {
      return { data: { user: null, session: null }, error: { message: 'User already exists' } };
    }
    const passwordHash = hashPassword(password);
    const user: MockUser = {
      id: `mock-${Date.now()}`,
      email,
      created_at: new Date().toISOString(),
      user_metadata: options?.data || {},
      password_hash: passwordHash,
    };
    mockUsers.set(email, user);
    const { token, expiresAtSeconds } = createMockSession(email);
    return {
      data: {
        user: toPublicUser(user),
        session: { access_token: token, expires_at: expiresAtSeconds },
      },
      error: null,
    };
  }
  return getSupabaseClient().auth.signUp({ email, password, options });
}

export async function signInWithPassword({ email, password }: SignInOptions): Promise<
  AuthResponse<{
    user: MockUserPublic | User | null;
    session: { access_token: string; expires_at?: number } | Session | null;
  }>
> {
  if (MOCK_MODE) {
    const user = mockUsers.get(email);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return { data: { user: null, session: null }, error: { message: 'Invalid credentials' } };
    }
    pruneExpiredSessions();
    const { token, expiresAtSeconds } = createMockSession(email);
    return {
      data: {
        user: toPublicUser(user),
        session: { access_token: token, expires_at: expiresAtSeconds },
      },
      error: null,
    };
  }
  return getSupabaseClient().auth.signInWithPassword({ email, password });
}

export async function signOut(token?: string): Promise<{ error: { message: string } | null }> {
  if (MOCK_MODE) {
    pruneExpiredSessions();
    if (token) mockSessions.delete(token);
    return { error: null };
  }
  return getSupabaseClient().auth.signOut();
}

interface OAuthOptions {
  provider:
    | 'google'
    | 'github'
    | 'gitlab'
    | 'bitbucket'
    | 'discord'
    | 'slack'
    | 'azure'
    | 'keycloak';
  options?: {
    redirectTo?: string;
    scopes?: string;
  };
}

export async function signInWithOAuth({
  provider,
  options,
}: OAuthOptions): Promise<AuthResponse<{ url: string | null; provider: string }>> {
  if (MOCK_MODE) {
    // In mock mode, return a mock URL
    const redirectTo = options?.redirectTo || 'http://localhost:3000/auth/callback';
    return {
      data: {
        url: `http://localhost:3000/mock-oauth?provider=${provider}&redirect=${encodeURIComponent(redirectTo)}`,
        provider,
      },
      error: null,
    };
  }
  return getSupabaseClient().auth.signInWithOAuth({ provider, options });
}

export async function exchangeCodeForSession(code: string): Promise<
  AuthResponse<{
    user: MockUserPublic | User | null;
    session: { access_token: string; expires_at?: number; expires_in?: number } | Session | null;
  }>
> {
  if (MOCK_MODE) {
    // In mock mode, create a mock session from the code
    const mockEmail = `oauth-user-${code.slice(0, 8)}@mock.local`;
    let user = mockUsers.get(mockEmail);

    if (!user) {
      // Create new mock OAuth user
      user = {
        id: `mock-oauth-${Date.now()}`,
        email: mockEmail,
        created_at: new Date().toISOString(),
        user_metadata: { provider: 'google' },
        password_hash: '', // OAuth users don't have passwords
      };
      mockUsers.set(mockEmail, user);
    }

    const { token, expiresAtSeconds } = createMockSession(mockEmail);
    return {
      data: {
        user: toPublicUser(user),
        session: {
          access_token: token,
          expires_at: expiresAtSeconds,
          expires_in: 3600,
        },
      },
      error: null,
    };
  }
  return getSupabaseClient().auth.exchangeCodeForSession(code);
}

interface MockQueryResult {
  data: unknown[] | null;
  error: { message: string } | null;
}

interface MockQueryBuilder extends PromiseLike<MockQueryResult> {
  data?: MockQueryResult['data'];
  error?: MockQueryResult['error'];
  select: (_columns?: string) => MockQueryBuilder;
  insert: (_values?: Record<string, unknown> | Record<string, unknown>[]) => MockQueryBuilder;
  update: (_values?: Record<string, unknown>) => MockQueryBuilder;
  delete: () => MockQueryBuilder;
  eq: (_column: string, _value: unknown) => MockQueryBuilder;
  gt: (_column: string, _value: unknown) => MockQueryBuilder;
  order: (_column: string, _opts?: { ascending?: boolean }) => MockQueryBuilder;
  limit: (_count: number) => MockQueryBuilder;
  single: () => MockQueryBuilder;
}

export function from(table: string): MockQueryBuilder | ReturnType<SupabaseClient['from']> {
  if (MOCK_MODE) {
    const mockBuilder: MockQueryBuilder = {
      data: [],
      error: null,
      select: () => {
        mockBuilder.data = [];
        mockBuilder.error = null;
        return mockBuilder;
      },
      insert: () => {
        mockBuilder.data = null;
        mockBuilder.error = null;
        return mockBuilder;
      },
      update: () => {
        mockBuilder.data = null;
        mockBuilder.error = null;
        return mockBuilder;
      },
      delete: () => {
        mockBuilder.data = null;
        mockBuilder.error = null;
        return mockBuilder;
      },
      eq: () => mockBuilder,
      gt: () => mockBuilder,
      order: () => mockBuilder,
      limit: () => mockBuilder,
      single: () => {
        mockBuilder.data = null;
        mockBuilder.error = null;
        return mockBuilder;
      },
      then: (onfulfilled, onrejected) =>
        Promise.resolve({ data: mockBuilder.data ?? null, error: mockBuilder.error ?? null }).then(
          onfulfilled,
          onrejected
        ),
    };
    return mockBuilder;
  }
  return getSupabaseClient().from(table);
}

export const auth = {
  getUser,
  signUp,
  signInWithPassword,
  signOut,
  signInWithOAuth,
  exchangeCodeForSession,
};

export const db = { from };

export const isMockMode = MOCK_MODE;

export default supabaseClient;
