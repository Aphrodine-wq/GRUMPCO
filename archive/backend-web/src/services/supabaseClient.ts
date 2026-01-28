import { createHash, randomUUID, timingSafeEqual } from 'crypto'
import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js'
import pino from 'pino'

const logger = pino({ level: process.env.LOG_LEVEL || 'info' })

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const isProduction = process.env.NODE_ENV === 'production'

if (isProduction) {
  if (
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_KEY ||
    SUPABASE_URL === 'https://your-project.supabase.co'
  ) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_KEY are required in production. Set them in your environment.'
    )
  }
}

const MOCK_MODE =
  !isProduction &&
  (!SUPABASE_URL ||
    !SUPABASE_SERVICE_KEY ||
    SUPABASE_URL === 'https://your-project.supabase.co')

if (MOCK_MODE) {
  logger.warn('Supabase running in MOCK MODE (dev only) - set SUPABASE_URL and SUPABASE_SERVICE_KEY')
} else {
  logger.info('Supabase client configured')
}

const supabaseClient: SupabaseClient | null = MOCK_MODE
  ? null
  : createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

interface MockUser {
  id: string
  email: string
  created_at: string
  user_metadata: Record<string, unknown>
  password_hash: string
}

type MockUserPublic = Omit<MockUser, 'password_hash'>

interface MockSession {
  userId: string
  expiresAt: number
}

const mockUsers = new Map<string, MockUser>()
const mockSessions = new Map<string, MockSession>()
const MOCK_SESSION_TTL_MS = 60 * 60 * 1000

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex')
}

function verifyPassword(password: string, expectedHash: string): boolean {
  const actualHash = hashPassword(password)
  if (actualHash.length !== expectedHash.length) return false
  return timingSafeEqual(Buffer.from(actualHash), Buffer.from(expectedHash))
}

function createMockToken(): string {
  return `mock-token-${randomUUID()}`
}

function pruneExpiredSessions(now = Date.now()): void {
  for (const [token, session] of mockSessions.entries()) {
    if (session.expiresAt <= now) mockSessions.delete(token)
  }
}

function createMockSession(userId: string): {
  token: string
  expiresAt: number
  expiresAtSeconds: number
} {
  const token = createMockToken()
  const expiresAt = Date.now() + MOCK_SESSION_TTL_MS
  mockSessions.set(token, { userId, expiresAt })
  return { token, expiresAt, expiresAtSeconds: Math.floor(expiresAt / 1000) }
}

function toPublicUser(user: MockUser): MockUserPublic {
  const { password_hash: _h, ...publicUser } = user
  return publicUser
}

interface AuthResponse<T> {
  data: T
  error: { message: string } | null
}

export async function getUser(
  token: string
): Promise<AuthResponse<{ user: MockUserPublic | User | null }>> {
  if (MOCK_MODE) {
    pruneExpiredSessions()
    if (!token) return { data: { user: null }, error: { message: 'No token provided' } }
    const session = mockSessions.get(token)
    if (!session) return { data: { user: null }, error: { message: 'Invalid token' } }
    const user = mockUsers.get(session.userId)
    if (!user) {
      mockSessions.delete(token)
      return { data: { user: null }, error: { message: 'Invalid token' } }
    }
    return { data: { user: toPublicUser(user) }, error: null }
  }
  return supabaseClient!.auth.getUser(token)
}

export async function signUp({
  email,
  password,
  options,
}: {
  email: string
  password: string
  options?: { data?: Record<string, unknown> }
}): Promise<
  AuthResponse<{
    user: MockUserPublic | User | null
    session: { access_token: string; expires_at?: number } | Session | null
  }>
> {
  if (MOCK_MODE) {
    if (mockUsers.has(email)) {
      return { data: { user: null, session: null }, error: { message: 'User already exists' } }
    }
    const user: MockUser = {
      id: `mock-${Date.now()}`,
      email,
      created_at: new Date().toISOString(),
      user_metadata: options?.data || {},
      password_hash: hashPassword(password),
    }
    mockUsers.set(email, user)
    const { token, expiresAtSeconds } = createMockSession(email)
    return {
      data: { user: toPublicUser(user), session: { access_token: token, expires_at: expiresAtSeconds } },
      error: null,
    }
  }
  return supabaseClient!.auth.signUp({ email, password, options })
}

export async function signInWithPassword({
  email,
  password,
}: {
  email: string
  password: string
}): Promise<
  AuthResponse<{
    user: MockUserPublic | User | null
    session: { access_token: string; expires_at?: number } | Session | null
  }>
> {
  if (MOCK_MODE) {
    const user = mockUsers.get(email)
    if (!user || !verifyPassword(password, user.password_hash)) {
      return { data: { user: null, session: null }, error: { message: 'Invalid credentials' } }
    }
    pruneExpiredSessions()
    const { token, expiresAtSeconds } = createMockSession(email)
    return {
      data: { user: toPublicUser(user), session: { access_token: token, expires_at: expiresAtSeconds } },
      error: null,
    }
  }
  return supabaseClient!.auth.signInWithPassword({ email, password })
}

export async function signOut(token?: string): Promise<{ error: { message: string } | null }> {
  if (MOCK_MODE) {
    pruneExpiredSessions()
    if (token) mockSessions.delete(token)
    return { error: null }
  }
  return supabaseClient!.auth.signOut()
}

export const auth = {
  getUser,
  signUp,
  signInWithPassword,
  signOut,
}

export default supabaseClient
