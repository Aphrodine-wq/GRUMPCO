<script lang="ts">
  /**
   * Unified Talk screen: user chooses between Live talking chat (Talk Mode) or Voice code every time they enter.
   */
  import { MessageCircle, Mic, ArrowLeft } from 'lucide-svelte';
  import { Button } from '../lib/design-system';
  import { setCurrentView } from '../stores/uiStore';
  import TalkModeScreen from './TalkModeScreen.svelte';
  import VoiceCodeScreen from './VoiceCodeScreen.svelte';

  interface Props {
    onBack?: () => void;
  }

  let { onBack }: Props = $props();

  type SubMode = 'choice' | 'talk' | 'voice';
  let subMode = $state<SubMode>('choice');

  function handleBack() {
    if (subMode !== 'choice') {
      subMode = 'choice';
    } else {
      onBack?.() ?? setCurrentView('chat');
    }
  }
</script>

<div class="talk-screen">
  <header class="talk-screen-header">
    <Button variant="ghost" size="sm" onclick={handleBack} title="Back">
      <ArrowLeft size={16} />
      Back
    </Button>
    {#if subMode === 'choice'}
      <div class="header-text">
        <h1>Talk</h1>
        <p class="subtitle">Choose how you want to use voice with the AI</p>
      </div>
    {:else}
      <div class="header-text">
        <h1>{subMode === 'talk' ? 'Live talking chat' : 'Voice code'}</h1>
        <p class="subtitle">
          {subMode === 'talk'
            ? 'Have a conversation with the AI using your voice'
            : 'Speak to generate and refine code'}
        </p>
      </div>
      <Button variant="ghost" size="sm" onclick={() => (subMode = 'choice')} title="Change mode">
        Change mode
      </Button>
    {/if}
  </header>

  {#if subMode === 'choice'}
    <div class="mode-choice">
      <button type="button" class="mode-card" onclick={() => (subMode = 'talk')}>
        <span class="mode-icon" aria-hidden="true">
          <MessageCircle size={32} strokeWidth={2} />
        </span>
        <h2 class="mode-title">Live talking chat</h2>
        <p class="mode-desc">
          Have a conversation with the AI using your voice. Speak and get spoken or text responses.
        </p>
      </button>
      <button type="button" class="mode-card" onclick={() => (subMode = 'voice')}>
        <span class="mode-icon" aria-hidden="true">
          <Mic size={32} strokeWidth={2} />
        </span>
        <h2 class="mode-title">Voice code</h2>
        <p class="mode-desc">
          Speak to generate and refine code. Get transcripts, answers, and code from your voice
          input.
        </p>
      </button>
    </div>
  {:else if subMode === 'talk'}
    <div class="sub-screen">
      <TalkModeScreen onBack={() => (subMode = 'choice')} />
    </div>
  {:else}
    <div class="sub-screen">
      <VoiceCodeScreen onBack={() => (subMode = 'choice')} />
    </div>
  {/if}
</div>

<style>
  .talk-screen {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--color-bg-app, #ffffff);
  }

  .talk-screen-header {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--color-border, #e5e7eb);
    flex-shrink: 0;
  }

  .header-text {
    flex: 1;
    min-width: 0;
  }

  .header-text h1 {
    font-size: 1.25rem;
    font-weight: 700;
    margin: 0 0 0.25rem;
    color: var(--color-text, #1f1147);
  }

  .subtitle {
    font-size: 0.875rem;
    color: var(--color-text-muted, #6b7280);
    margin: 0;
  }

  .mode-choice {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.5rem;
    padding: 2rem 1.5rem;
    align-content: start;
    max-width: 720px;
  }

  .mode-card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 1.5rem;
    text-align: left;
    background: var(--color-bg-card, #fff);
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 12px;
    cursor: pointer;
    transition:
      border-color 0.2s,
      box-shadow 0.2s,
      background 0.2s;
  }

  .mode-card:hover {
    border-color: var(--color-primary, #7c3aed);
    box-shadow: 0 4px 12px rgba(124, 58, 237, 0.12);
    background: var(--color-bg-card-hover, #faf5ff);
  }

  .mode-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background: var(--color-primary-subtle, rgba(124, 58, 237, 0.1));
    color: var(--color-primary, #7c3aed);
    border-radius: 12px;
  }

  .mode-title {
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
    color: var(--color-text, #1f1147);
  }

  .mode-desc {
    font-size: 0.875rem;
    color: var(--color-text-muted, #6b7280);
    margin: 0;
    line-height: 1.5;
  }

  .sub-screen {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }

  .sub-screen :global(> *) {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
</style>
