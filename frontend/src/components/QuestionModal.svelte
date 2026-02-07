<script lang="ts">
  import {
    isOpen,
    currentClarification,
    answers,
    isValid,
    closeModal,
    toggleOption,
    submitAnswers,
  } from '../stores/clarificationStore';

  function isSelected(questionId: string, optionId: string): boolean {
    const selected = $answers.get(questionId);
    return selected?.includes(optionId) ?? false;
  }
</script>

{#if $isOpen}
  <div class="modal-overlay" onclick={closeModal} role="presentation">
    <div class="modal-container">
      <div class="modal-header">
        <h2 class="modal-title">Help me understand your needs</h2>
        {#if $currentClarification?.context}
          <p class="modal-context">
            {$currentClarification.context}
          </p>
        {/if}
      </div>

      <div class="modal-body">
        {#if $currentClarification}
          {#each $currentClarification.questions as question, qIndex (question.id)}
            <div class="question-section">
              <h3 class="question-text">
                {qIndex + 1}. {question.question}
                {#if question.required !== false}
                  <span class="required-marker">*</span>
                {/if}
              </h3>
              {#if question.selectionType === 'multiple'}
                <p class="selection-hint">Select all that apply</p>
              {/if}

              <div class="options-grid" class:single-column={question.options.length <= 2}>
                {#each question.options as option (option.id)}
                  <button
                    onclick={() => toggleOption(question.id, option.id, question.selectionType)}
                    class="option-card"
                    class:selected={isSelected(question.id, option.id)}
                    class:selection-single={question.selectionType === 'single'}
                    class:selection-multiple={question.selectionType === 'multiple'}
                  >
                    {#if option.icon}
                      <span class="option-icon">{option.icon}</span>
                    {/if}
                    <span class="option-label">{option.label}</span>
                    {#if option.description}
                      <span class="option-desc">{option.description}</span>
                    {/if}
                    <span class="selection-indicator">
                      {#if question.selectionType === 'single'}
                        <span class="radio-dot"></span>
                      {:else}
                        <span class="checkbox-mark">&#10003;</span>
                      {/if}
                    </span>
                  </button>
                {/each}
              </div>
            </div>
          {/each}
        {/if}
      </div>

      <div class="modal-footer">
        <button onclick={closeModal} class="secondary-btn">Cancel</button>
        <button onclick={submitAnswers} disabled={!$isValid} class="primary-btn">
          Generate Diagram
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: var(--color-bg-overlay, rgba(0, 0, 0, 0.6));
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
    animation: modal-fade-in 200ms ease-out;
  }

  .modal-container {
    width: 100%;
    max-width: 560px;
    max-height: 90vh;
    overflow-y: auto;
    background: var(--color-bg-elevated, #ffffff);
    box-shadow:
      0 24px 48px rgba(0, 0, 0, 0.2),
      0 8px 24px rgba(0, 0, 0, 0.1);
    border-radius: 16px;
    border: 1px solid var(--color-border-light, rgba(255, 255, 255, 0.1));
    animation: modal-slide-in 250ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .modal-header {
    padding: 1.5rem 1.5rem 0;
  }

  .modal-title {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-text, #111827);
    margin: 0 0 0.5rem 0;
    text-align: center;
  }

  .modal-context {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.875rem;
    color: var(--color-text-muted, #6b7280);
    margin: 0;
    text-align: center;
  }

  .modal-body {
    padding: 1.5rem;
  }

  .question-section {
    margin-bottom: 1.5rem;
  }

  .question-section:last-child {
    margin-bottom: 0;
  }

  .question-text {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text, #111827);
    margin: 0 0 0.5rem 0;
  }

  .required-marker {
    color: #ef4444;
    margin-left: 0.25rem;
  }

  .selection-hint {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.75rem;
    color: var(--color-text-muted, #6b7280);
    margin: 0 0 0.75rem 0;
  }

  .options-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }

  .options-grid.single-column {
    grid-template-columns: 1fr;
  }

  .option-card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 1rem;
    background: var(--color-bg-subtle, #f5f3ff);
    border: 1px solid var(--color-border-light, transparent);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
    position: relative;
  }

  .option-card:hover {
    background: var(--color-bg-card-hover, #f0ecff);
    border-color: var(--color-border, #e5e7eb);
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm, 0 2px 6px rgba(0, 0, 0, 0.05));
  }

  .option-card.selected {
    background: var(--color-primary);
    color: #ffffff;
  }

  .option-icon {
    font-size: 1.25rem;
    margin-bottom: 0.5rem;
  }

  .option-label {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.875rem;
    font-weight: 600;
    margin-bottom: 0.25rem;
  }

  .option-desc {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.75rem;
    color: var(--color-text-muted, #6b7280);
    line-height: 1.4;
  }

  .option-card.selected .option-desc {
    color: rgba(255, 255, 255, 0.8);
  }

  .selection-indicator {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .option-card.selected .selection-indicator {
    opacity: 1;
  }

  .radio-dot {
    width: 16px;
    height: 16px;
    border: 2px solid currentColor;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .option-card.selected .radio-dot::after {
    content: '';
    display: block;
    width: 8px;
    height: 8px;
    background: currentColor;
    border-radius: 50%;
  }

  .checkbox-mark {
    font-size: 1rem;
    font-weight: bold;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1.5rem;
  }

  .primary-btn {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.875rem;
    font-weight: 600;
    padding: 0.75rem 1.5rem;
    background: var(--color-primary, #7c3aed);
    color: #ffffff;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: var(--shadow-sm);
  }

  .primary-btn:hover:not(:disabled) {
    background: var(--color-primary-hover, #6d28d9);
    transform: translateY(-1px);
    box-shadow: var(--shadow-glow, 0 6px 26px rgba(124, 58, 237, 0.35));
  }

  .primary-btn:disabled {
    background: var(--color-bg-input, #e5e5e5);
    color: var(--color-text-disabled, #9ca3af);
    cursor: not-allowed;
    box-shadow: none;
  }

  .secondary-btn {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.875rem;
    padding: 0.75rem 1.5rem;
    background: var(--color-bg-subtle, #f5f3ff);
    color: var(--color-text, #111827);
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .secondary-btn:hover {
    background: var(--color-bg-card-hover, #f0ecff);
    border-color: var(--color-primary, #7c3aed);
    color: var(--color-primary, #7c3aed);
  }

  @keyframes modal-fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes modal-slide-in {
    from {
      transform: scale(0.95) translateY(10px);
    }
    to {
      transform: scale(1) translateY(0);
    }
  }
</style>
