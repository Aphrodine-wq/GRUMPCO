<script lang="ts">
  import { authStore } from '../stores/authStore'
</script>

<div class="dashboard p-6">
  <h1 class="text-2xl font-semibold text-gray-800 mb-4">
    Welcome{$authStore.user?.email ? `, ${$authStore.user.email}` : ''}
  </h1>
  <p class="text-gray-600 mb-6">
    Create architectures, generate PRDs, and build full-stack apps from natural language.
  </p>
  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    <a
      href="/#/workspace"
      class="block rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:border-primary-500 hover:shadow-md"
    >
      <h2 class="text-lg font-medium text-gray-900">Workspace</h2>
      <p class="mt-2 text-sm text-gray-500">Start a new project or continue editing.</p>
    </a>
    <a
      href="/#/workspace?mode=design"
      class="block rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:border-primary-500 hover:shadow-md"
    >
      <h2 class="text-lg font-medium text-gray-900">Design Mode</h2>
      <p class="mt-2 text-sm text-gray-500">Generate architecture diagrams and PRDs.</p>
    </a>
    <a
      href="/#/workspace?mode=code"
      class="block rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:border-primary-500 hover:shadow-md"
    >
      <h2 class="text-lg font-medium text-gray-900">Code Mode</h2>
      <p class="mt-2 text-sm text-gray-500">AI-assisted coding with tool execution.</p>
    </a>
  </div>
</div>
