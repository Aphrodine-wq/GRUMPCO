import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

// Set up environment
process.env.ANTHROPIC_API_KEY = 'test_api_key_for_testing';
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';

// Mock Supabase client
vi.mock('../../src/services/supabaseClient.ts', async () => {
  const actual = await vi.importActual('../../src/services/supabaseClient.ts');
  return {
    ...actual,
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      getUser: vi.fn(),
      signOut: vi.fn(),
    },
    isMockMode: false,
  };
});

// Import app after mocks
const { default: app } = await import('../../src/index.ts');
const { auth } = await import('../../src/services/supabaseClient.ts');

describe('Auth Flow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /auth/signup', () => {
    it('should create new user through full flow', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        user_metadata: { name: 'Test User' },
        created_at: new Date().toISOString(),
      };

      const mockSession = {
        access_token: 'token-123',
        expires_at: Date.now() + 3600000,
      };

      vi.mocked(auth.signUp).mockResolvedValue({
        data: {
          user: mockUser,
          session: mockSession,
        },
        error: null,
      });

      const response = await request(app)
        .post('/auth/signup')
        .send({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.user.id).toBe('user-123');
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.session).toBeDefined();
      expect(auth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        options: {
          data: { name: 'Test User' },
        },
      });
    });

    it('should handle signup errors', async () => {
      vi.mocked(auth.signUp).mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'User already exists' },
      });

      const response = await request(app)
        .post('/auth/signup')
        .send({
          email: 'existing@example.com',
          password: 'password123',
        })
        .expect(400);

      expect(response.body.type).toBe('signup_error');
      expect(response.body.error).toBe('User already exists');
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/auth/signup')
        .send({
          email: 'invalid-email',
          password: 'password123',
        })
        .expect(400);

      expect(response.body.type).toBe('validation_error');
    });

    it('should validate password length', async () => {
      const response = await request(app)
        .post('/auth/signup')
        .send({
          email: 'test@example.com',
          password: 'short',
        })
        .expect(400);

      expect(response.body.type).toBe('validation_error');
    });
  });

  describe('POST /auth/login', () => {
    it('should authenticate user through full flow', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        user_metadata: { name: 'Test User' },
      };

      const mockSession = {
        access_token: 'token-123',
        expires_at: Date.now() + 3600000,
      };

      vi.mocked(auth.signInWithPassword).mockResolvedValue({
        data: {
          user: mockUser,
          session: mockSession,
        },
        error: null,
      });

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user.id).toBe('user-123');
      expect(response.body.session.access_token).toBe('token-123');
      expect(auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    it('should handle invalid credentials', async () => {
      vi.mocked(auth.signInWithPassword).mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid credentials' },
      });

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
        })
        .expect(401);

      expect(response.body.type).toBe('auth_error');
      expect(response.body.error).toBe('Invalid email or password');
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout authenticated user', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        user_metadata: {},
      };

      vi.mocked(auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      vi.mocked(auth.signOut).mockResolvedValue({
        error: null,
      });

      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(auth.signOut).toHaveBeenCalled();
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .expect(401);

      expect(response.body.type).toBe('unauthorized');
    });
  });

  describe('GET /auth/me', () => {
    it('should return current user info', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        user_metadata: { name: 'Test User' },
        created_at: new Date().toISOString(),
      };

      vi.mocked(auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.user.id).toBe('user-123');
      expect(response.body.user.email).toBe('test@example.com');
    });
  });

  describe('GET /auth/status', () => {
    it('should return auth configuration status', async () => {
      const response = await request(app)
        .get('/auth/status')
        .expect(200);

      expect(response.body).toHaveProperty('configured');
      expect(response.body).toHaveProperty('mock');
      expect(response.body).toHaveProperty('providers');
    });
  });
});
