<script lang="ts">
  import { push } from 'svelte-spa-router'
  import { authStore } from '../stores/authStore'
  import { analytics, trackAuthEvent } from '../lib/analytics'

  let email = $state('')
  let password = $state('')
  let loading = $state(false)
  let error = $state('')

  async function handleLogin(e: Event) {
    e.preventDefault()
    if (!email || !password) {
      error = 'Email and password are required'
      trackAuthEvent('login_failed', { reason: 'missing_fields' })
      return
    }
    loading = true
    error = ''
    
    // Track login attempt
    analytics.trackFormSubmit('login', false, { email_domain: email.split('@')[1] })
    
    try {
      const base = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) ? (import.meta as any).env.VITE_API_URL : ''
      const url = base ? `${String(base).replace(/\/$/, '')}/api/auth/login` : '/api/auth/login'
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? data.error ?? 'Login failed')
      authStore.setUser((data.user ?? { email, id: data.user?.id ?? data.userId }) as any)
      
      // Track successful login
      analytics.setUserId(data.user?.id || data.userId)
      trackAuthEvent('login', { method: 'email' })
      analytics.trackFormSubmit('login', true)
      
      push('/')
    } catch (err: unknown) {
      error = err instanceof Error ? err.message : 'Login failed'
      // Track failed login
      trackAuthEvent('login_failed', { reason: error })
      analytics.trackFormSubmit('login', false, { error_type: error })
    } finally {
      loading = false
    }
  }
</script>

<div class="flex min-h-[80vh] items-center justify-center px-4 animate-fade-in" role="region" aria-label="Sign in form">
  <div class="w-full max-w-md">
    <!-- Logo and Title -->
    <div class="text-center mb-8">
      <div class="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-white text-3xl shadow-glow mb-4">
        G
      </div>
      <h1 class="text-3xl font-bold text-gray-900 mb-2" id="login-heading">Welcome back</h1>
      <p class="text-gray-600">Sign in to continue building with G-Rump</p>
    </div>

    <!-- Login Form Card -->
    <div class="card p-8 shadow-soft">
      <form onsubmit={handleLogin} class="space-y-5" aria-labelledby="login-heading">
        <!-- Error Alert -->
        {#if error}
          <div 
            class="alert alert-error"
            role="alert" 
            aria-live="assertive"
            id="login-error"
          >
            <svg class="alert-icon flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span>{error}</span>
          </div>
        {/if}

        <!-- Email Field -->
        <div>
          <label for="email" class="label">
            Email <span class="text-error-500" aria-label="required">*</span>
          </label>
          <div class="relative">
            <input
              id="email"
              type="email"
              inputmode="email"
              bind:value={email}
              class="input pl-10 {error ? 'input-error' : ''}"
              placeholder="you@example.com"
              required
              autocomplete="email"
              autocorrect="off"
              autocapitalize="off"
              aria-required="true"
              aria-invalid={error ? 'true' : 'false'}
              aria-describedby={error ? 'login-error' : undefined}
            />
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"/>
            </svg>
          </div>
        </div>

        <!-- Password Field -->
        <div>
          <div class="flex items-center justify-between mb-1">
            <label for="password" class="label mb-0">
              Password <span class="text-error-500" aria-label="required">*</span>
            </label>
            <a href="/#/forgot-password" class="text-sm text-primary-600 hover:text-primary-700 hover:underline">
              Forgot password?
            </a>
          </div>
          <div class="relative">
            <input
              id="password"
              type="password"
              bind:value={password}
              class="input pl-10 {error ? 'input-error' : ''}"
              placeholder="Enter your password"
              required
              autocomplete="current-password"
              aria-required="true"
              aria-invalid={error ? 'true' : 'false'}
              aria-describedby={error ? 'login-error' : undefined}
            />
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
            </svg>
          </div>
        </div>

        <!-- Submit Button -->
        <button
          type="submit"
          disabled={loading}
          class="btn btn-primary w-full text-base py-3"
          aria-label={loading ? 'Signing in, please wait' : 'Sign in to your account'}
          aria-busy={loading}
        >
          {#if loading}
            <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Signing in…</span>
          {:else}
            <span>Sign in</span>
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
            </svg>
          {/if}
        </button>
      </form>
    </div>

    <!-- Create Account Link -->
    <div class="mt-6 text-center">
      <p class="text-gray-600">
        Don't have an account? 
        <a href="/#/register" class="font-medium text-primary-600 hover:text-primary-700 hover:underline transition-colors">
          Create one
        </a>
      </p>
    </div>
  </div>
</div>
