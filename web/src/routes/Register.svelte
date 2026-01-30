<script lang="ts">
  import { push } from 'svelte-spa-router'
  import { authStore } from '../stores/authStore'
  import { analytics, trackAuthEvent } from '../lib/analytics'

  let email = $state('')
  let password = $state('')
  let agreeToTermsAndPrivacy = $state(false)
  let agreeToAUP = $state(false)
  let loading = $state(false)
  let error = $state('')

  async function handleRegister(e: Event) {
    e.preventDefault()
    if (!email || !password) {
      error = 'Email and password are required'
      trackAuthEvent('register_failed', { reason: 'missing_fields' })
      return
    }
    if (!agreeToTermsAndPrivacy) {
      error = 'You must agree to the Terms of Service and Privacy Policy to create an account'
      trackAuthEvent('register_failed', { reason: 'missing_consent' })
      return
    }
    loading = true
    error = ''
    
    // Track registration attempt
    analytics.trackFormSubmit('register', false, { email_domain: email.split('@')[1] })
    
    try {
      const base = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) ? (import.meta as any).env.VITE_API_URL : ''
      const url = base ? `${String(base).replace(/\/$/, '')}/api/auth/register` : '/api/auth/register'
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? data.error ?? 'Registration failed')
      authStore.setUser((data.user ?? { email, id: data.user?.id ?? data.userId }) as any)
      
      // Track successful registration
      analytics.setUserId(data.user?.id || data.userId)
      trackAuthEvent('register', { method: 'email', agreed_aup: agreeToAUP })
      analytics.trackFormSubmit('register', true)
      analytics.trackConversion('user_registration')
      
      push('/')
    } catch (err: unknown) {
      error = err instanceof Error ? err.message : 'Registration failed'
      // Track failed registration
      trackAuthEvent('register_failed', { reason: error })
      analytics.trackFormSubmit('register', false, { error_type: error })
    } finally {
      loading = false
    }
  }
</script>

<div class="flex min-h-[70vh] items-center justify-center px-4" role="region" aria-label="Create account form">
  <div class="w-full max-w-md">
    <h1 class="mb-6 text-center text-2xl font-semibold text-gray-800" id="register-heading">Create an account</h1>
    <form onsubmit={handleRegister} class="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm" aria-labelledby="register-heading">
      <!-- Error message with aria-live for screen reader announcements - WCAG 4.1.3 -->
      {#if error}
        <div 
          class="rounded bg-red-50 px-3 py-2 text-sm text-red-700" 
          role="alert" 
          aria-live="assertive"
          id="register-error"
        >
          <span class="sr-only">Error:</span>
          {error}
        </div>
      {/if}
      <div>
        <label for="email" class="mb-1 block text-sm font-medium text-gray-700">
          Email <span aria-label="required">*</span>
        </label>
        <input
          id="email"
          type="email"
          inputmode="email"
          bind:value={email}
          class="w-full rounded-md border border-gray-300 px-3 py-2 sm:py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 form-input touch-target-lg"
          required
          autocomplete="email"
          autocorrect="off"
          autocapitalize="off"
          aria-required="true"
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? 'register-error' : undefined}
        />
      </div>
      <div>
        <label for="password" class="mb-1 block text-sm font-medium text-gray-700">
          Password <span aria-label="required">*</span>
          <span class="text-xs text-gray-500 font-normal ml-1">(minimum 8 characters)</span>
        </label>
        <input
          id="password"
          type="password"
          bind:value={password}
          class="w-full rounded-md border border-gray-300 px-3 py-2 sm:py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 form-input touch-target-lg"
          required
          minlength="8"
          autocomplete="new-password"
          aria-required="true"
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? 'register-error' : 'password-hint'}
        />
        <p id="password-hint" class="mt-1 text-xs text-gray-500">Password must be at least 8 characters long.</p>
      </div>
      <fieldset class="space-y-3 border-0 p-0 m-0">
        <legend class="sr-only">Terms and policies agreement</legend>
        <label class="flex items-start gap-3 cursor-pointer touch-target tap-transparent">
          <input 
            type="checkbox" 
            bind:checked={agreeToTermsAndPrivacy} 
            class="form-checkbox touch-target mt-0.5"
            required
            aria-required="true"
          />
          <span class="text-sm text-gray-700 flex-1">
            I agree to the 
            <a href="/#/terms" class="text-primary-600 hover:underline focus:underline" target="_blank" rel="noopener">Terms of Service</a> 
            and 
            <a href="/#/privacy" class="text-primary-600 hover:underline focus:underline" target="_blank" rel="noopener">Privacy Policy</a>.
            <span aria-label="required">*</span>
          </span>
        </label>
        <label class="flex items-start gap-3 cursor-pointer touch-target tap-transparent">
          <input 
            type="checkbox" 
            bind:checked={agreeToAUP} 
            class="form-checkbox touch-target mt-0.5"
          />
          <span class="text-sm text-gray-700 flex-1">
            I agree to the 
            <a href="/#/acceptable-use" class="text-primary-600 hover:underline focus:underline" target="_blank" rel="noopener">Acceptable Use Policy</a>.
          </span>
        </label>
      </fieldset>
      <button
        type="submit"
        disabled={loading || !agreeToTermsAndPrivacy}
        class="w-full rounded-md bg-primary-600 py-3 sm:py-2 text-white hover:bg-primary-700 disabled:opacity-50 touch-target-lg font-medium"
        aria-label={loading ? 'Creating account, please wait' : 'Create account'}
        aria-busy={loading}
      >
        {loading ? 'Creating account…' : 'Create account'}
      </button>
    </form>
    <p class="mt-4 text-center text-sm text-gray-500">
      <a href="/#/login" class="text-primary-600 hover:underline focus:underline">Already have an account? Sign in</a>
    </p>
  </div>
</div>
