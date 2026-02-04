<script lang="ts">
  import { onMount } from 'svelte';
  import { LogIn, Check, AlertCircle } from 'lucide-svelte';
  import { newOnboardingStore, type AuthProvider } from '../../../stores/newOnboardingStore';

  interface Props {
    onNext: () => void;
  }

  let { onNext }: Props = $props();

  let mounted = $state(false);
  let authState = $state<'idle' | 'loading' | 'success' | 'error'>('idle');
  let selectedProvider = $state<AuthProvider | null>(null);
  let errorMessage = $state('');

  // Check for grump API (Electron environment)
  const isElectron =
    typeof window !== 'undefined' &&
    !!(window as { grump?: { isElectron?: boolean } }).grump?.isElectron;

  onMount(() => {
    setTimeout(() => (mounted = true), 100);
  });

  const providers = [
    {
      id: 'google' as AuthProvider,
      name: 'Google',
      icon: '🔵',
      bgColor: '#4285F4',
      description: 'Sign in with your Google account',
    },
    {
      id: 'github' as AuthProvider,
      name: 'GitHub',
      icon: '⚫',
      bgColor: '#24292e',
      description: 'Sign in with your GitHub account',
    },
    {
      id: 'discord' as AuthProvider,
      name: 'Discord',
      icon: '🟣',
      bgColor: '#5865F2',
      description: 'Sign in with your Discord account',
    },
  ];

  async function handleAuth(provider: AuthProvider) {
    selectedProvider = provider;
    authState = 'loading';
    errorMessage = '';

    try {
      // In Electron, we'll use the IPC to open OAuth window
      // For now, simulate the flow
      if (isElectron) {
        const grump = (
          window as {
            grump?: {
              auth?: {
                openOAuthWindow?: (
                  provider: string
                ) => Promise<{ success: boolean; error?: string }>;
              };
            };
          }
        ).grump;
        if (grump?.auth?.openOAuthWindow) {
          const result = await grump.auth.openOAuthWindow(provider);
          if (result.success) {
            authState = 'success';
            newOnboardingStore.setAuthProvider(provider);
            newOnboardingStore.setAuthenticated(true);
            setTimeout(onNext, 1500);
            return;
          } else {
            throw new Error(result.error || 'Authentication failed');
          }
        }
      }

      // Fallback: redirect to OAuth URL
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      window.location.href = `${baseUrl}/auth/${provider}`;
    } catch (error) {
      authState = 'error';
      errorMessage =
        error instanceof Error ? error.message : 'Authentication failed. Please try again.';
      selectedProvider = null;
    }
  }

  function handleSkip() {
    newOnboardingStore.setAuthenticated(false);
    onNext();
  }
</script>

<div class="slide-container">
  <div class="content" class:mounted>
    <!-- Header -->
    <div class="header">
      <div class="header-icon">
        <LogIn size={28} />
      </div>
      <h2 class="title">Sign In</h2>
      <p class="subtitle">Connect your account to sync settings across devices</p>
    </div>

    <!-- Auth buttons -->
    <div class="auth-buttons">
      {#each providers as provider}
        <button
          class="auth-button"
          class:loading={authState === 'loading' && selectedProvider === provider.id}
          class:success={authState === 'success' && selectedProvider === provider.id}
          disabled={authState === 'loading'}
          onclick={() => handleAuth(provider.id)}
          style="--provider-color: {provider.bgColor}"
        >
          {#if authState === 'loading' && selectedProvider === provider.id}
            <div class="loading-spinner"></div>
          {:else if authState === 'success' && selectedProvider === provider.id}
            <Check size={24} />
          {:else}
            <span class="provider-icon">{provider.icon}</span>
          {/if}
          <span class="provider-name">
            {#if authState === 'success' && selectedProvider === provider.id}
              Connected!
            {:else}
              Continue with {provider.name}
            {/if}
          </span>
        </button>
      {/each}
    </div>

    <!-- Error message -->
    {#if authState === 'error' && errorMessage}
      <div class="error-message">
        <AlertCircle size={16} />
        <span>{errorMessage}</span>
      </div>
    {/if}

    <!-- Divider -->
    <div class="divider">
      <span>or</span>
    </div>

    <!-- Skip option -->
    <button class="skip-button" onclick={handleSkip}> Skip for now </button>

    <p class="privacy-note">
      We only use your email for account identification. Your code and data remain private.
    </p>
  </div>
</div>

<style>
  .slide-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100%;
    padding: 2rem;
  }

  .content {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    max-width: 400px;
    width: 100%;
    opacity: 0;
    transform: translateY(20px);
    transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .content.mounted {
    opacity: 1;
    transform: translateY(0);
  }

  /* Header */
  .header {
    margin-bottom: 2rem;
  }

  .header-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
    border-radius: 20px;
    color: white;
    margin-bottom: 1rem;
    box-shadow: 0 4px 20px rgba(124, 58, 237, 0.4);
  }

  .title {
    font-size: 2rem;
    font-weight: 700;
    color: #1f2937;
    margin-bottom: 0.5rem;
  }

  .subtitle {
    font-size: 1rem;
    color: #6b7280;
  }

  /* Auth buttons */
  .auth-buttons {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    width: 100%;
    margin-bottom: 1.5rem;
  }

  .auth-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.875rem 1.5rem;
    background: white;
    border: 2px solid #e5e7eb;
    border-radius: 12px;
    font-size: 1rem;
    font-weight: 500;
    color: #374151;
    cursor: pointer;
    transition: all 0.2s ease-out;
  }

  .auth-button:hover:not(:disabled) {
    border-color: var(--provider-color);
    background: color-mix(in srgb, var(--provider-color) 5%, white);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .auth-button:focus-visible {
    outline: none;
    border-color: var(--provider-color);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--provider-color) 30%, transparent);
  }

  .auth-button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .auth-button.loading {
    border-color: var(--provider-color);
  }

  .auth-button.success {
    background: #10b981;
    border-color: #10b981;
    color: white;
  }

  .provider-icon {
    font-size: 1.25rem;
  }

  .provider-name {
    flex: 1;
    text-align: center;
  }

  .loading-spinner {
    width: 24px;
    height: 24px;
    border: 2px solid #e5e7eb;
    border-top-color: var(--provider-color);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Error message */
  .error-message {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 8px;
    color: #dc2626;
    font-size: 0.875rem;
    margin-bottom: 1rem;
    width: 100%;
  }

  /* Divider */
  .divider {
    display: flex;
    align-items: center;
    width: 100%;
    margin-bottom: 1rem;
  }

  .divider::before,
  .divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: #e5e7eb;
  }

  .divider span {
    padding: 0 1rem;
    font-size: 0.875rem;
    color: #9ca3af;
  }

  /* Skip button */
  .skip-button {
    padding: 0.75rem 2rem;
    background: transparent;
    border: none;
    color: #6b7280;
    font-size: 0.9375rem;
    font-weight: 500;
    cursor: pointer;
    transition: color 0.2s;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .skip-button:hover {
    color: #374151;
  }

  .skip-button:focus-visible {
    outline: 2px solid #7c3aed;
    outline-offset: 2px;
    border-radius: 4px;
  }

  /* Privacy note */
  .privacy-note {
    margin-top: 1.5rem;
    font-size: 0.75rem;
    color: #9ca3af;
    max-width: 300px;
    line-height: 1.5;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .content,
    .auth-button,
    .loading-spinner {
      animation: none;
      transition: none;
    }

    .content.mounted {
      opacity: 1;
      transform: none;
    }
  }
</style>
