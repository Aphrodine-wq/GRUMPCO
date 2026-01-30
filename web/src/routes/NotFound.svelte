<script lang="ts">
  import { push } from 'svelte-spa-router'
</script>

<div 
  class="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4" 
  role="region" 
  aria-label="Page not found"
>
  <h1 class="text-2xl font-semibold text-gray-800" id="not-found-heading">Page not found</h1>
  <p class="text-gray-600">The page you're looking for doesn't exist.</p>
  <button
    type="button"
    onclick={() => push('/')}
    class="rounded-md bg-primary-600 px-4 py-2 text-white hover:bg-primary-700 focus:bg-primary-700"
    aria-label="Return to dashboard home page"
  >
    Go home
  </button>
</div>
