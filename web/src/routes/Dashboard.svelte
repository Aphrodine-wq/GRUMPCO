<script lang="ts">
  import { authStore } from '../stores/authStore'
  import { trackWorkspaceEvent } from '../lib/analytics'

  function handleWorkspaceClick(mode: 'default' | 'design' | 'code') {
    trackWorkspaceEvent('open', { mode })
  }
</script>

<div class="dashboard p-4 sm:p-6 md:p-8 animate-fade-in safe-x safe-bottom overflow-y-auto" role="region" aria-label="Dashboard">
  <!-- Header Section with Welcome Message -->
  <div class="mb-6 sm:mb-8">
    <h1 class="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2 sm:mb-3">
      Welcome{$authStore.user?.email ? `, ${$authStore.user.email.split('@')[0]}` : ''}
    </h1>
    <p class="text-mobile-base sm:text-lg text-gray-600 max-w-2xl">
      Create architectures, generate PRDs, and build full-stack apps from natural language with AI assistance.
    </p>
  </div>

  <!-- Quick Actions Grid -->
  <nav class="grid gap-3 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" aria-label="Quick navigation">
    <!-- Workspace Card -->
    <a
      href="/#/workspace"
      onclick={() => handleWorkspaceClick('default')}
      class="card card-interactive p-4 sm:p-6 group touch-target-lg tap-transparent"
      aria-label="Open workspace - Start a new project or continue editing"
    >
      <div class="flex items-start justify-between mb-3 sm:mb-4">
        <div class="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-primary-100 text-primary-600 text-xl sm:text-2xl group-hover:scale-110 transition-transform">
          💼
        </div>
        <svg class="w-5 h-5 text-gray-400 group-hover:text-primary-500 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
        </svg>
      </div>
      <h2 class="text-base sm:text-lg font-semibold text-gray-900 mb-2">Workspace</h2>
      <p class="text-sm text-gray-500">Start a new project or continue editing your existing work.</p>
    </a>

    <!-- Design Mode Card -->
    <a
      href="/#/workspace?mode=design"
      onclick={() => handleWorkspaceClick('design')}
      class="card card-interactive p-4 sm:p-6 group touch-target-lg tap-transparent"
      aria-label="Open design mode - Generate architecture diagrams and PRDs"
    >
      <div class="flex items-start justify-between mb-3 sm:mb-4">
        <div class="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-purple-100 text-purple-600 text-xl sm:text-2xl group-hover:scale-110 transition-transform">
          🎨
        </div>
        <svg class="w-5 h-5 text-gray-400 group-hover:text-purple-500 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
        </svg>
      </div>
      <h2 class="text-base sm:text-lg font-semibold text-gray-900 mb-2">Design Mode</h2>
      <p class="text-sm text-gray-500">Generate architecture diagrams and comprehensive PRDs.</p>
    </a>

    <!-- Code Mode Card -->
    <a
      href="/#/workspace?mode=code"
      onclick={() => handleWorkspaceClick('code')}
      class="card card-interactive p-4 sm:p-6 group touch-target-lg tap-transparent sm:col-span-2 lg:col-span-1"
      aria-label="Open code mode - AI-assisted coding with tool execution"
    >
      <div class="flex items-start justify-between mb-3 sm:mb-4">
        <div class="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600 text-xl sm:text-2xl group-hover:scale-110 transition-transform">
          💻
        </div>
        <svg class="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
        </svg>
      </div>
      <h2 class="text-base sm:text-lg font-semibold text-gray-900 mb-2">Code Mode</h2>
      <p class="text-sm text-gray-500">AI-assisted coding with intelligent tool execution.</p>
    </a>
  </nav>

  <!-- Recent Activity Section (Placeholder for future feature) -->
  <div class="mt-8 sm:mt-10">
    <h2 class="text-lg sm:text-xl font-semibold text-gray-800 mb-3 sm:mb-4">Quick Tips</h2>
    <div class="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      <div class="card p-3 sm:p-4 bg-gradient-to-br from-primary-50 to-white border-primary-100">
        <div class="flex items-center gap-2 sm:gap-3 mb-2">
          <span class="text-lg sm:text-xl">💡</span>
          <span class="font-medium text-gray-900 text-mobile-base">Start with Design</span>
        </div>
        <p class="text-sm text-gray-600">Use Design Mode to create architecture diagrams before coding.</p>
      </div>
      <div class="card p-3 sm:p-4 bg-gradient-to-br from-purple-50 to-white border-purple-100">
        <div class="flex items-center gap-2 sm:gap-3 mb-2">
          <span class="text-lg sm:text-xl">🚀</span>
          <span class="font-medium text-gray-900 text-mobile-base">Iterate Quickly</span>
        </div>
        <p class="text-sm text-gray-600">Switch between modes seamlessly to refine your project.</p>
      </div>
      <div class="card p-3 sm:p-4 bg-gradient-to-br from-blue-50 to-white border-blue-100 sm:col-span-2 lg:col-span-1">
        <div class="flex items-center gap-2 sm:gap-3 mb-2">
          <span class="text-lg sm:text-xl">📝</span>
          <span class="font-medium text-gray-900 text-mobile-base">Document Everything</span>
        </div>
        <p class="text-sm text-gray-600">Generate PRDs automatically to keep your project organized.</p>
      </div>
    </div>
  </div>
</div>
