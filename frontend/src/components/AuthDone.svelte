<script lang="ts">
  import { onMount } from 'svelte';
  import { setUserAndSession } from '../stores/authStore';
  import { getApiBase } from '../lib/api';
  import type { User, AuthSession } from '../stores/authStore';

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const userId = params.get('user_id');
    const email = params.get('email');
    const code = params.get('code');

    const grump = (window as { grump?: { auth?: { notifyComplete?: () => void } } }).grump;

    if (err) {
      document.body.innerHTML = `<div style="padding:2rem;font-family:system-ui;text-align:center">
        <p style="color:#dc2626">Sign-in failed: ${err}</p>
        <p style="margin-top:1rem">
          <a href="/" style="color:#7c3aed;text-decoration:underline;cursor:pointer">Return to app</a>
        </p>
      </div>`;
      return;
    }

    if (accessToken && userId) {
      const user: User = {
        id: userId,
        email: email || '',
        name: email?.split('@')[0],
      };
      const session: AuthSession = {
        access_token: accessToken,
        expires_at: undefined,
      };
      if (refreshToken) {
        (session as AuthSession & { refresh_token?: string }).refresh_token = refreshToken;
      }
      setUserAndSession(user, session);

      if (grump?.auth?.notifyComplete) {
        grump.auth.notifyComplete();
      }

      document.body.innerHTML = `<div style="padding:2rem;font-family:system-ui;text-align:center">
        <p style="color:#059669;font-weight:500">Sign-in successful!</p>
        <p class="text-gray-500 text-sm mt-1">Closing window...</p>
      </div>`;

      setTimeout(() => {
        try {
          window.close();
        } catch {
          /* ignore */
        }
      }, 800);
      return;
    }

    if (code) {
      const base = getApiBase();
      fetch(`${base}/auth/google/session?code=${encodeURIComponent(code)}`, {
        credentials: 'include',
      })
        .then(async (res) => {
          const data = (await res.json()) as {
            success?: boolean;
            user?: User | null;
            session?: AuthSession | null;
            error?: string;
          };
          if (!res.ok || !data.success) {
            throw new Error(data.error || 'Failed to complete sign-in');
          }
          if (data.user && data.session) {
            setUserAndSession(data.user, data.session);
          }
          if (grump?.auth?.notifyComplete) {
            grump.auth.notifyComplete();
          }
          document.body.innerHTML = `<div style="padding:2rem;font-family:system-ui;text-align:center">
            <p style="color:#059669;font-weight:500">Sign-in successful!</p>
            <p class="text-gray-500 text-sm mt-1">Closing window...</p>
          </div>`;
          setTimeout(() => {
            try {
              window.close();
            } catch {
              /* ignore */
            }
          }, 800);
        })
        .catch((e: Error) => {
          document.body.innerHTML = `<div style="padding:2rem;font-family:system-ui;text-align:center">
            <p style="color:#dc2626">Sign-in failed: ${e.message}</p>
            <p style="margin-top:1rem">
              <a href="/" style="color:#7c3aed;text-decoration:underline;cursor:pointer">Return to app</a>
            </p>
          </div>`;
        });
      return;
    }

    document.body.innerHTML = `<div style="padding:2rem;font-family:system-ui;text-align:center">
      <p style="color:#dc2626">Missing auth data. Please try again.</p>
      <p style="margin-top:1rem">
        <a href="/" style="color:#7c3aed;text-decoration:underline;cursor:pointer">Return to app</a>
      </p>
    </div>`;
  });
</script>

<div class="flex flex-col items-center justify-center min-h-screen bg-gray-50">
  <p class="text-gray-600">Completing sign-in...</p>
</div>
