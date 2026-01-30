<script lang="ts">
  import { onMount } from 'svelte'
  import { push } from 'svelte-spa-router'
  import { authStore } from '../stores/authStore'
  import { analytics, trackWorkspaceEvent } from '../lib/analytics'

  let mode = $state<'default' | 'design' | 'code'>('default')

  onMount(() => {
    // Check if there's a mode query parameter
    const params = new URLSearchParams(window.location.search)
    const modeParam = params.get('mode')
    if (modeParam === 'design' || modeParam === 'code') {
      mode = modeParam
      trackWorkspaceEvent(`${modeParam}_mode`, { source: 'url_param' })
    } else {
      trackWorkspaceEvent('open', { source: 'navigation' })
    }

    if (!$authStore.user) {
      push('/login')
    }

    // Track workspace session duration
    const sessionStart = Date.now()
    return () => {
      const duration = Date.now() - sessionStart
      analytics.trackEvent('workspace', 'session_duration', undefined, Math.round(duration / 1000))
    }
  })
</script>

<div 
  class="workspace h-full w-full flex flex-col overflow-hidden relative safe-x safe-bottom" 
  role="region" 
  aria-label="Workspace"
>
  <!-- Full screen chat/workspace container -->
  <div 
    class="flex-1 relative bg-white shadow-sm border border-gray-200 rounded-lg m-2 sm:m-4 overflow-hidden flex flex-col"
    role="main"
    aria-label="Workspace content area"
  >
    <div class="p-4 sm:p-6 flex-1 flex flex-col items-center justify-center text-center overflow-y-auto">
      <h1 class="text-lg sm:text-xl font-semibold text-gray-800 mb-3 sm:mb-4">
        Workspace {mode !== 'default' ? `- ${mode.charAt(0).toUpperCase() + mode.slice(1)} Mode` : ''}
      </h1>
      <p class="text-gray-600 mb-4 sm:mb-6 max-w-lg text-mobile-base px-2">
        Chat interface and diagram/code generation will be wired here to the web API.
      </p>
      <div 
        class="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-6 sm:p-12 w-full max-w-2xl touch-target tap-transparent"
        role="status"
        aria-live="polite"
      >
        <p class="text-gray-500 text-sm sm:text-base">Workspace view – connect to backend chat/codegen routes.</p>
      </div>
    </div>
  </div>
</div>
