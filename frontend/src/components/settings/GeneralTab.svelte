<script lang="ts">
  /**
   * GeneralTab – Extracted from TabbedSettingsScreen.svelte (tab: 'general')
   * Phase 2 decomposition.
   *
   * TODO: Replace `any` props with explicit types for full type safety.
   */
  import { Card } from '../../lib/design-system';
  import { Monitor, Moon, Sun } from 'lucide-svelte';
  import type { AppTheme } from '../../stores/newOnboardingStore';

  interface Props {
    accentColor: any;
    density: any;
    hasWakeWord: any;
    newOnboardingStore: any;
    preferencesStore: any;
    saveAccessibility: any;
    savePreferences: any;
    setAccentColor: any;
    setStartupView: any;
    setUiFontSize: any;
    setWakeWordEnabled: any;
    settings: any;
    startupView: any;
    uiFontSize: any;
    wakeWordEnabled: any;
  }

  let {
    accentColor,
    density,
    hasWakeWord,
    newOnboardingStore,
    preferencesStore,
    saveAccessibility,
    savePreferences,
    setAccentColor,
    setStartupView,
    setUiFontSize,
    setWakeWordEnabled,
    settings,
    startupView,
    uiFontSize,
    wakeWordEnabled,
  }: Props = $props();
</script>

<div class="tab-section">
  <Card title="Theme" padding="md">
    <p class="section-desc">
      Choose light, dark, or follow your system preference. Dark mode applies across the app.
    </p>
    <div class="theme-cards">
      {#each [{ id: 'light' as AppTheme, label: 'Light', icon: Sun, desc: 'Bright backgrounds' }, { id: 'dark' as AppTheme, label: 'Dark', icon: Moon, desc: 'Easy on the eyes' }, { id: 'system' as AppTheme, label: 'System', icon: Monitor, desc: 'Follow OS setting' }] as option}
        <button
          type="button"
          class="theme-card"
          class:selected={$newOnboardingStore?.theme === option.id}
          onclick={() => newOnboardingStore.setTheme(option.id)}
          aria-pressed={$newOnboardingStore?.theme === option.id}
        >
          <span class="theme-card-icon"><option.icon size={24} /></span>
          <span class="theme-card-label">{option.label}</span>
          <span class="theme-card-desc">{option.desc}</span>
        </button>
      {/each}
    </div>
  </Card>

  <Card title="Appearance" padding="md">
    <p class="section-desc">Layout density, accent color, and UI font size.</p>
    <div class="field-group" role="group" aria-labelledby="density-label">
      <span id="density-label" class="radio-label">Density</span>
      <div class="radio-row">
        <label class="radio-option">
          <input
            type="radio"
            name="density"
            value="comfortable"
            checked={$density !== 'compact'}
            onchange={() => preferencesStore.setDensity('comfortable')}
          />
          <span>Comfortable</span>
        </label>
        <label class="radio-option">
          <input
            type="radio"
            name="density"
            value="compact"
            checked={$density === 'compact'}
            onchange={() => preferencesStore.setDensity('compact')}
          />
          <span>Compact</span>
        </label>
      </div>
    </div>
    <div class="field-group" role="group" aria-labelledby="accent-label">
      <span id="accent-label" class="radio-label">Accent color</span>
      <div class="accent-row">
        {#each [{ id: 'purple', color: '#7c3aed', label: 'Purple' }, { id: 'blue', color: '#2563eb', label: 'Blue' }, { id: 'green', color: '#059669', label: 'Green' }, { id: 'amber', color: '#d97706', label: 'Amber' }, { id: 'rose', color: '#e11d48', label: 'Rose' }, { id: 'teal', color: '#0d9488', label: 'Teal' }, { id: 'indigo', color: '#4f46e5', label: 'Indigo' }, { id: 'orange', color: '#ea580c', label: 'Orange' }, { id: 'cyan', color: '#0891b2', label: 'Cyan' }, { id: 'slate', color: '#475569', label: 'Slate' }] as acc}
          <button
            type="button"
            class="accent-swatch"
            class:selected={accentColor === acc.id}
            style="--swatch-color: {acc.color}"
            onclick={() => setAccentColor(acc.id)}
            title={acc.label}
            aria-pressed={accentColor === acc.id}
          >
            {#if accentColor === acc.id}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                stroke-width="3"><path d="M5 12l5 5L20 7" /></svg
              >
            {/if}
          </button>
        {/each}
      </div>
    </div>
    <div class="field-group" role="group" aria-labelledby="font-size-label">
      <span id="font-size-label" class="radio-label">UI font size</span>
      <div class="radio-row">
        {#each ['small', 'medium', 'large'] as size}
          <label class="radio-option">
            <input
              type="radio"
              name="fontSize"
              value={size}
              checked={uiFontSize === size}
              onchange={() => setUiFontSize(size as 'small' | 'medium' | 'large')}
            />
            <span>{size.charAt(0).toUpperCase() + size.slice(1)}</span>
          </label>
        {/each}
      </div>
    </div>
  </Card>

  <Card title="Startup" padding="md">
    <p class="section-desc">Choose which view to show when the app opens.</p>
    <div class="field-group" role="group" aria-labelledby="startup-label">
      <span id="startup-label" class="radio-label">Startup view</span>
      <div class="radio-row">
        <label class="radio-option">
          <input
            type="radio"
            name="startupView"
            value="chat"
            checked={startupView === 'chat'}
            onchange={() => setStartupView('chat')}
          />
          <span>Chat</span>
        </label>
        <label class="radio-option">
          <input
            type="radio"
            name="startupView"
            value="projects"
            checked={startupView === 'projects'}
            onchange={() => setStartupView('projects')}
          />
          <span>Projects</span>
        </label>
        <label class="radio-option">
          <input
            type="radio"
            name="startupView"
            value="last"
            checked={startupView === 'last'}
            onchange={() => setStartupView('last')}
          />
          <span>Last view</span>
        </label>
      </div>
    </div>
  </Card>

  <Card title="Privacy & Telemetry" padding="md">
    <p class="section-desc">
      Help improve G-Rump by sharing anonymous usage data. No code or prompts are sent.
    </p>
    <div class="field-group">
      <label class="checkbox-field">
        <input
          type="checkbox"
          checked={$newOnboardingStore?.telemetryOptIn ?? true}
          onchange={(e) => newOnboardingStore.setTelemetry((e.target as HTMLInputElement).checked)}
        />
        <span class="checkbox-label-text">Send anonymous usage analytics</span>
      </label>
    </div>
  </Card>

  <Card title="Accessibility" padding="md">
    <div class="field-group">
      <label class="checkbox-field">
        <input
          type="checkbox"
          checked={settings?.accessibility?.reducedMotion ?? false}
          onchange={(e) =>
            saveAccessibility({
              ...settings?.accessibility,
              reducedMotion: (e.target as HTMLInputElement).checked,
            })}
        />
        <span class="checkbox-label-text">Reduced Motion</span>
      </label>
      <p class="field-hint">Disable animations for users who prefer reduced motion.</p>
    </div>
    <div class="field-group">
      <label class="checkbox-field">
        <input
          type="checkbox"
          checked={settings?.accessibility?.highContrast ?? false}
          onchange={(e) =>
            saveAccessibility({
              ...settings?.accessibility,
              highContrast: (e.target as HTMLInputElement).checked,
            })}
        />
        <span class="checkbox-label-text">High Contrast Mode</span>
      </label>
      <p class="field-hint">Increase contrast for better visibility.</p>
    </div>
  </Card>

  <Card title="Keyboard Shortcuts" padding="md">
    <p class="section-desc">Use these shortcuts to navigate and focus quickly.</p>
    <ul class="shortcuts-list">
      <li><kbd>Ctrl</kbd> + <kbd>B</kbd> — Toggle sidebar</li>
      <li>
        <kbd>/</kbd> or <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>L</kbd> — Focus chat input
      </li>
      <li><kbd>Ctrl</kbd> + <kbd>K</kbd> — Open command palette</li>
      <li><kbd>Ctrl</kbd> + <kbd>N</kbd> — New session</li>
      <li><kbd>Escape</kbd> — Close modal / panel</li>
    </ul>
  </Card>

  <Card title="Performance" padding="md">
    <p class="section-desc">Control animation speed and rendering optimizations.</p>
    <div class="field-group">
      <label class="checkbox-field">
        <input type="checkbox" checked={true} disabled />
        <span class="checkbox-label-text">250 FPS Mode</span>
      </label>
      <p class="field-hint">
        Ultra-fast transitions and reduced blur for maximum responsiveness. Always enabled.
      </p>
    </div>
    <div class="field-group">
      <label class="checkbox-field">
        <input
          type="checkbox"
          checked={settings?.accessibility?.reducedMotion ?? false}
          onchange={(e) =>
            saveAccessibility({
              ...settings?.accessibility,
              reducedMotion: (e.target as HTMLInputElement).checked,
            })}
        />
        <span class="checkbox-label-text">Disable all animations</span>
      </label>
      <p class="field-hint">Completely removes animations for maximum performance.</p>
    </div>
  </Card>

  <Card title="Notifications" padding="md">
    <p class="section-desc">Control desktop and in-app notifications.</p>
    <div class="field-group">
      <label class="checkbox-field">
        <input
          type="checkbox"
          checked={settings?.preferences?.desktopNotifications ?? true}
          onchange={(e) =>
            savePreferences({
              ...settings?.preferences,
              desktopNotifications: (e.target as HTMLInputElement).checked,
            })}
        />
        <span class="checkbox-label-text">Desktop notifications</span>
      </label>
      <p class="field-hint">Show system notifications for completed tasks and alerts.</p>
    </div>
    <div class="field-group">
      <label class="checkbox-field">
        <input
          type="checkbox"
          checked={settings?.preferences?.soundEffects ?? false}
          onchange={(e) =>
            savePreferences({
              ...settings?.preferences,
              soundEffects: (e.target as HTMLInputElement).checked,
            })}
        />
        <span class="checkbox-label-text">Sound effects</span>
      </label>
      <p class="field-hint">Play subtle sounds for message received, task complete, and errors.</p>
    </div>
  </Card>

  <Card title="Editor Preferences" padding="md">
    <p class="section-desc">Configure code editing behavior in the chat and builder.</p>
    <div class="field-group">
      <label class="checkbox-field">
        <input
          type="checkbox"
          checked={settings?.preferences?.autoSave ?? true}
          onchange={(e) =>
            savePreferences({
              ...settings?.preferences,
              autoSave: (e.target as HTMLInputElement).checked,
            })}
        />
        <span class="checkbox-label-text">Auto-save sessions</span>
      </label>
      <p class="field-hint">Automatically save chat sessions as you type.</p>
    </div>
    <div class="field-group">
      <label class="checkbox-field">
        <input
          type="checkbox"
          checked={settings?.preferences?.showLineNumbers ?? true}
          onchange={(e) =>
            savePreferences({
              ...settings?.preferences,
              showLineNumbers: (e.target as HTMLInputElement).checked,
            })}
        />
        <span class="checkbox-label-text">Show line numbers in code blocks</span>
      </label>
    </div>
    <div class="field-group">
      <label class="checkbox-field">
        <input
          type="checkbox"
          checked={settings?.preferences?.wordWrap ?? true}
          onchange={(e) =>
            savePreferences({
              ...settings?.preferences,
              wordWrap: (e.target as HTMLInputElement).checked,
            })}
        />
        <span class="checkbox-label-text">Word wrap in code blocks</span>
      </label>
    </div>
  </Card>

  {#if hasWakeWord}
    <Card title="Voice & Wake Word" padding="md">
      <p class="section-desc">
        When enabled, say the wake word to activate Talk Mode. Requires microphone access.
      </p>
      <div class="field-group">
        <label class="checkbox-field">
          <input
            type="checkbox"
            checked={$wakeWordEnabled}
            onchange={(e) => {
              setWakeWordEnabled((e.target as HTMLInputElement).checked);
              if ((e.target as HTMLInputElement).checked) {
                (window as any).grump?.wakeWord?.start?.();
              } else {
                (window as any).grump?.wakeWord?.stop?.();
              }
            }}
          />
          <span>Enable wake word (e.g. "Hey G-Rump")</span>
        </label>
      </div>
    </Card>
  {/if}
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

.preset-option.selected {
    background: var(--color-primary-subtle, rgba(124, 58, 237, 0.1));
    border-color: var(--color-primary, #7c3aed);
    color: var(--color-primary, #7c3aed);
  }

.models-custom-inner .section-desc {
    margin-bottom: 0.75rem;
  }

.section-desc {
    font-size: 14px;
    color: var(--color-text-muted, #71717a);
    margin-bottom: 20px;
  }

.field-group {
    margin-bottom: 20px;
  }

.field-group:last-child {
    margin-bottom: 0;
  }

.field-hint {
    font-size: 12px;
    color: var(--color-text-muted, #a1a1aa);
    margin-top: 6px;
  }

.radio-label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-secondary, #3f3f46);
    margin-bottom: 8px;
  }

.theme-cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
  }

.theme-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 1.25rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-secondary, #4a4a5a);
    background: var(--color-bg-input, #f3f4f6);
    border: 2px solid var(--color-border, #e5e7eb);
    border-radius: 12px;
    cursor: pointer;
    transition:
      background 0.15s,
      border-color 0.15s,
      color 0.15s;
    text-align: center;
  }

.theme-card:hover {
    background: var(--color-bg-card-hover, #f9fafb);
    border-color: var(--color-border-highlight, #d1d5db);
  }

.theme-card.selected {
    background: var(--color-primary-subtle, rgba(124, 58, 237, 0.1));
    border-color: var(--color-primary, #7c3aed);
    color: var(--color-primary, #7c3aed);
  }

.theme-card-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    color: inherit;
  }

.theme-card-label {
    font-weight: 600;
  }

.theme-card-desc {
    font-size: 0.75rem;
    font-weight: 400;
    color: var(--color-text-muted, #6b7280);
  }

.accent-row {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }

.accent-swatch {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--swatch-color, #7c3aed);
    border: 2px solid transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition:
      transform 0.15s,
      box-shadow 0.15s;
  }

.accent-swatch:hover {
    transform: scale(1.08);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

.accent-swatch.selected {
    border-color: var(--color-text, #111827);
    box-shadow:
      0 0 0 2px white,
      0 0 0 4px var(--color-text, #111827);
  }

.radio-row {
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
  }

.radio-option {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: var(--color-text-secondary, #3f3f46);
    cursor: pointer;
  }

.radio-option input {
    cursor: pointer;
  }

.field-hint code {
    font-size: 0.75em;
    padding: 0.1em 0.35em;
    background: var(--color-bg-card, #f4f4f5);
    border-radius: 4px;
  }

.checkbox-field {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    user-select: none;
  }

.checkbox-label-text {
    font-size: 14px;
    color: var(--color-text-secondary, #3f3f46);
  }

.shortcuts-list {
    list-style: none;
    padding: 0;
    margin: 0;
    font-size: 14px;
    color: var(--color-text-secondary, #3f3f46);
  }

.shortcuts-list li {
    padding: 8px 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }

.shortcuts-list kbd {
    padding: 2px 6px;
    font-family: ui-monospace, monospace;
    font-size: 12px;
    background: var(--color-bg-card, #f4f4f5);
    border: 1px solid var(--color-border, #e4e4e7);
    border-radius: 4px;
  }

.accent-row {
    flex-wrap: wrap;
  }
</style>
