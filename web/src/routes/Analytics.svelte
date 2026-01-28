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

<div class="analytics p-6">
  <h1 class="text-2xl font-semibold text-gray-800 mb-4">Analytics</h1>
  {#if loading}
    <p class="text-gray-500">Loading…</p>
  {:else if error}
    <p class="text-red-600">{error}</p>
  {:else}
    <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 class="text-lg font-medium text-gray-900 mb-4">Usage this month</h2>
      <p class="text-gray-600">
        <strong>{summary.apiCallsThisMonth ?? 0}</strong> API calls used
        {#if summary.limit != null}
          of <strong>{summary.limit}</strong> (Plan: {summary.tier ?? 'free'})
        {/if}
      </p>
      {#if summary.remaining != null}
        <p class="mt-2 text-sm text-gray-500">{summary.remaining} remaining</p>
      {/if}
    </div>
  {/if}
</div>
