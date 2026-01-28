<script lang="ts">
  import { push } from 'svelte-spa-router'
  import { authStore } from '../stores/authStore'

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
      return
    }
    if (!agreeToTermsAndPrivacy) {
      error = 'You must agree to the Terms of Service and Privacy Policy to create an account'
      return
    }
    loading = true
    error = ''
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
      push('/')
    } catch (err: unknown) {
      error = err instanceof Error ? err.message : 'Registration failed'
    } finally {
      loading = false
    }
  }
</script>

<div class="flex min-h-[70vh] items-center justify-center px-4">
  <div class="w-full max-w-md">
    <h1 class="mb-6 text-center text-2xl font-semibold text-gray-800">Create an account</h1>
    <form onsubmit={handleRegister} class="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      {#if error}
        <p class="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      {/if}
      <div>
        <label for="email" class="mb-1 block text-sm font-medium text-gray-700">Email</label>
        <input
          id="email"
          type="email"
          bind:value={email}
          class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          required
        />
      </div>
      <div>
        <label for="password" class="mb-1 block text-sm font-medium text-gray-700">Password</label>
        <input
          id="password"
          type="password"
          bind:value={password}
          class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          required
          minlength="8"
        />
      </div>
      <div class="space-y-2">
        <label class="flex items-start gap-2">
          <input type="checkbox" bind:checked={agreeToTermsAndPrivacy} class="mt-1 rounded border-gray-300" />
          <span class="text-sm text-gray-700">
            I agree to the <a href="/#/terms" class="text-primary-600 hover:underline" target="_blank" rel="noopener">Terms of Service</a> and <a href="/#/privacy" class="text-primary-600 hover:underline" target="_blank" rel="noopener">Privacy Policy</a>.
          </span>
        </label>
        <label class="flex items-start gap-2">
          <input type="checkbox" bind:checked={agreeToAUP} class="mt-1 rounded border-gray-300" />
          <span class="text-sm text-gray-700">
            I agree to the <a href="/#/acceptable-use" class="text-primary-600 hover:underline" target="_blank" rel="noopener">Acceptable Use Policy</a>.
          </span>
        </label>
      </div>
      <button
        type="submit"
        disabled={loading || !agreeToTermsAndPrivacy}
        class="w-full rounded-md bg-primary-600 py-2 text-white hover:bg-primary-700 disabled:opacity-50"
      >
        {loading ? 'Creating account…' : 'Create account'}
      </button>
    </form>
    <p class="mt-4 text-center text-sm text-gray-500">
      <a href="/#/login" class="text-primary-600 hover:underline">Already have an account? Sign in</a>
    </p>
  </div>
</div>
