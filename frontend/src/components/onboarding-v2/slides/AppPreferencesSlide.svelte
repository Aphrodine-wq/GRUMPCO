<script lang="ts">
  import { onMount } from 'svelte';
  import { Settings, Sun, Moon, Monitor, BarChart3 } from 'lucide-svelte';
  import { newOnboardingStore, type AppTheme } from '../../../stores/newOnboardingStore';

  interface Props {
    onNext: () => void;
  }

  let { onNext }: Props = $props();

  let mounted = $state(false);
  let theme = $state<AppTheme>('system');
  let telemetryOptIn = $state(true);

  onMount(() => {
    setTimeout(() => (mounted = true), 100);

    // Load existing preferences
    const current = newOnboardingStore.get();
    theme = current.theme;
    telemetryOptIn = current.telemetryOptIn;
  });

  function setTheme(newTheme: AppTheme) {
    theme = newTheme;
    newOnboardingStore.setTheme(newTheme);
  }

  function toggleTelemetry() {
    telemetryOptIn = !telemetryOptIn;
    newOnboardingStore.setTelemetry(telemetryOptIn);
  }

  function handleContinue() {
    newOnboardingStore.setTheme(theme);
    newOnboardingStore.setTelemetry(telemetryOptIn);
    onNext();
  }

  const themeOptions = [
    { id: 'light' as AppTheme, icon: Sun, label: 'Light', description: 'Light background' },
    { id: 'dark' as AppTheme, icon: Moon, label: 'Dark', description: 'Dark background' },
    { id: 'system' as AppTheme, icon: Monitor, label: 'System', description: 'Match OS setting' },
  ];
</script>

<div class="slide-container">
  <div class="content" class:mounted>
    <!-- Header -->
    <div class="header">
      <div class="header-icon">
        <Settings size={28} />
      </div>
      <h2 class="title">App Preferences</h2>
      <p class="subtitle">Customize your G-Rump experience</p>
    </div>

    <!-- Theme selection -->
    <div class="preference-section">
      <h3 class="section-title">Theme</h3>
      <div class="theme-options">
        {#each themeOptions as option}
          <button
            class="theme-option"
            class:selected={theme === option.id}
            onclick={() => setTheme(option.id)}
          >
            <div class="theme-icon">
              {#if option.icon}
                {@const OptionIcon = option.icon}
                <OptionIcon size={24} />
              {/if}
            </div>
            <span class="theme-label">{option.label}</span>
            <span class="theme-desc">{option.description}</span>
          </button>
        {/each}
      </div>
    </div>

    <!-- Telemetry opt-in -->
    <div class="preference-section">
      <div class="toggle-row">
        <div class="toggle-content">
          <div class="toggle-icon">
            <BarChart3 size={20} />
          </div>
          <div class="toggle-text">
            <span class="toggle-label">Help improve G-Rump</span>
            <span class="toggle-desc">Send anonymous usage data to help us make G-Rump better</span>
          </div>
        </div>
        <button
          class="toggle-switch"
          class:active={telemetryOptIn}
          onclick={toggleTelemetry}
          role="switch"
          aria-checked={telemetryOptIn}
        >
          <span class="toggle-thumb"></span>
        </button>
      </div>
      <p class="privacy-note">
        We never collect your code, prompts, or personal data.
        <a href="https://docs.g-rump.dev/privacy" target="_blank" rel="noopener">Learn more</a>
      </p>
    </div>

    <!-- CTA -->
    <button class="cta-button" onclick={handleContinue}>
      <span>Continue</span>
      <svg class="arrow" viewBox="0 0 20 20" fill="currentColor">
        <path
          fill-rule="evenodd"
          d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
          clip-rule="evenodd"
        />
      </svg>
    </button>
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
    max-width: 500px;
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
    width: 56px;
    height: 56px;
    background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
    border-radius: 16px;
    color: white;
    margin-bottom: 1rem;
    box-shadow: 0 4px 16px rgba(124, 58, 237, 0.3);
  }

  .title {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--color-text);
    margin-bottom: 0.5rem;
  }

  .subtitle {
    font-size: 1rem;
    color: var(--color-text-muted);
  }

  /* Preference sections */
  .preference-section {
    width: 100%;
    margin-bottom: 1.5rem;
  }

  .section-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    text-align: left;
    margin-bottom: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* Theme options */
  .theme-options {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.75rem;
  }

  .theme-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem;
    background: var(--color-bg-card);
    border: 2px solid var(--color-border);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease-out;
  }

  .theme-option:hover {
    border-color: #d1d5db;
    transform: translateY(-2px);
  }

  .theme-option.selected {
    border-color: #7c3aed;
    background: linear-gradient(135deg, rgba(124, 58, 237, 0.05) 0%, rgba(109, 40, 217, 0.05) 100%);
    box-shadow: 0 4px 12px rgba(124, 58, 237, 0.15);
  }

  .theme-option:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.3);
  }

  .theme-icon {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-secondary);
    border-radius: 12px;
    color: var(--color-text-muted);
    transition: all 0.2s;
  }

  .theme-option.selected .theme-icon {
    background: #7c3aed;
    color: white;
  }

  .theme-label {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .theme-desc {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  /* Toggle row */
  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    margin-bottom: 0.75rem;
  }

  .toggle-content {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .toggle-icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-secondary);
    border-radius: 10px;
    color: var(--color-text-muted);
  }

  .toggle-text {
    display: flex;
    flex-direction: column;
    text-align: left;
  }

  .toggle-label {
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--color-text-secondary);
  }

  .toggle-desc {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  .toggle-switch {
    position: relative;
    width: 48px;
    height: 28px;
    background: #e5e7eb;
    border: none;
    border-radius: 9999px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .toggle-switch.active {
    background: #7c3aed;
  }

  .toggle-switch:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.3);
  }

  .toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 24px;
    height: 24px;
    background: var(--color-bg-card);
    border-radius: 50%;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    transition: transform 0.2s;
  }

  .toggle-switch.active .toggle-thumb {
    transform: translateX(20px);
  }

  .privacy-note {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    text-align: left;
  }

  .privacy-note a {
    color: #7c3aed;
    text-decoration: none;
  }

  .privacy-note a:hover {
    text-decoration: underline;
  }

  /* CTA Button */
  .cta-button {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 2rem;
    background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
    color: white;
    font-size: 1.125rem;
    font-weight: 600;
    border: none;
    border-radius: 9999px;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(124, 58, 237, 0.4);
    transition: all 0.2s ease-out;
    margin-top: 1rem;
  }

  .cta-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 24px rgba(124, 58, 237, 0.5);
  }

  .cta-button:focus-visible {
    outline: none;
    box-shadow:
      0 0 0 4px rgba(124, 58, 237, 0.3),
      0 4px 16px rgba(124, 58, 237, 0.4);
  }

  .arrow {
    width: 1.25rem;
    height: 1.25rem;
    transition: transform 0.2s;
  }

  .cta-button:hover .arrow {
    transform: translateX(4px);
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .content,
    .theme-option,
    .toggle-thumb {
      transition: none;
    }

    .content.mounted {
      opacity: 1;
      transform: none;
    }
  }
</style>
