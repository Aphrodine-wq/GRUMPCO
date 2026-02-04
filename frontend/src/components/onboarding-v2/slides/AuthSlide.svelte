<script lang="ts">
  import { onMount } from 'svelte';
  import { LogIn, Check, AlertCircle } from 'lucide-svelte';
  import { newOnboardingStore, type AuthProvider } from '../../../stores/newOnboardingStore';
  import { getApiBase } from '../../../lib/api.js';

  interface Props {
    onNext: () => void;
  }

  let { onNext }: Props = $props();

  let mounted = $state(false);
  let authState = $state<'idle' | 'loading' | 'success' | 'error'>('idle');
  let selectedProvider = $state<AuthProvider | null>(null);
  let errorMessage = $state('');

  const isElectron =
    typeof window !== 'undefined' &&
    !!(window as { grump?: { isElectron?: boolean } }).grump?.isElectron;

  onMount(() => {
    setTimeout(() => (mounted = true), 100);
  });

  async function handleGoogle() {
    selectedProvider = 'google';
    authState = 'loading';
    errorMessage = '';
    try {
      const grumpAuth = (window as unknown as { grump?: { auth?: { openOAuthWindow?: (p: string) => Promise<{ success: boolean; error?: string }> } } }).grump?.auth;
      if (isElectron && grumpAuth?.openOAuthWindow) {
        const result = await grumpAuth.openOAuthWindow('google');
        if (result.success) {
          authState = 'success';
          newOnboardingStore.setAuthProvider('google');
          newOnboardingStore.setAuthenticated(true);
          setTimeout(onNext, 1500);
          return;
        }
        throw new Error(result.error);
      }
      window.location.href = `${getApiBase()}/auth/google`;
    } catch (e) {
      authState = 'error';
      errorMessage = e instanceof Error ? e.message : 'Authentication failed';
      selectedProvider = null;
    }
  }

  function handleGitHub() {
    selectedProvider = 'github';
    authState = 'loading';
    errorMessage = '';
    window.location.href = `${getApiBase()}/auth/github`;
  }

  function handleDiscord() {
    selectedProvider = 'discord';
    authState = 'loading';
    errorMessage = '';
    window.location.href = `${getApiBase()}/auth/discord`;
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

    <!-- Auth buttons – match Sign In modal (GoogleAuthGate) -->
    <div class="auth-buttons">
      <button
        type="button"
        class="oauth-btn google-btn"
        disabled={authState === 'loading'}
        onclick={handleGoogle}
        aria-label="Sign in with Google"
      >
        {#if authState === 'loading' && selectedProvider === 'google'}
          <div class="loading-spinner"></div>
        {:else if authState === 'success' && selectedProvider === 'google'}
          <Check size={20} />
        {:else}
          <span class="btn-icon">
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 6.18-2.172l-2.908-2.258c-.806.54-1.837.86-3.272.86-2.52 0-4.661-1.704-5.522-4.04H.957v2.332C2.438 15.983 5.482 18 9 18z" />
              <path fill="#FBBC05" d="M3.478 10.392c-.18-.54-.282-1.117-.282-1.709 0-.593.102-1.17.282-1.709V4.643H.957C.347 5.963 0 7.278 0 8.683c0 1.405.348 2.72.957 4.04l2.521-2.331z" />
              <path fill="#EA4335" d="M9 3.58c1.42 0 2.693.49 3.698 1.44l2.76-2.76C13.463.89 11.426 0 9 0 5.482 0 2.438 2.017.957 4.643L3.478 6.974C4.339 4.638 6.479 3.58 9 3.58z" />
            </svg>
          </span>
        {/if}
        <span>Sign in with Google</span>
      </button>
      <button
        type="button"
        class="oauth-btn github-btn"
        disabled={authState === 'loading'}
        onclick={handleGitHub}
        aria-label="Sign in with GitHub"
      >
        <span class="btn-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
        </span>
        <span>Sign in with GitHub</span>
      </button>
      <button
        type="button"
        class="oauth-btn discord-btn"
        disabled={authState === 'loading'}
        onclick={handleDiscord}
        aria-label="Continue with Discord"
      >
        <span class="btn-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
          </svg>
        </span>
        <span>Continue with Discord</span>
      </button>
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

  .auth-buttons {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    max-width: 240px;
    margin-bottom: 1.5rem;
  }

  .oauth-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    width: 100%;
    padding: 10px 24px;
    font-size: 14px;
    font-weight: 500;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.15s, box-shadow 0.15s;
    border: 1px solid transparent;
  }

  .oauth-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .btn-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .google-btn {
    color: #3c4043;
    background: #fff;
    border-color: #dadce0;
  }

  .google-btn:hover:not(:disabled) {
    background: #f8f9fa;
    box-shadow: 0 1px 2px rgba(60, 64, 67, 0.3);
  }

  .github-btn {
    color: #fff;
    background: #24292f;
    border-color: #24292f;
  }

  .github-btn:hover:not(:disabled) {
    background: #1b1f23;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  .discord-btn {
    color: #fff;
    background: #5865f2;
    border-color: #5865f2;
  }

  .discord-btn:hover:not(:disabled) {
    background: #4752c4;
    box-shadow: 0 1px 3px rgba(88, 101, 242, 0.3);
  }

  .loading-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid #e5e7eb;
    border-top-color: #6b7280;
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
    .oauth-btn,
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
