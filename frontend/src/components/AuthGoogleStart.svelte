<script lang="ts">
  import { onMount } from 'svelte';
  import { getApiBase } from '../lib/api';

  onMount(async () => {
    try {
      const base = getApiBase();
      const redirectUri = `${base}/auth/google/callback`;
      // In Electron packaged build, file:// origin breaks redirects; use grump:// protocol
      const isElectron =
        typeof window !== 'undefined' &&
        (window as { grump?: { isElectron?: boolean } }).grump?.isElectron;
      const isFileOrigin =
        typeof window !== 'undefined' &&
        (window.location.origin === 'null' || window.location.protocol === 'file:');
      const successRedirect =
        isElectron && isFileOrigin ? 'grump://auth/done' : `${window.location.origin}/auth/done`;

      const res = await fetch(
        `${base}/auth/google/url?redirect_uri=${encodeURIComponent(redirectUri)}&success_redirect=${encodeURIComponent(successRedirect)}`,
        { credentials: 'include' }
      );

      const data = (await res.json()) as { url?: string; error?: string };

      if (data.url) {
        window.location.href = data.url;
      } else {
        document.body.innerHTML = `<div style="padding:2rem;font-family:system-ui;text-align:center">
          <p style="color:#dc2626">${data.error || 'Failed to start sign-in'}</p>
          <p><a href="/">Return to app</a></p>
        </div>`;
      }
    } catch (e) {
      document.body.innerHTML = `<div style="padding:2rem;font-family:system-ui;text-align:center">
        <p style="color:#dc2626">${(e as Error).message || 'Network error'}</p>
        <p><a href="/">Return to app</a></p>
      </div>`;
    }
  });
</script>

<div class="flex flex-col items-center justify-center min-h-screen bg-gray-50">
  <p class="text-gray-600">Signing in with Google...</p>
  <div
    class="mt-4 w-8 h-8 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin"
  ></div>
</div>
