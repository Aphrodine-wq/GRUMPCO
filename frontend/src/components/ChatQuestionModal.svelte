<script lang="ts">
  /**
   * ChatQuestionModal – Inline chat card for AI-generated questions.
   * Supports both ABCD multiple-choice and free-text answers.
   * Matches the style of ArchitectureApprovalModal and SectionPickerModal:
   * compact, inline, non-disruptive card in the chat flow.
   */
  import { fly } from 'svelte/transition';
  import { HelpCircle, X, Send, SkipForward } from 'lucide-svelte';

  interface ParsedQuestion {
    number: number;
    text: string;
    examples?: string;
    options?: string[];
  }

  interface Props {
    open?: boolean;
    questions?: ParsedQuestion[];
    contextIntro?: string;
    contextOutro?: string;
    onSubmit?: (composedAnswer: string) => void;
    onClose?: () => void;
  }

  let {
    open = $bindable(false),
    questions = [],
    contextIntro = '',
    contextOutro = '',
    onSubmit,
    onClose,
  }: Props = $props();

  // For ABCD questions: store the selected option index (-1 = none)
  let selectedOptions = $state<number[]>([]);
  // For free-text fallback
  let freeTextAnswers = $state<string[]>([]);

  const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  $effect(() => {
    if (questions.length > 0) {
      selectedOptions = questions.map(() => -1);
      freeTextAnswers = questions.map(() => '');
    }
  });

  const isValid = $derived(
    questions.some((q, i) =>
      q.options && q.options.length > 0
        ? selectedOptions[i] >= 0
        : freeTextAnswers[i]?.trim().length > 0
    )
  );

  function handleOptionClick(qIndex: number, optIndex: number) {
    selectedOptions[qIndex] = selectedOptions[qIndex] === optIndex ? -1 : optIndex;
  }

  function handleSubmit() {
    if (!isValid) return;
    const parts: string[] = [];
    questions.forEach((q, i) => {
      if (q.options && q.options.length > 0) {
        const sel = selectedOptions[i];
        if (sel >= 0 && q.options[sel]) {
          parts.push(`${q.number}. ${q.options[sel]}`);
        }
      } else {
        const answer = freeTextAnswers[i]?.trim();
        if (answer) {
          parts.push(`${q.number}. ${answer}`);
        }
      }
    });
    const composed = parts.join('\n');
    open = false;
    onSubmit?.(composed);
  }

  function handleClose() {
    open = false;
    onClose?.();
  }
</script>

{#if open}
  <div
    class="cqm-card"
    role="region"
    aria-label="Quick questions"
    transition:fly={{ y: 8, duration: 160 }}
  >
    <!-- Header -->
    <div class="card-header">
      <div class="card-icon">
        <HelpCircle size={14} />
      </div>
      <div class="card-title-group">
        <p class="card-title">Help me understand your project</p>
        {#if contextIntro}
          <p class="card-subtitle">{contextIntro}</p>
        {:else}
          <p class="card-subtitle">Answer these questions so I can build exactly what you need</p>
        {/if}
      </div>
      <button class="close-btn" onclick={handleClose} aria-label="Dismiss">
        <X size={14} />
      </button>
    </div>

    <!-- Body -->
    <div class="cqm-body">
      {#each questions as question, qIndex (question.number)}
        <div class="cqm-question-group">
          <div class="cqm-question-label">
            <span class="cqm-q-number">{question.number}.</span>
            <span class="cqm-q-text">{question.text}</span>
          </div>

          {#if question.options && question.options.length > 0}
            <!-- ABCD Multiple Choice -->
            <div
              class="cqm-options"
              role="radiogroup"
              aria-label="Options for question {question.number}"
            >
              {#each question.options as option, optIndex}
                <button
                  class="cqm-option-btn"
                  class:selected={selectedOptions[qIndex] === optIndex}
                  onclick={() => handleOptionClick(qIndex, optIndex)}
                  role="radio"
                  aria-checked={selectedOptions[qIndex] === optIndex}
                >
                  <span class="option-letter"
                    >{OPTION_LETTERS[optIndex] || String.fromCharCode(65 + optIndex)}</span
                  >
                  <span class="option-text">{option}</span>
                </button>
              {/each}
            </div>
          {:else}
            <!-- Free-text fallback -->
            {#if question.examples}
              <p class="cqm-hint">{question.examples}</p>
            {/if}
            <textarea
              id="cqm-answer-{qIndex}"
              class="cqm-input"
              placeholder="Describe in detail..."
              rows={3}
              bind:value={freeTextAnswers[qIndex]}
              onkeydown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  handleSubmit();
                }
              }}
            ></textarea>
          {/if}
        </div>
      {/each}
    </div>

    {#if contextOutro}
      <p class="cqm-outro">{contextOutro}</p>
    {/if}

    <!-- Footer -->
    <div class="cqm-footer">
      <button class="btn btn-skip" onclick={handleClose}>
        <SkipForward size={14} />
        Skip
      </button>
      <button class="btn btn-submit" onclick={handleSubmit} disabled={!isValid}>
        <Send size={14} />
        Submit
      </button>
    </div>
  </div>
{/if}

<style>
  /* ── Inline chat card matching ArchitectureApprovalModal / SectionPickerModal ── */
  .cqm-card {
    margin: 0.25rem 0;
    padding: 0;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-left: 3px solid var(--color-primary, #7c3aed);
    border-radius: 0 0.5rem 0.5rem 0;
    width: 100%;
    overflow: hidden;
    contain: layout style paint;
    content-visibility: auto;
  }

  /* ── Header ── */
  .card-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid #f3f4f6;
  }

  .card-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.375rem;
    height: 1.375rem;
    border-radius: 0.25rem;
    background: rgba(124, 58, 237, 0.08);
    color: var(--color-primary, #7c3aed);
    flex-shrink: 0;
  }

  .card-title-group {
    flex: 1;
    min-width: 0;
  }

  .card-title {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.85rem;
    font-weight: 600;
    color: #374151;
    margin: 0;
  }

  .card-subtitle {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.7rem;
    color: #9ca3af;
    line-height: 1.4;
    margin: 0.125rem 0 0;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    background: none;
    border: 1px solid #e5e7eb;
    border-radius: 0.25rem;
    color: #9ca3af;
    cursor: pointer;
    padding: 0;
    transition: all 0.12s ease;
    flex-shrink: 0;
  }
  .close-btn:hover {
    border-color: #d1d5db;
    background: #f9fafb;
    color: #374151;
  }

  /* ── Body ── */
  .cqm-body {
    padding: 0.5rem 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .cqm-question-group {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .cqm-question-label {
    display: flex;
    gap: 0.375rem;
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.85rem;
    font-weight: 500;
    color: #374151;
    line-height: 1.5;
  }

  .cqm-q-number {
    color: var(--color-primary, #7c3aed);
    font-weight: 700;
    min-width: 1.125rem;
    flex-shrink: 0;
  }

  .cqm-q-text {
    flex: 1;
  }

  /* ── ABCD Options ── */
  .cqm-options {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    margin-left: 1.5rem;
  }

  .cqm-option-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.45rem 0.65rem;
    background: #fafafa;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.12s ease;
    text-align: left;
    width: 100%;
  }

  .cqm-option-btn:hover {
    border-color: rgba(124, 58, 237, 0.35);
    background: rgba(124, 58, 237, 0.06);
  }

  .cqm-option-btn.selected {
    border-color: rgba(124, 58, 237, 0.6);
    background: rgba(124, 58, 237, 0.12);
    box-shadow: 0 0 0 1px rgba(124, 58, 237, 0.15);
  }

  .option-letter {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.375rem;
    height: 1.375rem;
    border-radius: 0.3rem;
    background: rgba(124, 58, 237, 0.1);
    color: var(--color-primary, #7c3aed);
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.7rem;
    font-weight: 700;
    flex-shrink: 0;
    transition: all 0.12s ease;
  }

  .cqm-option-btn.selected .option-letter {
    background: var(--color-primary, #7c3aed);
    color: #fff;
  }

  .option-text {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.8rem;
    color: #374151;
    line-height: 1.5;
  }

  .cqm-option-btn.selected .option-text {
    color: #7c3aed;
  }

  /* ── Free-text fallback ── */
  .cqm-hint {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.6875rem;
    color: var(--color-text-muted, #64748b);
    margin: 0 0 0.125rem 1.5rem;
    line-height: 1.4;
    font-style: italic;
  }

  .cqm-input {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.8rem;
    color: #374151;
    background: #fafafa;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    padding: 0.45rem 0.65rem;
    resize: vertical;
    min-height: 2.5rem;
    max-height: 100px;
    outline: none;
    margin-left: 1.5rem;
    line-height: 1.5;
  }

  .cqm-input::placeholder {
    color: var(--color-text-muted, #64748b);
  }

  .cqm-input:focus {
    border-color: rgba(124, 58, 237, 0.4);
    box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.08);
  }

  /* ── Outro ── */
  .cqm-outro {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.6875rem;
    color: var(--color-text-muted, #64748b);
    margin: 0;
    padding: 0 0.875rem 0.375rem;
    line-height: 1.4;
  }

  /* ── Footer ── */
  .cqm-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem 0.5rem;
    border-top: 1px solid #f3f4f6;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.35rem 0.65rem;
    border: 1px solid transparent;
    border-radius: 0.5rem;
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.72rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.12s;
  }

  .btn-submit {
    background: color-mix(in srgb, var(--color-primary, #7c3aed) 20%, transparent);
    color: var(--color-primary, #60a5fa);
    border-color: color-mix(in srgb, var(--color-primary, #7c3aed) 28%, transparent);
  }
  .btn-submit:hover:not(:disabled) {
    background: color-mix(in srgb, var(--color-primary, #7c3aed) 28%, transparent);
  }
  .btn-submit:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .btn-skip {
    background: transparent;
    color: var(--color-text-secondary, #94a3b8);
    border-color: var(--color-border-light, rgba(148, 163, 184, 0.25));
  }
  .btn-skip:hover {
    background: color-mix(in srgb, var(--color-bg-card, #0f172a) 88%, transparent);
    color: var(--color-text, #e2e8f0);
  }

  @media (prefers-reduced-motion: reduce) {
    .cqm-card {
      transition: none;
    }
  }
</style>
