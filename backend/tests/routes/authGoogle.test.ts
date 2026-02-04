/**
 * Google OAuth Route Tests
 * Comprehensive tests for Google OAuth flow with Supabase.
 *
 * Tests the actual authGoogle.ts router with proper mocking.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';

// Mock dependencies BEFORE importing the router
const mockSignInWithOAuth = vi.fn();
const mockExchangeCodeForSession = vi.fn();

vi.mock('../../src/services/supabaseClient.js', () => ({
  auth: {
    signInWithOAuth: (...args: unknown[]) => mockSignInWithOAuth(...args),
    exchangeCodeForSession: (...args: unknown[]) => mockExchangeCodeForSession(...args),
  },
}));

vi.mock('../../src/middleware/logger.js', () => ({
  getRequestLogger: () => ({
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
  }),
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Now import the actual router
import authGoogleRouter from '../../src/routes/authGoogle.js';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/auth/google', authGoogleRouter);
  return app;
}

describe('Google OAuth Routes', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset env vars
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    vi.resetAllMocks();
    // Restore original env
    process.env = { ...originalEnv };
  });

  describe('GET /auth/google', () => {
    describe('OAuth URL Generation', () => {
      it('should redirect to OAuth URL when configured correctly', async () => {
        mockSignInWithOAuth.mockResolvedValueOnce({
          data: { url: 'https://accounts.google.com/oauth/authorize?client_id=xxx' },
          error: null,
        });
        const app = createApp();

        const response = await request(app).get('/auth/google');

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe('https://accounts.google.com/oauth/authorize?client_id=xxx');
      });

      it('should call signInWithOAuth with correct parameters', async () => {
        mockSignInWithOAuth.mockResolvedValueOnce({
          data: { url: 'https://oauth.example.com' },
          error: null,
        });
        const app = createApp();

        await request(app).get('/auth/google');

        expect(mockSignInWithOAuth).toHaveBeenCalledWith({
          provider: 'google',
          options: expect.objectContaining({
            scopes: 'openid email profile',
          }),
        });
      });

      it('should use default redirect URL', async () => {
        mockSignInWithOAuth.mockResolvedValueOnce({
          data: { url: 'https://oauth.example.com' },
          error: null,
        });
        const app = createApp();

        await request(app).get('/auth/google');

        expect(mockSignInWithOAuth).toHaveBeenCalledWith(
          expect.objectContaining({
            options: expect.objectContaining({
              redirectTo: expect.stringContaining('/auth/google/callback'),
            }),
          })
        );
      });

      it('should use GOOGLE_OAUTH_REDIRECT_URL when set', async () => {
        process.env.GOOGLE_OAUTH_REDIRECT_URL = 'https://myapp.com/auth/google/callback';
        mockSignInWithOAuth.mockResolvedValueOnce({
          data: { url: 'https://oauth.example.com' },
          error: null,
        });
        const app = createApp();

        await request(app).get('/auth/google');

        expect(mockSignInWithOAuth).toHaveBeenCalledWith(
          expect.objectContaining({
            options: expect.objectContaining({
              redirectTo: 'https://myapp.com/auth/google/callback',
            }),
          })
        );
      });
    });

    describe('Error Handling', () => {
      it('should return 500 when OAuth provider returns error', async () => {
        mockSignInWithOAuth.mockResolvedValueOnce({
          data: null,
          error: { message: 'Provider unavailable' },
        });
        const app = createApp();

        const response = await request(app).get('/auth/google');

        expect(response.status).toBe(500);
        expect(response.body).toEqual({
          error: 'Failed to initiate Google authentication',
          type: 'oauth_init_error',
        });
      });

      it('should return 500 when OAuth URL is missing', async () => {
        mockSignInWithOAuth.mockResolvedValueOnce({
          data: { url: null },
          error: null,
        });
        const app = createApp();

        const response = await request(app).get('/auth/google');

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('No OAuth URL returned');
      });

      it('should return 500 on unexpected error', async () => {
        mockSignInWithOAuth.mockRejectedValueOnce(new Error('Network error'));
        const app = createApp();

        const response = await request(app).get('/auth/google');

        expect(response.status).toBe(500);
        expect(response.body).toEqual({
          error: 'Google authentication failed',
          type: 'server_error',
        });
      });
    });
  });

  describe('GET /auth/google/callback', () => {
    describe('Error Parameter Handling', () => {
      it('should redirect with error when error param is present', async () => {
        const app = createApp();

        const response = await request(app).get('/auth/google/callback').query({ error: 'access_denied' });

        expect(response.status).toBe(302);
        expect(response.headers.location).toContain('error=access_denied');
      });

      it('should redirect to login page on error', async () => {
        const app = createApp();

        const response = await request(app).get('/auth/google/callback').query({ error: 'access_denied' });

        expect(response.status).toBe(302);
        expect(response.headers.location).toContain('/login');
      });
    });

    describe('Missing Code Handling', () => {
      it('should redirect with error when code is missing', async () => {
        const app = createApp();

        const response = await request(app).get('/auth/google/callback');

        expect(response.status).toBe(302);
        expect(response.headers.location).toContain('error=missing_code');
      });
    });

    describe('Successful Code Exchange', () => {
      it('should redirect to dashboard on success', async () => {
        mockExchangeCodeForSession.mockResolvedValueOnce({
          data: {
            session: {
              access_token: 'access-token-123',
              refresh_token: 'refresh-token-456',
              expires_in: 3600,
            },
            user: {
              id: 'user-123',
              email: 'user@example.com',
            },
          },
          error: null,
        });
        const app = createApp();

        const response = await request(app).get('/auth/google/callback').query({ code: 'valid-code' });

        expect(response.status).toBe(302);
        expect(response.headers.location).toContain('/dashboard');
      });

      it('should set access token cookie on success', async () => {
        mockExchangeCodeForSession.mockResolvedValueOnce({
          data: {
            session: { access_token: 'token', refresh_token: 'refresh', expires_in: 3600 },
            user: { id: 'user-1', email: 'test@test.com' },
          },
          error: null,
        });
        const app = createApp();

        const response = await request(app).get('/auth/google/callback').query({ code: 'valid-code' });

        expect(response.status).toBe(302);
        expect(response.headers['set-cookie']).toBeDefined();
        const cookies = response.headers['set-cookie'] as string[];
        expect(cookies.some((c: string) => c.includes('sb-access-token'))).toBe(true);
      });

      it('should use FRONTEND_URL for redirect when set', async () => {
        process.env.FRONTEND_URL = 'https://myapp.example.com';
        mockExchangeCodeForSession.mockResolvedValueOnce({
          data: {
            session: { access_token: 'token', refresh_token: 'refresh' },
            user: { id: 'user-1', email: 'test@test.com' },
          },
          error: null,
        });
        const app = createApp();

        const response = await request(app).get('/auth/google/callback').query({ code: 'valid-code' });

        expect(response.status).toBe(302);
        expect(response.headers.location).toContain('https://myapp.example.com/dashboard');
      });

      it('should handle missing session gracefully', async () => {
        mockExchangeCodeForSession.mockResolvedValueOnce({
          data: {
            session: null,
            user: { id: 'user-1', email: 'test@test.com' },
          },
          error: null,
        });
        const app = createApp();

        const response = await request(app).get('/auth/google/callback').query({ code: 'valid-code' });

        expect(response.status).toBe(302);
        expect(response.headers.location).toContain('/dashboard');
      });

      it('should pass the code to exchangeCodeForSession', async () => {
        mockExchangeCodeForSession.mockResolvedValueOnce({
          data: {
            session: { access_token: 'token', refresh_token: 'refresh' },
            user: { id: 'user-1', email: 'test@test.com' },
          },
          error: null,
        });
        const app = createApp();

        await request(app).get('/auth/google/callback').query({ code: 'my-auth-code-123' });

        expect(mockExchangeCodeForSession).toHaveBeenCalledWith('my-auth-code-123');
      });
    });

    describe('Code Exchange Errors', () => {
      it('should redirect with error when code exchange fails', async () => {
        mockExchangeCodeForSession.mockResolvedValueOnce({
          data: null,
          error: { message: 'Invalid code' },
        });
        const app = createApp();

        const response = await request(app).get('/auth/google/callback').query({ code: 'invalid-code' });

        expect(response.status).toBe(302);
        expect(response.headers.location).toContain('error=');
      });

      it('should redirect with error on unexpected exception', async () => {
        mockExchangeCodeForSession.mockRejectedValueOnce(new Error('Database error'));
        const app = createApp();

        const response = await request(app).get('/auth/google/callback').query({ code: 'test-code' });

        expect(response.status).toBe(302);
        expect(response.headers.location).toContain('error=server_error');
      });
    });
  });

  describe('Cookie Options', () => {
    it('should set httpOnly cookie', async () => {
      mockExchangeCodeForSession.mockResolvedValueOnce({
        data: {
          session: { access_token: 'token', refresh_token: 'refresh', expires_in: 3600 },
          user: { id: 'user-1', email: 'test@test.com' },
        },
        error: null,
      });
      const app = createApp();

      const response = await request(app).get('/auth/google/callback').query({ code: 'valid-code' });

      expect(response.status).toBe(302);
      const cookies = response.headers['set-cookie'] as string[];
      expect(cookies.some((c: string) => c.toLowerCase().includes('httponly'))).toBe(true);
    });

    it('should set sameSite=lax in non-production', async () => {
      process.env.NODE_ENV = 'test';
      mockExchangeCodeForSession.mockResolvedValueOnce({
        data: {
          session: { access_token: 'token', refresh_token: 'refresh', expires_in: 3600 },
          user: { id: 'user-1', email: 'test@test.com' },
        },
        error: null,
      });
      const app = createApp();

      const response = await request(app).get('/auth/google/callback').query({ code: 'valid-code' });

      expect(response.status).toBe(302);
      const cookies = response.headers['set-cookie'] as string[];
      expect(cookies.some((c: string) => c.toLowerCase().includes('samesite=lax'))).toBe(true);
    });
  });
});
