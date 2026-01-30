<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { spring } from 'svelte/motion';

  // Props
  interface Props {
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
  }
  let { size = 'md', showLabel = false }: Props = $props();

  // Theme state
  type Theme = 'light' | 'dark' | 'system';
  let theme = $state<Theme>('system');
  let resolvedTheme = $state<'light' | 'dark'>('light');
  let isOpen = $state(false);

  // Animation
  const togglePosition = spring(0, { stiffness: 0.3, damping: 0.7 });

  // Size configurations
  const sizes = {
    sm: { toggle: 'w-12 h-6', icon: 16, dot: 'w-4 h-4' },
    md: { toggle: 'w-14 h-7', icon: 18, dot: 'w-5 h-5' },
    lg: { toggle: 'w-16 h-8', icon: 20, dot: 'w-6 h-6' },
  };

  // Get saved theme or default to system
  function getSavedTheme(): Theme {
    if (typeof window === 'undefined') return 'system';
    const saved = localStorage.getItem('g-rump-theme');
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved;
    }
    return 'system';
  }

  // Get system preference
  function getSystemTheme(): 'light' | 'dark' {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  // Resolve the actual theme
  function resolveTheme(t: Theme): 'light' | 'dark' {
    if (t === 'system') {
      return getSystemTheme();
    }
    return t;
  }

  // Apply theme to document
  function applyTheme(t: 'light' | 'dark') {
    if (typeof document === 'undefined') return;
    
    // Add transition class
    document.documentElement.classList.add('theme-transitioning');
    
    // Set theme attribute
    document.documentElement.setAttribute('data-theme', t);
    
    // Update meta theme-color
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', t === 'dark' ? '#0f0a1f' : '#ffffff');
    }
    
    // Remove transition class after animation
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.documentElement.classList.remove('theme-transitioning');
      });
    });
  }

  // Set theme
  function setTheme(newTheme: Theme) {
    theme = newTheme;
    resolvedTheme = resolveTheme(newTheme);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('g-rump-theme', newTheme);
    }
    
    applyTheme(resolvedTheme);
    togglePosition.set(resolvedTheme === 'dark' ? 1 : 0);
    isOpen = false;

    // Notify Electron if available
    if (typeof window !== 'undefined' && 'grump' in window) {
      const grump = window as unknown as { grump: { setTheme: (t: string) => void } };
      grump.grump.setTheme(newTheme);
    }
  }

  // Toggle between light and dark
  function toggle() {
    if (theme === 'system') {
      // If system, set to opposite of current resolved
      setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
    } else {
      setTheme(theme === 'dark' ? 'light' : 'dark');
    }
  }

  // Open dropdown
  function openDropdown() {
    isOpen = !isOpen;
  }

  // Close dropdown on outside click
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.theme-toggle-wrapper')) {
      isOpen = false;
    }
  }

  onMount(() => {
    // Initialize theme
    theme = getSavedTheme();
    resolvedTheme = resolveTheme(theme);
    applyTheme(resolvedTheme);
    togglePosition.set(resolvedTheme === 'dark' ? 1 : 0);

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        resolvedTheme = getSystemTheme();
        applyTheme(resolvedTheme);
        togglePosition.set(resolvedTheme === 'dark' ? 1 : 0);
      }
    };
    mediaQuery.addEventListener('change', handleChange);

    // Listen for clicks outside
    document.addEventListener('click', handleClickOutside);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
      document.removeEventListener('click', handleClickOutside);
    };
  });

  // Computed
  const sizeConfig = $derived(sizes[size]);
</script>

<div class="theme-toggle-wrapper" class:with-label={showLabel}>
  <!-- Simple Toggle (click to switch) -->
  <button
    class="theme-toggle {sizeConfig.toggle}"
    onclick={toggle}
    oncontextmenu={(e) => { e.preventDefault(); openDropdown(); }}
    aria-label="Toggle theme"
    title="Click to toggle, right-click for options"
  >
    <div class="toggle-track">
      <!-- Sun Icon -->
      <div class="icon sun" class:active={resolvedTheme === 'light'}>
        <svg 
          width={sizeConfig.icon} 
          height={sizeConfig.icon} 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          stroke-width="2"
          stroke-linecap="round" 
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/>
          <line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      </div>

      <!-- Toggle Dot -->
      <div 
        class="toggle-dot {sizeConfig.dot}"
        style="transform: translateX({$togglePosition * 100}%)"
      >
        {#if resolvedTheme === 'dark'}
          <svg 
            width={sizeConfig.icon - 4} 
            height={sizeConfig.icon - 4} 
            viewBox="0 0 24 24" 
            fill="currentColor"
            in:scale={{ duration: 200 }}
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        {:else}
          <svg 
            width={sizeConfig.icon - 4} 
            height={sizeConfig.icon - 4} 
            viewBox="0 0 24 24" 
            fill="currentColor"
            in:scale={{ duration: 200 }}
          >
            <circle cx="12" cy="12" r="5"/>
          </svg>
        {/if}
      </div>

      <!-- Moon Icon -->
      <div class="icon moon" class:active={resolvedTheme === 'dark'}>
        <svg 
          width={sizeConfig.icon} 
          height={sizeConfig.icon} 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          stroke-width="2"
          stroke-linecap="round" 
          stroke-linejoin="round"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      </div>
    </div>
  </button>

  {#if showLabel}
    <span class="theme-label">
      {resolvedTheme === 'dark' ? 'Dark' : 'Light'}
      {#if theme === 'system'}
        <span class="system-indicator">(Auto)</span>
      {/if}
    </span>
  {/if}

  <!-- Dropdown Menu -->
  {#if isOpen}
    <div class="theme-dropdown" transition:fade={{ duration: 150 }}>
      <button 
        class="dropdown-item" 
        class:active={theme === 'light'}
        onclick={() => setTheme('light')}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/>
          <line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
        <span>Light</span>
        {#if theme === 'light'}
          <svg class="check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        {/if}
      </button>

      <button 
        class="dropdown-item" 
        class:active={theme === 'dark'}
        onclick={() => setTheme('dark')}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
        <span>Dark</span>
        {#if theme === 'dark'}
          <svg class="check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        {/if}
      </button>

      <div class="dropdown-divider"></div>

      <button 
        class="dropdown-item" 
        class:active={theme === 'system'}
        onclick={() => setTheme('system')}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
        <span>System</span>
        {#if theme === 'system'}
          <svg class="check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        {/if}
      </button>
    </div>
  {/if}
</div>

<style>
  .theme-toggle-wrapper {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .theme-toggle {
    position: relative;
    display: flex;
    align-items: center;
    padding: 2px;
    border: none;
    border-radius: 9999px;
    background: var(--color-bg-inset, #ede9fe);
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: var(--shadow-inner);
  }

  .theme-toggle:hover {
    background: var(--color-bg-input, #f3e8ff);
  }

  .theme-toggle:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }

  .toggle-track {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    height: 100%;
    padding: 0 4px;
  }

  .icon {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-muted, #6d28d9);
    opacity: 0.5;
    transition: all 0.2s ease;
    z-index: 1;
  }

  .icon.active {
    opacity: 1;
    color: var(--color-primary, #7c3aed);
  }

  .toggle-dot {
    position: absolute;
    left: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-card, #fff);
    border-radius: 50%;
    box-shadow: var(--shadow-sm);
    color: var(--color-primary, #7c3aed);
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  [data-theme="dark"] .toggle-dot {
    background: var(--color-primary, #a78bfa);
    color: var(--color-bg-app, #0f0a1f);
  }

  .theme-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text, #1f1147);
    white-space: nowrap;
  }

  .system-indicator {
    font-size: 0.75rem;
    color: var(--color-text-muted, #6d28d9);
    margin-left: 0.25rem;
  }

  /* Dropdown */
  .theme-dropdown {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    min-width: 140px;
    padding: 4px;
    background: var(--color-bg-elevated, #fff);
    border: 1px solid var(--color-border, #e9d5ff);
    border-radius: 12px;
    box-shadow: var(--shadow-lg);
    z-index: 1000;
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--color-text, #1f1147);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .dropdown-item:hover {
    background: var(--color-bg-subtle, #f5f3ff);
  }

  .dropdown-item.active {
    background: var(--color-primary-subtle, rgba(124, 58, 237, 0.1));
    color: var(--color-primary, #7c3aed);
  }

  .dropdown-item span {
    flex: 1;
  }

  .dropdown-item .check {
    color: var(--color-primary, #7c3aed);
  }

  .dropdown-divider {
    height: 1px;
    margin: 4px 0;
    background: var(--color-border-light, #f3e8ff);
  }

  /* Size variants */
  .w-12 { width: 48px; }
  .w-14 { width: 56px; }
  .w-16 { width: 64px; }
  .h-6 { height: 24px; }
  .h-7 { height: 28px; }
  .h-8 { height: 32px; }
  .w-4 { width: 16px; }
  .w-5 { width: 20px; }
  .w-6 { width: 24px; }
  .h-4 { height: 16px; }
  .h-5 { height: 20px; }
  .h-6 { height: 24px; }

  /* Responsive */
  @media (max-width: 480px) {
    .theme-label {
      display: none;
    }
  }
</style>
