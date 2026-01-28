<script lang="ts">
  import { push } from 'svelte-spa-router'
</script>

<div class="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4">
  <h1 class="text-2xl font-semibold text-gray-800">Page not found</h1>
  <p class="text-gray-600">The page you're looking for doesn't exist.</p>
  <button
    type="button"
    onclick={() => push('/')}
    class="rounded-md bg-primary-600 px-4 py-2 text-white hover:bg-primary-700"
  >
    Go home
  </button>
</div>
