<script lang="ts">
  import { push } from 'svelte-spa-router'
  import { authStore } from '../stores/authStore'

  let email = $state('')
  let password = $state('')
  let loading = $state(false)
  let error = $state('')

  async function handleLogin(e: Event) {
    e.preventDefault()
    if (!email || !password) {
      error = 'Email and password are required'
      return
    }
    loading = true
    error = ''
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
      push('/')
    } catch (err: unknown) {
      error = err instanceof Error ? err.message : 'Login failed'
    } finally {
      loading = false
    }
  }
</script>

<div class="flex min-h-[70vh] items-center justify-center px-4">
  <div class="w-full max-w-md">
    <h1 class="mb-6 text-center text-2xl font-semibold text-gray-800">Sign in to G-Rump</h1>
    <form onsubmit={handleLogin} class="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
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
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        class="w-full rounded-md bg-primary-600 py-2 text-white hover:bg-primary-700 disabled:opacity-50"
      >
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
    <p class="mt-4 text-center text-sm text-gray-500">
      <a href="/#/register" class="text-primary-600 hover:underline">Create an account</a>
    </p>
  </div>
</div>
