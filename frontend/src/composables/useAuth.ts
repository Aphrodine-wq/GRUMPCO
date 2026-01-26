import { ref, computed, watch, type Ref, type ComputedRef } from 'vue';

const AUTH_STORAGE_KEY = 'mermaid-auth';
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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

// Singleton state
const user: Ref<User | null> = ref(null);
const session: Ref<AuthSession | null> = ref(null);
const loading: Ref<boolean> = ref(false);
const error: Ref<string | null> = ref(null);
const isMockMode: Ref<boolean> = ref(false);

// Load persisted auth
function loadAuth(): void {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      const auth: StoredAuth = JSON.parse(stored);
      user.value = auth.user;
      session.value = auth.session;
    }
  } catch (e) {
    console.warn('Failed to load auth state:', e);
  }
}

// Save auth on changes
function saveAuth(): void {
  try {
    if (user.value && session.value) {
      const auth: StoredAuth = {
        user: user.value,
        session: session.value
      };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  } catch (e) {
    console.warn('Failed to save auth state:', e);
  }
}

// API helpers
async function authFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (session.value?.access_token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${session.value.access_token}`;
  }
  
  return fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });
}

export interface UseAuthReturn {
  // State
  user: Ref<User | null>;
  session: Ref<AuthSession | null>;
  loading: Ref<boolean>;
  error: Ref<string | null>;
  isMockMode: Ref<boolean>;
  
  // Computed
  isAuthenticated: ComputedRef<boolean>;
  accessToken: ComputedRef<string | null>;
  
  // Actions
  signup: (email: string, password: string, name?: string) => Promise<boolean>;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  checkAuthStatus: () => Promise<void>;
  clearError: () => void;
}

export function useAuth(): UseAuthReturn {
  // Initialize on first use
  loadAuth();
  
  // Auto-save on changes
  watch([user, session], saveAuth, { deep: true });
  
  const isAuthenticated = computed(() => !!user.value && !!session.value);
  const accessToken = computed(() => session.value?.access_token || null);
  
  async function checkAuthStatus(): Promise<void> {
    try {
      const res = await fetch(`${API_BASE}/auth/status`);
      const data = await res.json();
      isMockMode.value = data.mock || false;
    } catch {
      // Assume not mock mode if can't reach server
      isMockMode.value = false;
    }
  }
  
  async function signup(email: string, password: string, name?: string): Promise<boolean> {
    loading.value = true;
    error.value = null;
    
    try {
      const res = await authFetch('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password, name })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        error.value = data.error || 'Signup failed';
        return false;
      }
      
      user.value = data.user;
      session.value = data.session;
      isMockMode.value = data.mock || false;
      
      return true;
    } catch (e) {
      error.value = 'Network error - please try again';
      return false;
    } finally {
      loading.value = false;
    }
  }
  
  async function login(email: string, password: string): Promise<boolean> {
    loading.value = true;
    error.value = null;
    
    try {
      const res = await authFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        error.value = data.error || 'Login failed';
        return false;
      }
      
      user.value = data.user;
      session.value = data.session;
      isMockMode.value = data.mock || false;
      
      return true;
    } catch (e) {
      error.value = 'Network error - please try again';
      return false;
    } finally {
      loading.value = false;
    }
  }
  
  async function logout(): Promise<void> {
    loading.value = true;
    
    try {
      if (session.value) {
        await authFetch('/auth/logout', { method: 'POST' });
      }
    } catch {
      // Ignore errors on logout
    } finally {
      user.value = null;
      session.value = null;
      loading.value = false;
    }
  }
  
  async function checkAuth(): Promise<void> {
    if (!session.value?.access_token) return;
    
    loading.value = true;
    
    try {
      const res = await authFetch('/auth/me');
      
      if (!res.ok) {
        // Token expired or invalid
        user.value = null;
        session.value = null;
        return;
      }
      
      const data = await res.json();
      user.value = data.user;
      isMockMode.value = data.mock || false;
    } catch {
      // Network error - keep existing auth but mark as needing recheck
    } finally {
      loading.value = false;
    }
  }
  
  function clearError(): void {
    error.value = null;
  }
  
  return {
    // State
    user,
    session,
    loading,
    error,
    isMockMode,
    
    // Computed
    isAuthenticated,
    accessToken,
    
    // Actions
    signup,
    login,
    logout,
    checkAuth,
    checkAuthStatus,
    clearError
  };
}

// For testing - reset singleton state
export function resetAuthState(): void {
  user.value = null;
  session.value = null;
  loading.value = false;
  error.value = null;
  localStorage.removeItem(AUTH_STORAGE_KEY);
}
