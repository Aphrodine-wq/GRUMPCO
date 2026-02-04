/**
 * Auth Middleware Tests
 * Comprehensive tests for authentication and authorization middleware.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Store original env
const originalNodeEnv = process.env.NODE_ENV;

// Mock env module
const mockEnv = {
  NODE_ENV: 'development' as 'development' | 'production' | 'test',
  REQUIRE_AUTH_FOR_API: false,
};

vi.mock('../../src/config/env.js', () => ({
  env: mockEnv,
}));

// Mock logger
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

vi.mock('../../src/middleware/logger.js', () => ({
  getRequestLogger: () => mockLogger,
  default: mockLogger,
}));

// Mock Supabase auth
const mockGetUser = vi.fn();

vi.mock('../../src/services/supabaseClient.js', () => ({
  auth: {
    getUser: (...args: unknown[]) => mockGetUser(...args),
  },
  isMockMode: false,
}));

// Helper to create mock Request
function createMockRequest(options: {
  path?: string;
  method?: string;
  headers?: Record<string, string>;
} = {}): Request {
  return {
    path: options.path ?? '/api/test',
    method: options.method ?? 'GET',
    headers: options.headers ?? {},
  } as unknown as Request;
}

// Helper to create mock Response
function createMockResponse(): Response & {
  _status: number;
  _json: unknown;
} {
  const res = {
    _status: 200,
    _json: null as unknown,
    status: vi.fn().mockImplementation(function (this: typeof res, code: number) {
      this._status = code;
      return this;
    }),
    json: vi.fn().mockImplementation(function (this: typeof res, data: unknown) {
      this._json = data;
      return this;
    }),
  };
  return res as unknown as Response & {
    _status: number;
    _json: unknown;
  };
}

// Create a properly typed mock NextFunction
function createMockNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

// Import types
import type { AuthenticatedRequest } from '../../src/middleware/authMiddleware.js';

describe('Auth Middleware', () => {
  let next: NextFunction;
  let requireAuth: typeof import('../../src/middleware/authMiddleware.js').requireAuth;
  let optionalAuth: typeof import('../../src/middleware/authMiddleware.js').optionalAuth;
  let requireAdmin: typeof import('../../src/middleware/authMiddleware.js').requireAdmin;
  let apiAuthMiddleware: typeof import('../../src/middleware/authMiddleware.js').apiAuthMiddleware;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    // Reset mock env to defaults
    mockEnv.NODE_ENV = 'development';
    mockEnv.REQUIRE_AUTH_FOR_API = false;

    // Reset mock functions
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    next = createMockNext();

    // Import fresh module
    const module = await import('../../src/middleware/authMiddleware.js');
    requireAuth = module.requireAuth;
    optionalAuth = module.optionalAuth;
    requireAdmin = module.requireAdmin;
    apiAuthMiddleware = module.apiAuthMiddleware;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    vi.useRealTimers();
  });

  describe('requireAuth', () => {
    it('should reject requests without authorization header', async () => {
      const req = createMockRequest({ headers: {} }) as AuthenticatedRequest;
      const res = createMockResponse();

      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res._json).toEqual({
        error: 'Missing or invalid authorization header',
        type: 'unauthorized',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject requests with non-Bearer authorization header', async () => {
      const req = createMockRequest({
        headers: { authorization: 'Basic dXNlcjpwYXNz' },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res._json).toEqual({
        error: 'Missing or invalid authorization header',
        type: 'unauthorized',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject requests with empty authorization header', async () => {
      const req = createMockRequest({
        headers: { authorization: '' },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res._json).toEqual({
        error: 'Missing or invalid authorization header',
        type: 'unauthorized',
      });
    });

    it('should reject requests when auth.getUser returns error', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' },
      });

      const req = createMockRequest({
        headers: { authorization: 'Bearer invalid-token' },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res._json).toEqual({
        error: 'Invalid or expired token',
        type: 'unauthorized',
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { error: 'Invalid token' },
        'Auth failed'
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject requests when auth.getUser returns no user', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const req = createMockRequest({
        headers: { authorization: 'Bearer valid-token-no-user' },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res._json).toEqual({
        error: 'Invalid or expired token',
        type: 'unauthorized',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should accept valid token and attach user to request', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        user_metadata: { name: 'Test User' },
        created_at: '2024-01-01T00:00:00Z',
      };

      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const req = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      await requireAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toEqual(mockUser);
      expect(req.token).toBe('valid-token');
      expect(mockLogger.info).toHaveBeenCalledWith(
        { userId: 'user-123' },
        'User authenticated'
      );
    });

    it('should handle auth service errors gracefully', async () => {
      mockGetUser.mockRejectedValue(new Error('Service unavailable'));

      const req = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res._json).toEqual({
        error: 'Authentication service unavailable',
        type: 'internal_error',
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        { error: 'Service unavailable' },
        'Auth middleware error'
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should extract token correctly from Bearer prefix', async () => {
      const mockUser = { id: 'user-123' };
      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const req = createMockRequest({
        headers: { authorization: 'Bearer my-jwt-token-here' },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      await requireAuth(req, res, next);

      expect(mockGetUser).toHaveBeenCalledWith('my-jwt-token-here');
      expect(req.token).toBe('my-jwt-token-here');
    });
  });

  describe('optionalAuth', () => {
    it('should allow requests without authorization header', async () => {
      const req = createMockRequest({ headers: {} }) as AuthenticatedRequest;
      const res = createMockResponse();

      await optionalAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });

    it('should allow requests with non-Bearer authorization header', async () => {
      const req = createMockRequest({
        headers: { authorization: 'Basic dXNlcjpwYXNz' },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      await optionalAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });

    it('should allow requests with empty authorization header', async () => {
      const req = createMockRequest({
        headers: { authorization: '' },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      await optionalAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });

    it('should attach user when valid token provided', async () => {
      const mockUser = {
        id: 'user-456',
        email: 'optional@example.com',
      };

      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const req = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      await optionalAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toEqual(mockUser);
      expect(req.token).toBe('valid-token');
    });

    it('should not attach user when token is invalid', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' },
      });

      const req = createMockRequest({
        headers: { authorization: 'Bearer invalid-token' },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      await optionalAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeUndefined();
      expect(req.token).toBeUndefined();
    });

    it('should not attach user when getUser returns no user', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const req = createMockRequest({
        headers: { authorization: 'Bearer no-user-token' },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      await optionalAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeUndefined();
      expect(req.token).toBeUndefined();
    });

    it('should handle auth service errors gracefully and continue', async () => {
      mockGetUser.mockRejectedValue(new Error('Service unavailable'));

      const req = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      await optionalAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeUndefined();
      expect(req.token).toBeUndefined();
    });
  });

  describe('requireAdmin', () => {
    it('should reject requests without authorization header', async () => {
      const req = createMockRequest({ headers: {} }) as AuthenticatedRequest;
      const res = createMockResponse();

      await requireAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res._json).toEqual({
        error: 'Missing or invalid authorization header',
        type: 'unauthorized',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject non-admin users with 403', async () => {
      const mockUser = {
        id: 'regular-user-123',
        email: 'user@example.com',
        user_metadata: {},
      };

      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const req = createMockRequest({
        headers: { authorization: 'Bearer user-token' },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      await requireAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res._json).toEqual({
        error: 'Admin access required',
        type: 'forbidden',
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { userId: 'regular-user-123', email: 'user@example.com' },
        'Admin access denied - insufficient privileges'
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow users with app_metadata.role = admin', async () => {
      const mockUser = {
        id: 'admin-user-123',
        email: 'admin@example.com',
        user_metadata: {
          app_metadata: { role: 'admin' },
        },
      };

      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const req = createMockRequest({
        headers: { authorization: 'Bearer admin-token' },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      await requireAdmin(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        { userId: 'admin-user-123' },
        'Admin access granted'
      );
    });

    it('should allow users with user_metadata.role = admin', async () => {
      const mockUser = {
        id: 'admin-user-456',
        email: 'admin2@example.com',
        user_metadata: { role: 'admin' },
      };

      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const req = createMockRequest({
        headers: { authorization: 'Bearer admin-token' },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      await requireAdmin(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        { userId: 'admin-user-456' },
        'Admin access granted'
      );
    });

    it('should allow @admin.local emails in development', async () => {
      mockEnv.NODE_ENV = 'development';

      // Re-import module with new env
      vi.resetModules();
      const module = await import('../../src/middleware/authMiddleware.js');
      requireAdmin = module.requireAdmin;

      const mockUser = {
        id: 'dev-admin-123',
        email: 'test@admin.local',
        user_metadata: {},
      };

      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const req = createMockRequest({
        headers: { authorization: 'Bearer dev-admin-token' },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      await requireAdmin(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should NOT allow @admin.local emails in production', async () => {
      mockEnv.NODE_ENV = 'production';

      // Re-import module with new env
      vi.resetModules();
      const module = await import('../../src/middleware/authMiddleware.js');
      requireAdmin = module.requireAdmin;

      const mockUser = {
        id: 'prod-user-123',
        email: 'test@admin.local',
        user_metadata: {},
      };

      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const req = createMockRequest({
        headers: { authorization: 'Bearer prod-token' },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      await requireAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res._json).toEqual({
        error: 'Admin access required',
        type: 'forbidden',
      });
    });

    it('should reject when requireAuth fails', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Token expired' },
      });

      const req = createMockRequest({
        headers: { authorization: 'Bearer expired-token' },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      await requireAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res._json).toEqual({
        error: 'Invalid or expired token',
        type: 'unauthorized',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject when user has no user_metadata', async () => {
      const mockUser = {
        id: 'no-metadata-user',
        email: 'user@example.com',
      };

      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const req = createMockRequest({
        headers: { authorization: 'Bearer token' },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      await requireAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject when user_metadata.app_metadata.role is not admin', async () => {
      const mockUser = {
        id: 'moderator-user',
        email: 'mod@example.com',
        user_metadata: {
          app_metadata: { role: 'moderator' },
        },
      };

      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const req = createMockRequest({
        headers: { authorization: 'Bearer mod-token' },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      await requireAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject when user_metadata.role is not admin', async () => {
      const mockUser = {
        id: 'editor-user',
        email: 'editor@example.com',
        user_metadata: { role: 'editor' },
      };

      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const req = createMockRequest({
        headers: { authorization: 'Bearer editor-token' },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      await requireAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('apiAuthMiddleware', () => {
    describe('when REQUIRE_AUTH_FOR_API is false', () => {
      beforeEach(async () => {
        mockEnv.REQUIRE_AUTH_FOR_API = false;
        vi.resetModules();
        const module = await import('../../src/middleware/authMiddleware.js');
        apiAuthMiddleware = module.apiAuthMiddleware;
      });

      it('should use optionalAuth for /api/chat', async () => {
        const req = createMockRequest({
          path: '/api/chat',
          headers: {},
        }) as AuthenticatedRequest;
        const res = createMockResponse();

        await apiAuthMiddleware(req, res, next);

        // optionalAuth should allow without auth
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      it('should use optionalAuth for /api/ship', async () => {
        const req = createMockRequest({
          path: '/api/ship',
          headers: {},
        }) as AuthenticatedRequest;
        const res = createMockResponse();

        await apiAuthMiddleware(req, res, next);

        expect(next).toHaveBeenCalled();
      });

      it('should use optionalAuth for /api/codegen', async () => {
        const req = createMockRequest({
          path: '/api/codegen',
          headers: {},
        }) as AuthenticatedRequest;
        const res = createMockResponse();

        await apiAuthMiddleware(req, res, next);

        expect(next).toHaveBeenCalled();
      });

      it('should use optionalAuth for non-protected paths', async () => {
        const req = createMockRequest({
          path: '/api/health',
          headers: {},
        }) as AuthenticatedRequest;
        const res = createMockResponse();

        await apiAuthMiddleware(req, res, next);

        expect(next).toHaveBeenCalled();
      });

      it('should attach user if valid token provided', async () => {
        const mockUser = { id: 'user-123' };
        mockGetUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });

        const req = createMockRequest({
          path: '/api/chat',
          headers: { authorization: 'Bearer valid-token' },
        }) as AuthenticatedRequest;
        const res = createMockResponse();

        await apiAuthMiddleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.user).toEqual(mockUser);
      });
    });

    describe('when REQUIRE_AUTH_FOR_API is true', () => {
      beforeEach(async () => {
        mockEnv.REQUIRE_AUTH_FOR_API = true;
        vi.resetModules();
        const module = await import('../../src/middleware/authMiddleware.js');
        apiAuthMiddleware = module.apiAuthMiddleware;
      });

      it('should require auth for /api/chat', async () => {
        const req = createMockRequest({
          path: '/api/chat',
          headers: {},
        }) as AuthenticatedRequest;
        const res = createMockResponse();

        await apiAuthMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
      });

      it('should require auth for /api/ship', async () => {
        const req = createMockRequest({
          path: '/api/ship',
          headers: {},
        }) as AuthenticatedRequest;
        const res = createMockResponse();

        await apiAuthMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
      });

      it('should require auth for /api/codegen', async () => {
        const req = createMockRequest({
          path: '/api/codegen',
          headers: {},
        }) as AuthenticatedRequest;
        const res = createMockResponse();

        await apiAuthMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
      });

      it('should require auth for /api/chat subpaths', async () => {
        const req = createMockRequest({
          path: '/api/chat/messages',
          headers: {},
        }) as AuthenticatedRequest;
        const res = createMockResponse();

        await apiAuthMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
      });

      it('should require auth for /api/ship/deploy subpath', async () => {
        const req = createMockRequest({
          path: '/api/ship/deploy',
          headers: {},
        }) as AuthenticatedRequest;
        const res = createMockResponse();

        await apiAuthMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
      });

      it('should require auth for /api/codegen/generate subpath', async () => {
        const req = createMockRequest({
          path: '/api/codegen/generate',
          headers: {},
        }) as AuthenticatedRequest;
        const res = createMockResponse();

        await apiAuthMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
      });

      it('should NOT require auth for /api/health (non-protected)', async () => {
        const req = createMockRequest({
          path: '/api/health',
          headers: {},
        }) as AuthenticatedRequest;
        const res = createMockResponse();

        await apiAuthMiddleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      it('should NOT require auth for /api/models (non-protected)', async () => {
        const req = createMockRequest({
          path: '/api/models',
          headers: {},
        }) as AuthenticatedRequest;
        const res = createMockResponse();

        await apiAuthMiddleware(req, res, next);

        expect(next).toHaveBeenCalled();
      });

      it('should allow protected paths with valid auth', async () => {
        const mockUser = { id: 'user-789' };
        mockGetUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });

        const req = createMockRequest({
          path: '/api/chat',
          headers: { authorization: 'Bearer valid-token' },
        }) as AuthenticatedRequest;
        const res = createMockResponse();

        await apiAuthMiddleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.user).toEqual(mockUser);
      });

      it('should reject protected paths with invalid auth', async () => {
        mockGetUser.mockResolvedValue({
          data: { user: null },
          error: { message: 'Invalid token' },
        });

        const req = createMockRequest({
          path: '/api/chat',
          headers: { authorization: 'Bearer invalid-token' },
        }) as AuthenticatedRequest;
        const res = createMockResponse();

        await apiAuthMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
      });
    });
  });

  describe('isProtectedApiPath helper', () => {
    beforeEach(async () => {
      mockEnv.REQUIRE_AUTH_FOR_API = true;
      vi.resetModules();
      const module = await import('../../src/middleware/authMiddleware.js');
      apiAuthMiddleware = module.apiAuthMiddleware;
    });

    it('should match exact /api/chat path', async () => {
      const req = createMockRequest({
        path: '/api/chat',
        headers: {},
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      await apiAuthMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should match exact /api/ship path', async () => {
      const req = createMockRequest({
        path: '/api/ship',
        headers: {},
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      await apiAuthMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should match exact /api/codegen path', async () => {
      const req = createMockRequest({
        path: '/api/codegen',
        headers: {},
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      await apiAuthMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should NOT match similar path like /api/chatbot', async () => {
      const req = createMockRequest({
        path: '/api/chatbot',
        headers: {},
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      await apiAuthMiddleware(req, res, next);

      // Should use optionalAuth for non-protected path
      expect(next).toHaveBeenCalled();
    });

    it('should NOT match /api/shipper', async () => {
      const req = createMockRequest({
        path: '/api/shipper',
        headers: {},
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      await apiAuthMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should NOT match /api/codegeneration', async () => {
      const req = createMockRequest({
        path: '/api/codegeneration',
        headers: {},
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      await apiAuthMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('checkAdminRole edge cases', () => {
    it('should return false for null user', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const req = createMockRequest({
        headers: { authorization: 'Bearer token' },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      await requireAdmin(req, res, next);

      // Should fail at requireAuth level, not checkAdminRole
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should check app_metadata before user_metadata', async () => {
      // User has both app_metadata.role and user_metadata.role
      // app_metadata.role should take precedence
      const mockUser = {
        id: 'dual-role-user',
        email: 'dual@example.com',
        user_metadata: {
          role: 'user', // This would deny admin
          app_metadata: { role: 'admin' }, // This should grant admin
        },
      };

      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const req = createMockRequest({
        headers: { authorization: 'Bearer token' },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      await requireAdmin(req, res, next);

      // Should allow because app_metadata.role = admin
      expect(next).toHaveBeenCalled();
    });

    it('should handle undefined app_metadata gracefully', async () => {
      const mockUser = {
        id: 'no-app-metadata-user',
        email: 'user@example.com',
        user_metadata: {
          // No app_metadata property
          role: 'admin', // Should still work with user_metadata.role
        },
      };

      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const req = createMockRequest({
        headers: { authorization: 'Bearer token' },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      await requireAdmin(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should handle null user_metadata gracefully', async () => {
      const mockUser = {
        id: 'null-metadata-user',
        email: 'user@example.com',
        user_metadata: null,
      };

      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const req = createMockRequest({
        headers: { authorization: 'Bearer token' },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      await requireAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('default export', () => {
    it('should export all middleware functions', async () => {
      const module = await import('../../src/middleware/authMiddleware.js');

      expect(module.default).toBeDefined();
      expect(module.default.requireAuth).toBe(module.requireAuth);
      expect(module.default.optionalAuth).toBe(module.optionalAuth);
      expect(module.default.requireAdmin).toBe(module.requireAdmin);
      expect(module.default.apiAuthMiddleware).toBe(module.apiAuthMiddleware);
    });
  });

  describe('AuthenticatedRequest type', () => {
    it('should support user property on request', async () => {
      const mockUser = {
        id: 'typed-user-123',
        email: 'typed@example.com',
        user_metadata: { custom: 'data' },
        created_at: '2024-01-01T00:00:00Z',
      };

      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const req = createMockRequest({
        headers: { authorization: 'Bearer token' },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      await requireAuth(req, res, next);

      // Type should support all user properties
      expect(req.user?.id).toBe('typed-user-123');
      expect(req.user?.email).toBe('typed@example.com');
      expect(req.user?.user_metadata).toEqual({ custom: 'data' });
      expect(req.user?.created_at).toBe('2024-01-01T00:00:00Z');
      expect(req.token).toBe('token');
    });
  });
});
