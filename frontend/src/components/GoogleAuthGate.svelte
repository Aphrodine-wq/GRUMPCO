<script lang="ts">
  import { onMount } from 'svelte';
  import Button from '$lib/design-system/components/Button/Button.svelte';
  import { error, setUserAndSession, clearError } from '../stores/authStore';
  import { authGateStore } from '../stores/authGateStore';
  import { getApiBase } from '../lib/api';

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
      await startOAuthInCurrentWindow();
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

  async function startOAuthInCurrentWindow(): Promise<void> {
    isSigningIn = true;
    authError = null;
    clearError();

    try {
      const base = getApiBase();
      const appOrigin = window.location.origin;
      const redirectUri = `${base}/auth/google/callback`;
      const successRedirect = `${appOrigin}/auth/done`;

      const res = await fetch(
        `${base}/auth/google/url?redirect_uri=${encodeURIComponent(redirectUri)}&success_redirect=${encodeURIComponent(successRedirect)}`,
        { credentials: 'include' }
      );

      const data = (await res.json()) as { url?: string; error?: string };

      if (!res.ok) {
        authError = data.error || 'Failed to start sign-in';
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        authError = 'No OAuth URL received';
      }
    } catch (e) {
      authError = (e as Error).message || 'Network error';
    } finally {
      isSigningIn = false;
    }
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
    <div class="space-y-2">
      <h2 class="text-xl font-semibold text-gray-900">Welcome! Sign in to get started</h2>
      <p class="text-sm text-gray-500">
        Sign in with Google to sync your preferences and access cloud features. You can also skip
        and continue as a guest.
      </p>
    </div>

    <div class="space-y-3">
      <Button variant="primary" size="lg" onclick={handleGoogleSignIn} disabled={isSigningIn}>
        {#if isSigningIn}
          Signing in...
        {:else}
          Sign in with Google
        {/if}
      </Button>

      {#if authError || $error}
        <p class="text-sm text-red-600" role="alert">
          {authError || $error}
        </p>
      {/if}

      <button
        type="button"
        class="text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2"
        onclick={handleSkip}
      >
        Skip for now
      </button>
    </div>
  </div>
</div>
