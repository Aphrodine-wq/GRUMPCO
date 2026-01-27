import { writable, derived } from 'svelte/store';

const AUTH_STORAGE_KEY = 'mermaid-auth';
const API_BASE = typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL 
  ? import.meta.env.VITE_API_URL 
  : 'http://localhost:3000';

// Types
export interface User {
  id: string;
  email: string;
  name?: string;
  created_at?: string;
}

export interface AuthSession {
  access_token: string;
  expires_at?: string;
}

interface StoredAuth {
  user: User | null;
  session: AuthSession | null;
}

// Create stores
export const user = writable<User | null>(null);
export const session = writable<AuthSession | null>(null);
export const loading = writable<boolean>(false);
export const error = writable<string | null>(null);
export const isMockMode = writable<boolean>(false);

// Derived stores
export const isAuthenticated = derived(
  [user, session],
  ([$user, $session]) => !!$user && !!$session
);

export const accessToken = derived(
  session,
  ($session) => $session?.access_token || null
);

// Load persisted auth
function loadAuth(): void {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      const auth: StoredAuth = JSON.parse(stored);
      user.set(auth.user);
      session.set(auth.session);
    }
  } catch (e) {
    console.warn('Failed to load auth state:', e);
  }
}

// Save auth on changes
function saveAuth(): void {
  user.subscribe(u => {
    session.subscribe(s => {
      try {
        if (u && s) {
          const auth: StoredAuth = {
            user: u,
            session: s
          };
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
        } else {
          localStorage.removeItem(AUTH_STORAGE_KEY);
        }
      } catch (e) {
        console.warn('Failed to save auth state:', e);
      }
    })();
  })();
}

// Auto-save on changes
user.subscribe(() => saveAuth());
session.subscribe(() => saveAuth());

// API helpers
async function authFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  let token: string | null = null;
  session.subscribe(s => {
    token = s?.access_token || null;
  })();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  
  return fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });
}

export async function checkAuthStatus(): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/auth/status`);
    const data = await res.json();
    isMockMode.set(data.mock || false);
  } catch {
    // Assume not mock mode if can't reach server
    isMockMode.set(false);
  }
}

export async function signup(email: string, password: string, name?: string): Promise<boolean> {
  loading.set(true);
  error.set(null);
  
  try {
    const res = await authFetch('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name })
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      error.set(data.error || 'Signup failed');
      return false;
    }
    
    user.set(data.user);
    session.set(data.session);
    isMockMode.set(data.mock || false);
    
    return true;
  } catch (e) {
    error.set('Network error - please try again');
    return false;
  } finally {
    loading.set(false);
  }
}

export async function login(email: string, password: string): Promise<boolean> {
  loading.set(true);
  error.set(null);
  
  try {
    const res = await authFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      error.set(data.error || 'Login failed');
      return false;
    }
    
    user.set(data.user);
    session.set(data.session);
    isMockMode.set(data.mock || false);
    
    return true;
  } catch (e) {
    error.set('Network error - please try again');
    return false;
  } finally {
    loading.set(false);
  }
}

export async function logout(): Promise<void> {
  loading.set(true);
  
  try {
    let currentSession: AuthSession | null = null;
    session.subscribe(s => {
      currentSession = s;
    })();

    if (currentSession) {
      await authFetch('/auth/logout', { method: 'POST' });
    }
  } catch {
    // Ignore errors on logout
  } finally {
    user.set(null);
    session.set(null);
    loading.set(false);
  }
}

export async function checkAuth(): Promise<void> {
  let currentSession: AuthSession | null = null;
  session.subscribe(s => {
    currentSession = s;
  })();

  if (!currentSession?.access_token) return;
  
  loading.set(true);
  
  try {
    const res = await authFetch('/auth/me');
    
    if (!res.ok) {
      // Token expired or invalid
      user.set(null);
      session.set(null);
      return;
    }
    
    const data = await res.json();
    user.set(data.user);
    isMockMode.set(data.mock || false);
  } catch {
    // Network error - keep existing auth but mark as needing recheck
  } finally {
    loading.set(false);
  }
}

export function clearError(): void {
  error.set(null);
}

export function resetAuthState(): void {
  user.set(null);
  session.set(null);
  loading.set(false);
  error.set(null);
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

// Initialize on load
loadAuth();
