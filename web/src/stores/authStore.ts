import { writable, derived } from 'svelte/store'
import type { User } from '@supabase/supabase-js'

export interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
}

function createAuthStore() {
  const { subscribe, set, update } = writable<AuthState>({
    user: null,
    loading: true,
    error: null,
  })

  return {
    subscribe,
    setUser: (user: User | null) =>
      update((s) => ({ ...s, user, loading: false, error: null })),
    setLoading: (loading: boolean) => update((s) => ({ ...s, loading })),
    setError: (error: string | null) => update((s) => ({ ...s, error })),
    reset: () =>
      set({ user: null, loading: false, error: null }),
  }
}

export const authStore = createAuthStore()
export const isAuthenticated = derived(authStore, ($a) => !!$a.user)
