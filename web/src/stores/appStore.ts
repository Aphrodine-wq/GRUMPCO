import { writable } from 'svelte/store'

export type AppView = 'dashboard' | 'workspace' | 'settings' | 'billing'

function createAppStore() {
  const { subscribe, update } = writable<{
    sidebarOpen: boolean
    currentView: AppView
    mobileMenuOpen: boolean
  }>({
    sidebarOpen: true,
    currentView: 'dashboard',
    mobileMenuOpen: false,
  })

  return {
    subscribe,
    toggleSidebar: () => update((s) => ({ ...s, sidebarOpen: !s.sidebarOpen })),
    setView: (view: AppView) => update((s) => ({ ...s, currentView: view })),
    toggleMobileMenu: () => update((s) => ({ ...s, mobileMenuOpen: !s.mobileMenuOpen })),
    setMobileMenuOpen: (open: boolean) => update((s) => ({ ...s, mobileMenuOpen: open })),
  }
}

export const appStore = createAppStore()
