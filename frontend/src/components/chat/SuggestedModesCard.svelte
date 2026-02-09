<script lang="ts">
  /**
   * SuggestedModesCard - AI-offers-modes UI
   * Displays suggested next actions (Chat, Design mode, Design to Code, Agent) after assistant responds.
   * Visually stunning card layout with icons and subtle animations.
   */
  import { fade, fly } from 'svelte/transition';
  import { MessageCircle, LayoutGrid, Bot, Users, Palette } from 'lucide-svelte';

  export type SuggestedModeView = 'chat' | 'designMode' | 'designToCode' | 'gAgent' | 'swarm';

  interface SuggestedMode {
    id: string;
    label: string;
    icon: typeof MessageCircle;
    view: SuggestedModeView;
  }

  interface Props {
    onSelectMode: (view: SuggestedModeView) => void;
  }

  let { onSelectMode }: Props = $props();

  const SUGGESTED_MODES: SuggestedMode[] = [
    { id: 'chat', label: 'Continue Chat', icon: MessageCircle, view: 'chat' },
    { id: 'designMode', label: 'Design mode', icon: Palette, view: 'designMode' },
    { id: 'design', label: 'Design to Code', icon: LayoutGrid, view: 'designToCode' },
    { id: 'gagent', label: 'Agent', icon: Bot, view: 'gAgent' },
    { id: 'swarm', label: 'Agent Swarm', icon: Users, view: 'swarm' },
  ];
</script>

<div class="suggested-modes-card" role="group" aria-label="Suggested next steps">
  <p class="suggested-modes-title">What would you like to do next?</p>
  <div class="suggested-modes-grid">
    {#each SUGGESTED_MODES as mode, i}
      {@const Icon = mode.icon}
      <button
        type="button"
        class="suggested-mode-chip"
        onclick={() => onSelectMode(mode.view)}
        in:fly={{ y: 12, duration: 300, delay: i * 60 }}
        out:fade={{ duration: 150 }}
      >
        <span class="chip-icon">
          <Icon size={20} strokeWidth={2} />
        </span>
        <span class="chip-label">{mode.label}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .suggested-modes-card {
    margin: 1rem 0;
    padding: 1.25rem;
    background: linear-gradient(
      135deg,
      var(--color-primary-subtle, rgba(124, 58, 237, 0.08)) 0%,
      var(--color-bg-subtle, #f5f3ff) 100%
    );
    border: 1px solid var(--color-border, #e9d5ff);
    border-radius: 16px;
    box-shadow: var(--shadow-sm, 0 2px 6px rgba(0, 0, 0, 0.05));
    max-width: 480px;
    width: 100%;
  }

  :global([data-theme='dark']) .suggested-modes-card {
    background: linear-gradient(135deg, rgba(167, 139, 250, 0.12) 0%, var(--color-bg-subtle) 100%);
    border-color: var(--color-border);
  }

  .suggested-modes-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text-muted, #6b7280);
    margin: 0 0 0.875rem;
    letter-spacing: 0.01em;
  }

  .suggested-modes-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .suggested-mode-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    background: var(--color-bg-card, #ffffff);
    border: 1px solid var(--color-border, #e9d5ff);
    border-radius: 12px;
    color: var(--color-text, #1f1147);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 50ms ease-out;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  }

  .suggested-mode-chip:hover {
    background: var(--color-primary-subtle, rgba(124, 58, 237, 0.1));
    border-color: var(--color-primary, #7c3aed);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(124, 58, 237, 0.15);
  }

  .suggested-mode-chip:focus-visible {
    outline: 2px solid var(--color-primary, #7c3aed);
    outline-offset: 2px;
  }

  .chip-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-primary, #7c3aed);
  }

  .chip-label {
    white-space: nowrap;
  }
</style>
