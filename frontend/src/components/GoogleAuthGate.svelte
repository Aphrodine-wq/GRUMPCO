<script lang="ts">
  import { onMount } from 'svelte';
  import { error, setUserAndSession, clearError } from '../stores/authStore';
  import { authGateStore } from '../stores/authGateStore';
  import { getApiBase } from '../lib/api';
  import FrownyFace from './FrownyFace.svelte';

  interface Props {
    onComplete?: () => void;
    onSkip?: () => void;
  }

  let { onComplete, onSkip }: Props = $props();

  let isSigningIn = $state(false);
  let authError = $state<string | null>(null);

  function handleSkip(): void {
    authGateStore.markAuthSkipped();
    onSkip?.();
  }

  async function handleGoogleSignIn(): Promise<void> {
    const grump = (window as { grump?: { auth?: { openGoogleSignIn?: () => Promise<void> } } })
      .grump;

    if (!grump?.auth?.openGoogleSignIn) {
      // Fallback: open OAuth URL in same window (web or Electron without IPC)
      await startOAuthInCurrentWindow('google');
      return;
    }

    isSigningIn = true;
    authError = null;
    clearError();

    try {
      await grump.auth.openGoogleSignIn();
      // Success is handled via storage event or IPC callback
    } catch (e) {
      authError = (e as Error).message || 'Sign-in failed';
    } finally {
      isSigningIn = false;
    }
  }

  async function startOAuthInCurrentWindow(
    provider: 'google' | 'github' | 'discord'
  ): Promise<void> {
    isSigningIn = true;
    authError = null;
    clearError();

    try {
      // First check if the backend is reachable
      const healthCheck = await fetch(`${getApiBase()}/health/quick`, {
        signal: AbortSignal.timeout(5000),
      }).catch(() => null);

      if (!healthCheck?.ok) {
        authError = 'Backend server is not reachable. Please ensure the server is running.';
        isSigningIn = false;
        return;
      }

      // Redirect to OAuth endpoint
      window.location.href = `${getApiBase()}/auth/${provider}`;
    } catch (e) {
      authError = (e as Error).message || 'Failed to start sign-in';
      isSigningIn = false;
    }
  }

  function handleGitHubSignIn(): void {
    startOAuthInCurrentWindow('github');
  }

  function handleDiscordSignIn(): void {
    startOAuthInCurrentWindow('discord');
  }

  onMount(() => {
    function handleAuthComplete() {
      try {
        const stored = localStorage.getItem('mermaid-auth');
        if (stored) {
          const auth = JSON.parse(stored) as { user?: unknown; session?: unknown };
          if (auth?.user && auth?.session) {
            setUserAndSession(
              auth.user as import('../stores/authStore').User,
              auth.session as import('../stores/authStore').AuthSession
            );
            onComplete?.();
          }
        }
      } catch {
        /* ignore */
      }
    }

    function onStorage(e: StorageEvent) {
      if (e.key === 'mermaid-auth' && e.newValue) {
        handleAuthComplete();
      }
    }

    window.addEventListener('storage', onStorage);

    const grump = (window as { grump?: { auth?: { onComplete?: (cb: () => void) => () => void } } })
      .grump;
    const unsubscribe = grump?.auth?.onComplete?.(handleAuthComplete);

    return () => {
      window.removeEventListener('storage', onStorage);
      unsubscribe?.();
    };
  });
</script>

<div class="google-auth-gate flex flex-col items-center justify-center min-h-[60vh] px-6">
  <div class="max-w-sm w-full text-center space-y-6">
    <div class="auth-logo" aria-hidden="true">
      <FrownyFace size="xl" state="idle" animated={false} />
    </div>
    <div class="space-y-2">
      <h2 class="text-xl font-semibold text-gray-900">Welcome! Sign in to get started</h2>
      <p class="text-sm text-gray-500">
        Sign in with Google, GitHub, or Discord to sync your preferences and access cloud features.
        You can also skip and continue as a guest.
      </p>
    </div>

    <div class="auth-actions">
      <button
        type="button"
        class="oauth-btn google-signin-btn"
        onclick={handleGoogleSignIn}
        disabled={isSigningIn}
        aria-label="Sign in with Google"
      >
        <span class="btn-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <path
              fill="#4285F4"
              d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
            />
            <path
              fill="#34A853"
              d="M9 18c2.43 0 4.467-.806 6.18-2.172l-2.908-2.258c-.806.54-1.837.86-3.272.86-2.52 0-4.661-1.704-5.522-4.04H.957v2.332C2.438 15.983 5.482 18 9 18z"
            />
            <path
              fill="#FBBC05"
              d="M3.478 10.392c-.18-.54-.282-1.117-.282-1.709 0-.593.102-1.17.282-1.709V4.643H.957C.347 5.963 0 7.278 0 8.683c0 1.405.348 2.72.957 4.04l2.521-2.331z"
            />
            <path
              fill="#EA4335"
              d="M9 3.58c1.42 0 2.693.49 3.698 1.44l2.76-2.76C13.463.89 11.426 0 9 0 5.482 0 2.438 2.017.957 4.643L3.478 6.974C4.339 4.638 6.479 3.58 9 3.58z"
            />
          </svg>
        </span>
        {#if isSigningIn}
          <span>Signing in...</span>
        {:else}
          <span>Sign in with Google</span>
        {/if}
      </button>

      <button
        type="button"
        class="oauth-btn github-signin-btn"
        onclick={handleGitHubSignIn}
        disabled={isSigningIn}
        aria-label="Sign in with GitHub"
      >
        <span class="btn-icon" aria-hidden="true">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
            />
          </svg>
        </span>
        <span>Sign in with GitHub</span>
      </button>

      <button
        type="button"
        class="oauth-btn discord-signin-btn"
        onclick={handleDiscordSignIn}
        disabled={isSigningIn}
        aria-label="Continue with Discord"
      >
        <span class="btn-icon" aria-hidden="true">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"
            />
          </svg>
        </span>
        <span>Continue with Discord</span>
      </button>

      {#if authError || $error}
        <p class="auth-error" role="alert">
          {authError || $error}
        </p>
      {/if}

      <button type="button" class="skip-btn" onclick={handleSkip}> Skip for now </button>
    </div>
  </div>
</div>

<style>
  .auth-logo {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 0.25rem;
  }

  .auth-actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  .oauth-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    width: 100%;
    max-width: 240px;
    padding: 10px 24px;
    font-size: 14px;
    font-weight: 500;
    border-radius: 4px;
    cursor: pointer;
    transition:
      background 0.15s,
      box-shadow 0.15s;
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

  .google-signin-btn {
    color: #3c4043;
    background: #fff;
    border-color: #dadce0;
    font-family: 'Google Sans', Roboto, sans-serif;
  }

  .google-signin-btn:hover:not(:disabled) {
    background: #f8f9fa;
    box-shadow: 0 1px 2px rgba(60, 64, 67, 0.3);
  }

  .github-signin-btn {
    color: #fff;
    background: #24292f;
    border-color: #24292f;
  }

  .github-signin-btn:hover:not(:disabled) {
    background: #1b1f23;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  .discord-signin-btn {
    color: #fff;
    background: #5865f2;
    border-color: #5865f2;
  }

  .discord-signin-btn:hover:not(:disabled) {
    background: #4752c4;
    box-shadow: 0 1px 3px rgba(88, 101, 242, 0.3);
  }

  .auth-error {
    margin: 0;
    font-size: 0.875rem;
    color: #dc2626;
  }

  .skip-btn {
    margin-top: 1rem;
    padding: 0.5rem 0;
    font-size: 0.875rem;
    color: #6b7280;
    background: none;
    border: none;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .skip-btn:hover {
    color: #374151;
  }
</style>
