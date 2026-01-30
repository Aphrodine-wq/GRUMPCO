<script lang="ts">
  import { onMount } from 'svelte'
  import { push } from 'svelte-spa-router'
  import { authStore } from '../stores/authStore'
  import { apiBaseUrl } from '../lib/api'

  let loading = $state(true)
  let error = $state('')
  let summary = $state<{ apiCallsThisMonth?: number; limit?: number; remaining?: number; tier?: string }>({})

  onMount(async () => {
    if (!$authStore.user) {
      push('/login')
      return
    }
    try {
      const token = (typeof window !== 'undefined' && (window as any).__supabaseAuth)?.session?.access_token
      const url = apiBaseUrl ? `${apiBaseUrl}/api/analytics/summary` : '/api/analytics/summary'
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error(await res.text())
      summary = await res.json()
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Failed to load'
    } finally {
      loading = false
    }
  })
</script>

<div class="analytics responsive-p safe-x safe-bottom overflow-y-auto" role="region" aria-label="Usage analytics">
  <div class="max-w-3xl mx-auto">
    <h1 class="text-xl sm:text-2xl font-semibold text-gray-800 mb-4">Analytics</h1>
    
    {#if loading}
      <div role="status" aria-live="polite" class="flex items-center gap-2">
        <div class="animate-spin h-5 w-5 border-2 border-primary-600 border-t-transparent rounded-full"></div>
        <p class="text-gray-500">Loading analytics data...</p>
      </div>
    {:else if error}
      <div 
        class="rounded bg-red-50 px-3 py-2 text-sm text-red-700 mb-4" 
        role="alert" 
        aria-live="assertive"
      >
        <span class="sr-only">Error:</span>
        {error}
      </div>
    {:else}
      <section 
        class="rounded-lg border border-gray-200 bg-white p-4 sm:p-6 shadow-sm" 
        aria-labelledby="usage-heading"
      >
        <h2 class="text-base sm:text-lg font-medium text-gray-900 mb-3 sm:mb-4" id="usage-heading">Usage this month</h2>
        <div class="space-y-3">
          <p class="text-gray-600 text-mobile-base">
            <strong class="text-lg sm:text-xl">{summary.apiCallsThisMonth ?? 0}</strong> 
            <span class="text-gray-500">API calls used</span>
            {#if summary.limit != null}
              <span class="text-gray-500">of</span> 
              <strong class="text-lg sm:text-xl">{summary.limit}</strong>
            {/if}
          </p>
          {#if summary.limit != null}
            <div class="w-full bg-gray-200 rounded-full h-2.5 sm:h-3">
              <div 
                class="bg-primary-600 h-2.5 sm:h-3 rounded-full transition-all duration-300" 
                style="width: {Math.min(100, ((summary.apiCallsThisMonth ?? 0) / (summary.limit ?? 1)) * 100)}%"
              ></div>
            </div>
            <p class="text-xs sm:text-sm text-gray-500">
              Plan: <span class="capitalize font-medium">{summary.tier ?? 'free'}</span>
            </p>
          {/if}
          {#if summary.remaining != null}
            <p class="text-sm sm:text-base text-gray-600">
              <strong>{summary.remaining}</strong> calls remaining
            </p>
          {/if}
        </div>
      </section>
    {/if}
  </div>
</div>
