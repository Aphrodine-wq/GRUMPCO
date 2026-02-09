<script lang="ts">
  /**
   * AboutTab - Onboarding, legal links, and app version info.
   * Extracted from TabbedSettingsScreen.svelte (Phase 2 decomposition).
   */
  import { Card, Button } from '../../lib/design-system';
  import { setCurrentView } from '../../stores/uiStore';
  import { newOnboardingStore } from '../../stores/newOnboardingStore';
  import { authGateStore } from '../../stores/authGateStore';

  interface Props {
    isElectron: boolean;
    appVersion: string;
  }

  let { isElectron, appVersion }: Props = $props();
</script>

<div class="tab-section">
  <Card title="Onboarding & Help" padding="md">
    <p class="section-desc">
      Show the welcome and setup carousel again, run troubleshooting, or factory reset.
    </p>
    <div class="docker-actions">
      <Button
        variant="secondary"
        size="sm"
        onclick={() => {
          newOnboardingStore.reset();
          try {
            localStorage.removeItem('g-rump-onboarding-seen');
          } catch {}
          setCurrentView('chat');
          window.location.reload();
        }}
      >
        Show onboarding again
      </Button>
      {#if isElectron}
        <Button
          variant="secondary"
          size="sm"
          onclick={() => {
            authGateStore.resetAuthSkipped();
            window.location.reload();
          }}
        >
          Re-prompt for sign-in
        </Button>
      {/if}
      <Button variant="ghost" size="sm" onclick={() => setCurrentView('troubleshooting')}>
        Troubleshooting
      </Button>
      <Button variant="ghost" size="sm" onclick={() => setCurrentView('reset')}>
        Factory Reset
      </Button>
    </div>
  </Card>

  <Card title="Legal" padding="md">
    <p class="section-desc">Terms of Service, Privacy Policy, and Acceptable Use Policy.</p>
    <div class="legal-links">
      <Button
        variant="ghost"
        size="sm"
        onclick={() => window.open('https://docs.g-rump.com/legal/terms', '_blank')}
      >
        Terms of Service
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onclick={() => window.open('https://docs.g-rump.com/legal/privacy', '_blank')}
      >
        Privacy Policy
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onclick={() => window.open('https://docs.g-rump.com/legal/acceptable-use', '_blank')}
      >
        Acceptable Use
      </Button>
    </div>
  </Card>

  <Card title="About G-Rump" padding="md">
    <div class="about-info">
      <p class="about-version">Version: {appVersion}</p>
      <p class="about-desc">
        G-Rump is an AI-powered development assistant that helps you write, understand, and refactor
        code.
      </p>
    </div>
  </Card>
</div>

<style>

.tab-section {
    max-width: 900px;
    display: flex;
    flex-direction: column;
    gap: 28px;
  }

.tab-section :global(.card) {
    border: 1px solid #e5e7eb;
  }

.models-custom-inner .section-desc {
    margin-bottom: 0.75rem;
  }

.section-desc {
    font-size: 14px;
    color: var(--color-text-muted, #71717a);
    margin-bottom: 20px;
  }

.docker-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }

.legal-links {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

.about-info {
    text-align: center;
    padding: 20px;
  }

.about-version {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text-secondary, #3f3f46);
    margin-bottom: 8px;
  }

.about-desc {
    font-size: 14px;
    color: var(--color-text-muted, #71717a);
  }
</style>
