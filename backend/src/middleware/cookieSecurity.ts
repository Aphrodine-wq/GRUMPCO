/**
 * Cookie Security Middleware
 *
 * Provides secure cookie defaults and utilities for the application.
 * All cookies should use these helpers to ensure consistent security settings.
 */

import type { Request, Response, CookieOptions } from 'express';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Secure cookie options for session/auth cookies
 */
export function getSecureCookieOptions(req: Request, maxAgeSeconds = 3600): CookieOptions {
  const isSecure =
    isProduction || req.protocol === 'https' || req.get('x-forwarded-proto') === 'https';

  return {
    httpOnly: true, // Prevents JavaScript access
    secure: isSecure, // Only sent over HTTPS
    sameSite: 'strict', // CSRF protection
    maxAge: maxAgeSeconds * 1000,
    path: '/',
    // Domain should be set explicitly in production if using subdomains
    ...(isProduction && process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
  };
}

/**
 * Cookie options for OAuth flow (needs 'lax' for redirect compatibility)
 */
export function getOAuthCookieOptions(req: Request, maxAgeSeconds = 600): CookieOptions {
  const isSecure =
    isProduction || req.protocol === 'https' || req.get('x-forwarded-proto') === 'https';

  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax', // Required for OAuth redirects
    maxAge: maxAgeSeconds * 1000,
    path: '/',
  };
}

/**
 * Cookie options for non-sensitive preferences (can be read by JS)
 */
export function getPreferenceCookieOptions(maxAgeSeconds = 31536000): CookieOptions {
  return {
    httpOnly: false, // Allow JS access for preferences
    secure: isProduction,
    sameSite: 'strict',
    maxAge: maxAgeSeconds * 1000,
    path: '/',
  };
}

/**
 * Set a secure cookie with logging
 */
export function setSecureCookie(
  res: Response,
  req: Request,
  name: string,
  value: string,
  options?: Partial<CookieOptions>
): void {
  const defaultOptions = getSecureCookieOptions(req);
  res.cookie(name, value, { ...defaultOptions, ...options });
}

/**
 * Clear a cookie securely
 */
export function clearSecureCookie(res: Response, name: string): void {
  res.clearCookie(name, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
  });
}

/**
 * Middleware to set secure cookie defaults via response header
 */
export function secureCookieMiddleware(req: Request, res: Response, next: () => void): void {
  // Override res.cookie to enforce security defaults
  const originalCookie = res.cookie.bind(res);

  res.cookie = function (name: string, value: string, options?: CookieOptions) {
    const secureOptions: CookieOptions = {
      httpOnly: true,
      secure: isProduction || req.protocol === 'https',
      sameSite: 'strict',
      ...options, // Allow override for specific cases like OAuth
    };
    return originalCookie(name, value, secureOptions);
  };

  next();
}

export default {
  getSecureCookieOptions,
  getOAuthCookieOptions,
  getPreferenceCookieOptions,
  setSecureCookie,
  clearSecureCookie,
  secureCookieMiddleware,
};
