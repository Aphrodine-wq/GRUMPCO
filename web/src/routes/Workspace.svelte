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

<div class="workspace h-full w-full flex flex-col overflow-hidden relative">
  <!-- Full screen chat/workspace container -->
  <div class="flex-1 relative bg-white shadow-sm border border-gray-200 rounded-lg m-4 overflow-hidden flex flex-col">
    <div class="p-6 flex-1 flex flex-col items-center justify-center text-center">
      <h1 class="text-xl font-semibold text-gray-800 mb-4">Workspace</h1>
      <p class="text-gray-600 mb-6 max-w-lg">
        Chat interface and diagram/code generation will be wired here to the web API.
      </p>
      <div class="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-12 w-full max-w-2xl">
        <p class="text-gray-500">Workspace view – connect to backend chat/codegen routes.</p>
      </div>
    </div>
  </div>
</div>
