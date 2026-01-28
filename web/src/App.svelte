<script lang="ts">
  import Router, { push } from 'svelte-spa-router'
  import { authStore } from './stores/authStore'
  import Dashboard from './routes/Dashboard.svelte'
  import Workspace from './routes/Workspace.svelte'
  import Login from './routes/Login.svelte'
  import Register from './routes/Register.svelte'
  import Settings from './routes/Settings.svelte'
  import Billing from './routes/Billing.svelte'
  import Analytics from './routes/Analytics.svelte'
  import Terms from './routes/Terms.svelte'
  import Privacy from './routes/Privacy.svelte'
  import AcceptableUse from './routes/AcceptableUse.svelte'
  import NotFound from './routes/NotFound.svelte'

  const routes = {
    '/': Dashboard,
    '/login': Login,
    '/register': Register,
    '/terms': Terms,
    '/privacy': Privacy,
    '/acceptable-use': AcceptableUse,
    '/workspace': Workspace,
    '/settings': Settings,
    '/billing': Billing,
    '/analytics': Analytics,
    '*': NotFound,
  }

  $: showNav = $authStore.user != null
</script>

<div class="app flex min-h-screen flex-col bg-gray-50">
  {#if showNav}
    <header class="sticky top-0 z-10 border-b border-gray-200 bg-white shadow-sm">
      <div class="flex h-14 items-center justify-between px-4 sm:px-6">
        <a href="/#/" class="text-xl font-semibold text-gray-900">G-Rump</a>
        <nav class="flex items-center gap-2 sm:gap-4">
          <a href="/#/" class="hidden text-sm text-gray-600 hover:text-gray-900 sm:inline">Dashboard</a>
          <a href="/#/workspace" class="text-sm text-gray-600 hover:text-gray-900">Workspace</a>
          <a href="/#/settings" class="hidden text-sm text-gray-600 hover:text-gray-900 sm:inline">Settings</a>
          <a href="/#/billing" class="hidden text-sm text-gray-600 hover:text-gray-900 sm:inline">Billing</a>
          <a href="/#/analytics" class="hidden text-sm text-gray-600 hover:text-gray-900 sm:inline">Analytics</a>
          <button
            type="button"
            onclick={() => {
              authStore.reset()
              push('/login')
            }}
            class="rounded-md bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200"
          >
            Sign out
          </button>
        </nav>
      </div>
    </header>
  {/if}
  <main class="flex-1">
    <Router {routes} />
  </main>
</div>
