<script lang="ts">
  import { onMount } from 'svelte'
  import { push } from 'svelte-spa-router'
  import { authStore } from '../stores/authStore'

  onMount(() => {
    if (!$authStore.user) {
      push('/login')
    }
  })
</script>

<div class="workspace min-h-[70vh] p-4 sm:p-6">
  <div class="mx-auto max-w-4xl">
    <h1 class="text-xl font-semibold text-gray-800 mb-4">Workspace</h1>
    <p class="text-gray-600 mb-6">
      Chat interface and diagram/code generation will be wired here to the web API.
    </p>
    <div class="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-12 text-center">
      <p class="text-gray-500">Workspace view – connect to backend chat/codegen routes.</p>
    </div>
  </div>
</div>
