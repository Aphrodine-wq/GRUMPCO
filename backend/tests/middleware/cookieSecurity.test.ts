/**
 * Tests for cookieSecurity.ts middleware
 * Covers secure cookie options, OAuth cookies, preference cookies, and middleware
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, CookieOptions } from 'express';

// Mock Express Request
function createMockRequest(options: Partial<Request> = {}): Request {
  return {
    protocol: 'http',
    get: vi.fn().mockReturnValue(undefined),
    ...options,
  } as unknown as Request;
}

// Mock Express Response
function createMockResponse(): Response & { _cookies: Map<string, { value: string; options: CookieOptions }> } {
  const cookies = new Map<string, { value: string; options: CookieOptions }>();
  return {
    _cookies: cookies,
    cookie: vi.fn((name: string, value: string, options?: CookieOptions) => {
      cookies.set(name, { value, options: options || {} });
      return this;
    }),
    clearCookie: vi.fn(),
  } as unknown as Response & { _cookies: Map<string, { value: string; options: CookieOptions }> };
}

describe('cookieSecurity', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getSecureCookieOptions', () => {
    it('should return httpOnly true', async () => {
      // Development mode
      process.env.NODE_ENV = 'development';
      const { getSecureCookieOptions } = await import('../../src/middleware/cookieSecurity.js');
      
      const req = createMockRequest();
      const options = getSecureCookieOptions(req);

      expect(options.httpOnly).toBe(true);
    });

    it('should set secure false in development with http', async () => {
      process.env.NODE_ENV = 'development';
      const { getSecureCookieOptions } = await import('../../src/middleware/cookieSecurity.js');
      
      const req = createMockRequest({ protocol: 'http' });
      const options = getSecureCookieOptions(req);

      expect(options.secure).toBe(false);
    });

    it('should set secure true in production', async () => {
      process.env.NODE_ENV = 'production';
      const { getSecureCookieOptions } = await import('../../src/middleware/cookieSecurity.js');
      
      const req = createMockRequest();
      const options = getSecureCookieOptions(req);

      expect(options.secure).toBe(true);
    });

    it('should set secure true when protocol is https', async () => {
      process.env.NODE_ENV = 'development';
      const { getSecureCookieOptions } = await import('../../src/middleware/cookieSecurity.js');
      
      const req = createMockRequest({ protocol: 'https' });
      const options = getSecureCookieOptions(req);

      expect(options.secure).toBe(true);
    });

    it('should set secure true when x-forwarded-proto is https', async () => {
      process.env.NODE_ENV = 'development';
      const { getSecureCookieOptions } = await import('../../src/middleware/cookieSecurity.js');
      
      const req = createMockRequest();
      (req.get as ReturnType<typeof vi.fn>).mockImplementation((header: string) => {
        if (header === 'x-forwarded-proto') return 'https';
        return undefined;
      });
      
      const options = getSecureCookieOptions(req);

      expect(options.secure).toBe(true);
    });

    it('should set sameSite to strict', async () => {
      process.env.NODE_ENV = 'development';
      const { getSecureCookieOptions } = await import('../../src/middleware/cookieSecurity.js');
      
      const req = createMockRequest();
      const options = getSecureCookieOptions(req);

      expect(options.sameSite).toBe('strict');
    });

    it('should use default maxAge of 3600 seconds (1 hour)', async () => {
      process.env.NODE_ENV = 'development';
      const { getSecureCookieOptions } = await import('../../src/middleware/cookieSecurity.js');
      
      const req = createMockRequest();
      const options = getSecureCookieOptions(req);

      expect(options.maxAge).toBe(3600 * 1000);
    });

    it('should accept custom maxAge', async () => {
      process.env.NODE_ENV = 'development';
      const { getSecureCookieOptions } = await import('../../src/middleware/cookieSecurity.js');
      
      const req = createMockRequest();
      const options = getSecureCookieOptions(req, 7200);

      expect(options.maxAge).toBe(7200 * 1000);
    });

    it('should set path to root', async () => {
      process.env.NODE_ENV = 'development';
      const { getSecureCookieOptions } = await import('../../src/middleware/cookieSecurity.js');
      
      const req = createMockRequest();
      const options = getSecureCookieOptions(req);

      expect(options.path).toBe('/');
    });

    it('should include domain in production when COOKIE_DOMAIN is set', async () => {
      process.env.NODE_ENV = 'production';
      process.env.COOKIE_DOMAIN = '.example.com';
      const { getSecureCookieOptions } = await import('../../src/middleware/cookieSecurity.js');
      
      const req = createMockRequest();
      const options = getSecureCookieOptions(req);

      expect(options.domain).toBe('.example.com');
    });

    it('should not include domain in development', async () => {
      process.env.NODE_ENV = 'development';
      process.env.COOKIE_DOMAIN = '.example.com';
      const { getSecureCookieOptions } = await import('../../src/middleware/cookieSecurity.js');
      
      const req = createMockRequest();
      const options = getSecureCookieOptions(req);

      expect(options.domain).toBeUndefined();
    });
  });

  describe('getOAuthCookieOptions', () => {
    it('should set sameSite to lax for OAuth redirects', async () => {
      process.env.NODE_ENV = 'development';
      const { getOAuthCookieOptions } = await import('../../src/middleware/cookieSecurity.js');
      
      const req = createMockRequest();
      const options = getOAuthCookieOptions(req);

      expect(options.sameSite).toBe('lax');
    });

    it('should set httpOnly true', async () => {
      process.env.NODE_ENV = 'development';
      const { getOAuthCookieOptions } = await import('../../src/middleware/cookieSecurity.js');
      
      const req = createMockRequest();
      const options = getOAuthCookieOptions(req);

      expect(options.httpOnly).toBe(true);
    });

    it('should use default maxAge of 600 seconds (10 minutes)', async () => {
      process.env.NODE_ENV = 'development';
      const { getOAuthCookieOptions } = await import('../../src/middleware/cookieSecurity.js');
      
      const req = createMockRequest();
      const options = getOAuthCookieOptions(req);

      expect(options.maxAge).toBe(600 * 1000);
    });

    it('should accept custom maxAge', async () => {
      process.env.NODE_ENV = 'development';
      const { getOAuthCookieOptions } = await import('../../src/middleware/cookieSecurity.js');
      
      const req = createMockRequest();
      const options = getOAuthCookieOptions(req, 1200);

      expect(options.maxAge).toBe(1200 * 1000);
    });

    it('should set secure based on protocol', async () => {
      process.env.NODE_ENV = 'development';
      const { getOAuthCookieOptions } = await import('../../src/middleware/cookieSecurity.js');
      
      const reqHttp = createMockRequest({ protocol: 'http' });
      const reqHttps = createMockRequest({ protocol: 'https' });
      
      expect(getOAuthCookieOptions(reqHttp).secure).toBe(false);
      expect(getOAuthCookieOptions(reqHttps).secure).toBe(true);
    });

    it('should set path to root', async () => {
      process.env.NODE_ENV = 'development';
      const { getOAuthCookieOptions } = await import('../../src/middleware/cookieSecurity.js');
      
      const req = createMockRequest();
      const options = getOAuthCookieOptions(req);

      expect(options.path).toBe('/');
    });
  });

  describe('getPreferenceCookieOptions', () => {
    it('should set httpOnly false for JS access', async () => {
      process.env.NODE_ENV = 'development';
      const { getPreferenceCookieOptions } = await import('../../src/middleware/cookieSecurity.js');
      
      const options = getPreferenceCookieOptions();

      expect(options.httpOnly).toBe(false);
    });

    it('should use default maxAge of 1 year', async () => {
      process.env.NODE_ENV = 'development';
      const { getPreferenceCookieOptions } = await import('../../src/middleware/cookieSecurity.js');
      
      const options = getPreferenceCookieOptions();

      expect(options.maxAge).toBe(31536000 * 1000);
    });

    it('should accept custom maxAge', async () => {
      process.env.NODE_ENV = 'development';
      const { getPreferenceCookieOptions } = await import('../../src/middleware/cookieSecurity.js');
      
      const options = getPreferenceCookieOptions(86400);

      expect(options.maxAge).toBe(86400 * 1000);
    });

    it('should set sameSite to strict', async () => {
      process.env.NODE_ENV = 'development';
      const { getPreferenceCookieOptions } = await import('../../src/middleware/cookieSecurity.js');
      
      const options = getPreferenceCookieOptions();

      expect(options.sameSite).toBe('strict');
    });

    it('should set secure based on environment', async () => {
      process.env.NODE_ENV = 'development';
      let { getPreferenceCookieOptions } = await import('../../src/middleware/cookieSecurity.js');
      expect(getPreferenceCookieOptions().secure).toBe(false);

      vi.resetModules();
      process.env.NODE_ENV = 'production';
      const reloaded = await import('../../src/middleware/cookieSecurity.js');
      expect(reloaded.getPreferenceCookieOptions().secure).toBe(true);
    });

    it('should set path to root', async () => {
      process.env.NODE_ENV = 'development';
      const { getPreferenceCookieOptions } = await import('../../src/middleware/cookieSecurity.js');
      
      const options = getPreferenceCookieOptions();

      expect(options.path).toBe('/');
    });
  });

  describe('setSecureCookie', () => {
    it('should set cookie with secure defaults', async () => {
      process.env.NODE_ENV = 'development';
      const { setSecureCookie } = await import('../../src/middleware/cookieSecurity.js');
      
      const req = createMockRequest();
      const res = createMockResponse();

      setSecureCookie(res, req, 'session', 'abc123');

      expect(res.cookie).toHaveBeenCalledWith('session', 'abc123', expect.objectContaining({
        httpOnly: true,
        sameSite: 'strict',
        path: '/',
      }));
    });

    it('should allow overriding options', async () => {
      process.env.NODE_ENV = 'development';
      const { setSecureCookie } = await import('../../src/middleware/cookieSecurity.js');
      
      const req = createMockRequest();
      const res = createMockResponse();

      setSecureCookie(res, req, 'session', 'abc123', { sameSite: 'lax' });

      expect(res.cookie).toHaveBeenCalledWith('session', 'abc123', expect.objectContaining({
        sameSite: 'lax',
      }));
    });

    it('should merge custom options with defaults', async () => {
      process.env.NODE_ENV = 'development';
      const { setSecureCookie } = await import('../../src/middleware/cookieSecurity.js');
      
      const req = createMockRequest();
      const res = createMockResponse();

      setSecureCookie(res, req, 'session', 'abc123', { maxAge: 5000 });

      expect(res.cookie).toHaveBeenCalledWith('session', 'abc123', expect.objectContaining({
        httpOnly: true,
        maxAge: 5000,
      }));
    });
  });

  describe('clearSecureCookie', () => {
    it('should clear cookie with secure options', async () => {
      process.env.NODE_ENV = 'development';
      const { clearSecureCookie } = await import('../../src/middleware/cookieSecurity.js');
      
      const res = createMockResponse();

      clearSecureCookie(res, 'session');

      expect(res.clearCookie).toHaveBeenCalledWith('session', {
        httpOnly: true,
        secure: false,
        sameSite: 'strict',
        path: '/',
      });
    });

    it('should set secure true in production when clearing', async () => {
      process.env.NODE_ENV = 'production';
      const { clearSecureCookie } = await import('../../src/middleware/cookieSecurity.js');
      
      const res = createMockResponse();

      clearSecureCookie(res, 'session');

      expect(res.clearCookie).toHaveBeenCalledWith('session', expect.objectContaining({
        secure: true,
      }));
    });
  });

  describe('secureCookieMiddleware', () => {
    it('should call next()', async () => {
      process.env.NODE_ENV = 'development';
      const { secureCookieMiddleware } = await import('../../src/middleware/cookieSecurity.js');
      
      const req = createMockRequest();
      const res = createMockResponse();
      const next = vi.fn();

      secureCookieMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should override res.cookie to enforce secure defaults', async () => {
      process.env.NODE_ENV = 'development';
      const { secureCookieMiddleware } = await import('../../src/middleware/cookieSecurity.js');
      
      const req = createMockRequest();
      const originalCookie = vi.fn();
      const res = {
        cookie: originalCookie,
      } as unknown as Response;
      const next = vi.fn();

      secureCookieMiddleware(req, res, next);

      // Now call res.cookie
      res.cookie('test', 'value');

      expect(originalCookie).toHaveBeenCalledWith('test', 'value', expect.objectContaining({
        httpOnly: true,
        sameSite: 'strict',
      }));
    });

    it('should allow overriding security options in middleware-wrapped cookie', async () => {
      process.env.NODE_ENV = 'development';
      const { secureCookieMiddleware } = await import('../../src/middleware/cookieSecurity.js');
      
      const req = createMockRequest();
      const originalCookie = vi.fn();
      const res = {
        cookie: originalCookie,
      } as unknown as Response;
      const next = vi.fn();

      secureCookieMiddleware(req, res, next);

      // Override with OAuth options
      res.cookie('oauth_state', 'value', { sameSite: 'lax' });

      expect(originalCookie).toHaveBeenCalledWith('oauth_state', 'value', expect.objectContaining({
        sameSite: 'lax',
      }));
    });

    it('should set secure true when protocol is https', async () => {
      process.env.NODE_ENV = 'development';
      const { secureCookieMiddleware } = await import('../../src/middleware/cookieSecurity.js');
      
      const req = createMockRequest({ protocol: 'https' });
      const originalCookie = vi.fn();
      const res = {
        cookie: originalCookie,
      } as unknown as Response;
      const next = vi.fn();

      secureCookieMiddleware(req, res, next);
      res.cookie('test', 'value');

      expect(originalCookie).toHaveBeenCalledWith('test', 'value', expect.objectContaining({
        secure: true,
      }));
    });

    it('should set secure true in production', async () => {
      process.env.NODE_ENV = 'production';
      const { secureCookieMiddleware } = await import('../../src/middleware/cookieSecurity.js');
      
      const req = createMockRequest({ protocol: 'http' });
      const originalCookie = vi.fn();
      const res = {
        cookie: originalCookie,
      } as unknown as Response;
      const next = vi.fn();

      secureCookieMiddleware(req, res, next);
      res.cookie('test', 'value');

      expect(originalCookie).toHaveBeenCalledWith('test', 'value', expect.objectContaining({
        secure: true,
      }));
    });
  });

  describe('default export', () => {
    it('should export all functions', async () => {
      process.env.NODE_ENV = 'development';
      const cookieSecurity = await import('../../src/middleware/cookieSecurity.js');
      
      expect(cookieSecurity.default).toBeDefined();
      expect(cookieSecurity.default.getSecureCookieOptions).toBe(cookieSecurity.getSecureCookieOptions);
      expect(cookieSecurity.default.getOAuthCookieOptions).toBe(cookieSecurity.getOAuthCookieOptions);
      expect(cookieSecurity.default.getPreferenceCookieOptions).toBe(cookieSecurity.getPreferenceCookieOptions);
      expect(cookieSecurity.default.setSecureCookie).toBe(cookieSecurity.setSecureCookie);
      expect(cookieSecurity.default.clearSecureCookie).toBe(cookieSecurity.clearSecureCookie);
      expect(cookieSecurity.default.secureCookieMiddleware).toBe(cookieSecurity.secureCookieMiddleware);
    });
  });
});
