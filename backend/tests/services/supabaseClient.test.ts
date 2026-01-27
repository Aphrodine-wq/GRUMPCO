import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the logger
vi.mock('../../src/middleware/logger.ts', () => ({
  default: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('supabaseClient', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getUser (Mock Mode)', () => {
    beforeEach(() => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_KEY;
      vi.resetModules();
    });

    it('should return null user when no token provided', async () => {
      const { auth } = await import('../../src/services/supabaseClient.ts');
      const result = await auth.getUser('');
      
      expect(result.data.user).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('No token provided');
    });

    it('should return null user when token is invalid', async () => {
      const { auth } = await import('../../src/services/supabaseClient.ts');
      const result = await auth.getUser('invalid-token');
      
      expect(result.data.user).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Invalid token');
    });

    it('should return user when token is valid', async () => {
      const { auth } = await import('../../src/services/supabaseClient.ts');
      
      // First sign up to create a user and get a token
      const signUpResult = await auth.signUp({
        email: `test-${Date.now()}@example.com`,
        password: 'password123',
      });
      
      expect(signUpResult.error).toBeNull();
      expect(signUpResult.data.user).toBeDefined();
      expect(signUpResult.data.session).toBeDefined();
      
      const token = (signUpResult.data.session as { access_token: string }).access_token;
      
      // Now get user with the token
      const getUserResult = await auth.getUser(token);
      
      expect(getUserResult.error).toBeNull();
      expect(getUserResult.data.user).toBeDefined();
      expect((getUserResult.data.user as { email: string }).email).toBe(signUpResult.data.user?.email);
    });
  });

  describe('signUp (Mock Mode)', () => {
    beforeEach(() => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_KEY;
      vi.resetModules();
    });

    it('should create new user successfully', async () => {
      const { auth } = await import('../../src/services/supabaseClient.ts');
      const email = `newuser-${Date.now()}@example.com`;
      const result = await auth.signUp({
        email,
        password: 'password123',
      });
      
      expect(result.error).toBeNull();
      expect(result.data.user).toBeDefined();
      expect((result.data.user as { email: string }).email).toBe(email);
      expect(result.data.session).toBeDefined();
      expect((result.data.session as { access_token: string }).access_token).toBeDefined();
    });

    it('should reject duplicate email', async () => {
      const { auth } = await import('../../src/services/supabaseClient.ts');
      const email = `duplicate-${Date.now()}@example.com`;
      
      // First signup
      await auth.signUp({
        email,
        password: 'password123',
      });
      
      // Second signup with same email
      const result = await auth.signUp({
        email,
        password: 'password123',
      });
      
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('User already exists');
      expect(result.data.user).toBeNull();
    });

    it('should include user metadata when provided', async () => {
      const { auth } = await import('../../src/services/supabaseClient.ts');
      const email = `metadata-${Date.now()}@example.com`;
      const result = await auth.signUp({
        email,
        password: 'password123',
        options: {
          data: {
            name: 'Test User',
            role: 'admin',
          },
        },
      });
      
      expect(result.error).toBeNull();
      expect(result.data.user).toBeDefined();
      const user = result.data.user as { user_metadata: Record<string, unknown> };
      expect(user.user_metadata.name).toBe('Test User');
      expect(user.user_metadata.role).toBe('admin');
    });
  });

  describe('signInWithPassword (Mock Mode)', () => {
    beforeEach(() => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_KEY;
      vi.resetModules();
    });

    it('should sign in existing user successfully', async () => {
      const { auth } = await import('../../src/services/supabaseClient.ts');
      const email = `signin-${Date.now()}@example.com`;
      
      // First create user
      await auth.signUp({
        email,
        password: 'password123',
      });
      
      // Then sign in
      const result = await auth.signInWithPassword({
        email,
        password: 'password123',
      });
      
      expect(result.error).toBeNull();
      expect(result.data.user).toBeDefined();
      expect((result.data.user as { email: string }).email).toBe(email);
      expect(result.data.session).toBeDefined();
    });

    it('should reject invalid password for existing user', async () => {
      const { auth } = await import('../../src/services/supabaseClient.ts');
      const email = `signin-wrong-${Date.now()}@example.com`;

      await auth.signUp({
        email,
        password: 'password123',
      });

      const result = await auth.signInWithPassword({
        email,
        password: 'wrong-password',
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Invalid credentials');
      expect(result.data.user).toBeNull();
      expect(result.data.session).toBeNull();
    });

    it('should reject invalid credentials', async () => {
      const { auth } = await import('../../src/services/supabaseClient.ts');
      
      const result = await auth.signInWithPassword({
        email: 'nonexistent@example.com',
        password: 'wrongpassword',
      });
      
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Invalid credentials');
      expect(result.data.user).toBeNull();
      expect(result.data.session).toBeNull();
    });
  });

  describe('signOut (Mock Mode)', () => {
    beforeEach(() => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_KEY;
      vi.resetModules();
    });

    it('should sign out user and remove session', async () => {
      const { auth } = await import('../../src/services/supabaseClient.ts');
      const email = `signout-${Date.now()}@example.com`;
      
      // Create user and get token
      const signUpResult = await auth.signUp({
        email,
        password: 'password123',
      });
      
      const token = (signUpResult.data.session as { access_token: string }).access_token;
      
      // Verify user can be retrieved
      let getUserResult = await auth.getUser(token);
      expect(getUserResult.data.user).toBeDefined();
      
      // Sign out
      const signOutResult = await auth.signOut(token);
      expect(signOutResult.error).toBeNull();
      
      // Verify user can no longer be retrieved
      getUserResult = await auth.getUser(token);
      expect(getUserResult.error).toBeDefined();
      expect(getUserResult.error?.message).toBe('Invalid token');
    });

    it('should handle sign out without token', async () => {
      const { auth } = await import('../../src/services/supabaseClient.ts');
      
      const result = await auth.signOut();
      expect(result.error).toBeNull();
    });
  });

  describe('from (Mock Mode)', () => {
    beforeEach(() => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_KEY;
      vi.resetModules();
    });

    it('should return mock query builder', async () => {
      const { db } = await import('../../src/services/supabaseClient.ts');
      const query = db.from('users');
      
      expect(query).toBeDefined();
      expect(query.select).toBeDefined();
      expect(query.insert).toBeDefined();
      expect(query.update).toBeDefined();
      expect(query.delete).toBeDefined();
      expect(query.eq).toBeDefined();
      expect(query.single).toBeDefined();
    });

    it('should return empty data from select', async () => {
      const { db } = await import('../../src/services/supabaseClient.ts');
      const query = db.from('users');
      const result = query.select();
      
      expect(result.data).toEqual([]);
      expect(result.error).toBeNull();
    });

    it('should chain eq method', async () => {
      const { db } = await import('../../src/services/supabaseClient.ts');
      const query = db.from('users');
      const chained = query.eq('id', '123');
      
      expect(chained).toBe(query);
    });
  });
});
