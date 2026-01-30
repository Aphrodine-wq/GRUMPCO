/**
 * Tests for authStore
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';

// Mock the api module
vi.mock('../lib/api.js', () => ({
  fetchApi: vi.fn(),
}));

// Import after mocking
import {
  user,
  session,
  loading,
  error,
  isAuthenticated,
  accessToken,
  login,
  logout,
  signup,
  clearError,
  resetAuthState,
} from './authStore';
import { fetchApi } from '../lib/api.js';

const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

describe('authStore', () => {
  beforeEach(() => {
    // Reset all stores
    resetAuthState();
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should start with null user', () => {
      expect(get(user)).toBeNull();
    });

    it('should start with null session', () => {
      expect(get(session)).toBeNull();
    });

    it('should not be authenticated initially', () => {
      expect(get(isAuthenticated)).toBe(false);
    });

    it('should have no access token initially', () => {
      expect(get(accessToken)).toBeNull();
    });

    it('should not be loading initially', () => {
      expect(get(loading)).toBe(false);
    });

    it('should have no error initially', () => {
      expect(get(error)).toBeNull();
    });
  });

  describe('login', () => {
    it('should set loading to true during login', async () => {
      mockFetchApi.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: () =>
                    Promise.resolve({
                      user: { id: '1', email: 'test@test.com' },
                      session: { access_token: 'token123' },
                    }),
                }),
              100
            )
          )
      );

      const loginPromise = login('test@test.com', 'password');
      expect(get(loading)).toBe(true);
      await loginPromise;
      expect(get(loading)).toBe(false);
    });

    it('should set user and session on successful login', async () => {
      const mockUser = { id: '1', email: 'test@test.com', name: 'Test User' };
      const mockSession = { access_token: 'token123', expires_at: '2025-12-31' };

      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ user: mockUser, session: mockSession }),
      });

      const result = await login('test@test.com', 'password');

      expect(result).toBe(true);
      expect(get(user)).toEqual(mockUser);
      expect(get(session)).toEqual(mockSession);
      expect(get(isAuthenticated)).toBe(true);
      expect(get(accessToken)).toBe('token123');
    });

    it('should set error on failed login', async () => {
      mockFetchApi.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Invalid credentials' }),
      });

      const result = await login('test@test.com', 'wrongpassword');

      expect(result).toBe(false);
      expect(get(error)).toBe('Invalid credentials');
      expect(get(user)).toBeNull();
      expect(get(session)).toBeNull();
    });

    it('should handle network errors', async () => {
      mockFetchApi.mockRejectedValue(new Error('Network error'));

      const result = await login('test@test.com', 'password');

      expect(result).toBe(false);
      expect(get(error)).toBe('Network error - please try again');
    });
  });

  describe('signup', () => {
    it('should set user and session on successful signup', async () => {
      const mockUser = { id: '2', email: 'new@test.com', name: 'New User' };
      const mockSession = { access_token: 'newtoken123' };

      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ user: mockUser, session: mockSession }),
      });

      const result = await signup('new@test.com', 'password123', 'New User');

      expect(result).toBe(true);
      expect(get(user)).toEqual(mockUser);
      expect(get(session)).toEqual(mockSession);
    });

    it('should set error on failed signup', async () => {
      mockFetchApi.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Email already exists' }),
      });

      const result = await signup('existing@test.com', 'password');

      expect(result).toBe(false);
      expect(get(error)).toBe('Email already exists');
    });
  });

  describe('logout', () => {
    it('should clear user and session on logout', async () => {
      // First, set up authenticated state
      user.set({ id: '1', email: 'test@test.com' });
      session.set({ access_token: 'token123' });

      mockFetchApi.mockResolvedValue({ ok: true });

      await logout();

      expect(get(user)).toBeNull();
      expect(get(session)).toBeNull();
      expect(get(isAuthenticated)).toBe(false);
    });

    it('should clear state even if API call fails', async () => {
      user.set({ id: '1', email: 'test@test.com' });
      session.set({ access_token: 'token123' });

      mockFetchApi.mockRejectedValue(new Error('Network error'));

      await logout();

      expect(get(user)).toBeNull();
      expect(get(session)).toBeNull();
    });
  });

  describe('helper functions', () => {
    it('clearError should clear the error', () => {
      error.set('Some error');
      expect(get(error)).toBe('Some error');

      clearError();
      expect(get(error)).toBeNull();
    });

    it('resetAuthState should reset all state', () => {
      user.set({ id: '1', email: 'test@test.com' });
      session.set({ access_token: 'token123' });
      loading.set(true);
      error.set('Some error');

      resetAuthState();

      expect(get(user)).toBeNull();
      expect(get(session)).toBeNull();
      expect(get(loading)).toBe(false);
      expect(get(error)).toBeNull();
    });
  });

  describe('derived stores', () => {
    it('isAuthenticated should be true when both user and session exist', () => {
      expect(get(isAuthenticated)).toBe(false);

      user.set({ id: '1', email: 'test@test.com' });
      expect(get(isAuthenticated)).toBe(false);

      session.set({ access_token: 'token123' });
      expect(get(isAuthenticated)).toBe(true);
    });

    it('accessToken should return the token from session', () => {
      expect(get(accessToken)).toBeNull();

      session.set({ access_token: 'mytoken' });
      expect(get(accessToken)).toBe('mytoken');

      session.set(null);
      expect(get(accessToken)).toBeNull();
    });
  });
});
