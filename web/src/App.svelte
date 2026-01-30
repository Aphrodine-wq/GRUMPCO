<script lang="ts">
  import Router, { push } from 'svelte-spa-router'
  import { authStore } from './stores/authStore'
  import { tick } from 'svelte'
  import { analytics, trackNavigation, trackAuthEvent } from './lib/analytics'
  import CookieConsent from './components/CookieConsent.svelte'
  
  // Eagerly load critical routes (Dashboard and auth pages)
  import Dashboard from './routes/Dashboard.svelte'
  import Login from './routes/Login.svelte'
  import Register from './routes/Register.svelte'
  import NotFound from './routes/NotFound.svelte'
  
  // Lazy load non-critical routes for better performance
  const Workspace = () => import('./routes/Workspace.svelte')
  const Settings = () => import('./routes/Settings.svelte')
  const Billing = () => import('./routes/Billing.svelte')
  const Analytics = () => import('./routes/Analytics.svelte')
  const Terms = () => import('./routes/Terms.svelte')
  const Privacy = () => import('./routes/Privacy.svelte')
  const AcceptableUse = () => import('./routes/AcceptableUse.svelte')
  const Pricing = () => import('./routes/Pricing.svelte')

  const routes = {
    '/': Dashboard,
    '/login': Login,
    '/register': Register,
    '/terms': Terms,
    '/privacy': Privacy,
    '/acceptable-use': AcceptableUse,
    '/pricing': Pricing,
    '/workspace': Workspace,
    '/settings': Settings,
    '/billing': Billing,
    '/analytics': Analytics,
    '*': NotFound,
  }

  $: showNav = $authStore.user != null

  // Page titles for each route - WCAG 2.4.2 Page Titled
  const routeTitles: Record<string, string> = {
    '/': 'Dashboard - G-Rump',
    '/login': 'Sign In - G-Rump',
    '/register': 'Create Account - G-Rump',
    '/terms': 'Terms of Service - G-Rump',
    '/privacy': 'Privacy Policy - G-Rump',
    '/acceptable-use': 'Acceptable Use Policy - G-Rump',
    '/pricing': 'Pricing - G-Rump',
    '/workspace': 'Workspace - G-Rump',
    '/settings': 'Settings - G-Rump',
    '/billing': 'Billing - G-Rump',
    '/analytics': 'Analytics - G-Rump',
  }

  let previousRoute = $state('')
  
  function handleRouteChange(event: CustomEvent<{ route: string }>) {
    const route = event.detail.route
    
    // Update page title for accessibility - WCAG 2.4.2
    const title = routeTitles[route] || 'G-Rump'
    document.title = title
    
    // Track page view for analytics
    analytics.trackPageView(route, title)
    
    // Track navigation between routes
    if (previousRoute && previousRoute !== route) {
      trackNavigation(previousRoute, route)
    }
    previousRoute = route
    
    // Focus management - move focus to main content for screen readers
    tick().then(() => {
      const mainContent = document.querySelector('main')
      if (mainContent && mainContent.getAttribute('tabindex') === '-1') {
        mainContent.focus()
      }
    })
  }

  // Mobile navigation state
  let mobileMenuOpen = $state(false)
  
  function toggleMobileMenu() {
    mobileMenuOpen = !mobileMenuOpen
    // Prevent body scroll when menu is open
    if (mobileMenuOpen) {
      document.body.classList.add('nav-open')
    } else {
      document.body.classList.remove('nav-open')
    }
  }
  
  function closeMobileMenu() {
    mobileMenuOpen = false
    document.body.classList.remove('nav-open')
  }
  
  function handleNavClick(path: string) {
    closeMobileMenu()
    push(path)
  }
  
  // Close menu on escape key
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && mobileMenuOpen) {
      closeMobileMenu()
    }
  }
  
  // Handle sign out with mobile menu close
  function handleSignOut() {
    trackAuthEvent('logout')
    analytics.clearUserId()
    authStore.reset()
    closeMobileMenu()
    push('/login')
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="app flex min-h-screen flex-col bg-gray-50 h-screen w-screen overflow-hidden">
  <!-- Skip navigation link - WCAG 2.4.1 Bypass Blocks -->
  <a href="#main-content" class="skip-link">Skip to main content</a>
  
  {#if showNav}
    <header class="sticky top-0 z-10 border-b border-gray-200 bg-white shadow-sm flex-none safe-top" role="banner" aria-label="G-Rump main navigation">
      <div class="flex h-14 items-center justify-between px-4 sm:px-6 safe-x">
        <a href="/#/" class="text-xl font-semibold text-gray-900 touch-target-lg flex items-center" aria-label="G-Rump home">G-Rump</a>
        
        <!-- Desktop Navigation -->
        <nav class="hidden sm:flex items-center gap-4" aria-label="Primary navigation">
          <a href="/#/" class="text-sm text-gray-600 hover:text-gray-900 focus:text-gray-900 px-3 py-2 rounded-md hover:bg-gray-50 touch-target flex items-center">Workspace</a>
          <a href="/#/settings" class="text-sm text-gray-600 hover:text-gray-900 focus:text-gray-900 px-3 py-2 rounded-md hover:bg-gray-50 touch-target flex items-center">Settings</a>
          <a href="/#/billing" class="text-sm text-gray-600 hover:text-gray-900 focus:text-gray-900 px-3 py-2 rounded-md hover:bg-gray-50 touch-target flex items-center">Billing</a>
          <a href="/#/analytics" class="text-sm text-gray-600 hover:text-gray-900 focus:text-gray-900 px-3 py-2 rounded-md hover:bg-gray-50 touch-target flex items-center">Analytics</a>
          <button
            type="button"
            onclick={handleSignOut}
            class="rounded-md bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 focus:bg-gray-200 touch-target min-h-[40px]"
            aria-label="Sign out of your account"
          >
            Sign out
          </button>
        </nav>
        
        <!-- Mobile Hamburger Button -->
        <button
          type="button"
          onclick={toggleMobileMenu}
          class="sm:hidden hamburger-btn text-gray-700 touch-target-lg"
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-nav"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </header>
    
    <!-- Mobile Navigation Overlay -->
    <div
      class="mobile-nav-overlay sm:hidden"
      class:active={mobileMenuOpen}
      onclick={closeMobileMenu}
      role="button"
      tabindex="-1"
      aria-label="Close navigation menu"
    ></div>
    
    <!-- Mobile Navigation Drawer -->
    <nav
      id="mobile-nav"
      class="mobile-nav-drawer sm:hidden"
      class:active={mobileMenuOpen}
      aria-label="Mobile navigation"
    >
      <div class="flex flex-col h-full">
        <!-- Drawer Header -->
        <div class="flex items-center justify-between p-4 border-b border-gray-200 safe-x">
          <span class="text-lg font-semibold text-gray-900">Menu</span>
          <button
            type="button"
            onclick={closeMobileMenu}
            class="touch-target-lg flex items-center justify-center text-gray-500 hover:text-gray-700"
            aria-label="Close menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <!-- Drawer Navigation Links -->
        <div class="flex-1 py-4 safe-x">
          <div class="space-y-1">
            <a
              href="/#/"
              onclick={(e) => { e.preventDefault(); handleNavClick('/'); }}
              class="flex items-center px-4 py-3 text-base font-medium text-gray-700 rounded-lg hover:bg-gray-50 hover:text-gray-900 touch-target-lg"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Workspace
            </a>
            <a
              href="/#/settings"
              onclick={(e) => { e.preventDefault(); handleNavClick('/settings'); }}
              class="flex items-center px-4 py-3 text-base font-medium text-gray-700 rounded-lg hover:bg-gray-50 hover:text-gray-900 touch-target-lg"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </a>
            <a
              href="/#/billing"
              onclick={(e) => { e.preventDefault(); handleNavClick('/billing'); }}
              class="flex items-center px-4 py-3 text-base font-medium text-gray-700 rounded-lg hover:bg-gray-50 hover:text-gray-900 touch-target-lg"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              Billing
            </a>
            <a
              href="/#/analytics"
              onclick={(e) => { e.preventDefault(); handleNavClick('/analytics'); }}
              class="flex items-center px-4 py-3 text-base font-medium text-gray-700 rounded-lg hover:bg-gray-50 hover:text-gray-900 touch-target-lg"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Analytics
            </a>
          </div>
        </div>
        
        <!-- Drawer Footer -->
        <div class="p-4 border-t border-gray-200 safe-bottom safe-x">
          {#if $authStore.user?.email}
            <p class="text-sm text-gray-500 mb-3 truncate">{$authStore.user.email}</p>
          {/if}
          <button
            type="button"
            onclick={handleSignOut}
            class="w-full flex items-center justify-center px-4 py-3 text-base font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 touch-target-lg"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </button>
        </div>
      </div>
    </nav>
  {/if}
  <main 
    id="main-content" 
    class="flex-1 flex flex-col overflow-hidden relative" 
    tabindex="-1"
    role="main"
    aria-label="Main content"
  >
    <Router {routes} on:routeEvent={handleRouteChange} />
  </main>
</div>

<!-- Cookie Consent Banner -->
<CookieConsent />
