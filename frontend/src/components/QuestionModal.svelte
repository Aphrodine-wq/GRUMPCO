<script lang="ts">
  import {
    isOpen,
    currentClarification,
    answers,
    isValid,
    closeModal,
    toggleOption,
    submitAnswers
  } from '../stores/clarificationStore';

  function isSelected(questionId: string, optionId: string): boolean {
    const selected = $answers.get(questionId);
    return selected?.includes(optionId) ?? false;
  }
</script>

{#if $isOpen && document.body}
  <svelte:body>
    <div class="modal-overlay" on:click|self={closeModal}>
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
                  <p class="selection-hint">
                    Select all that apply
                  </p>
                {/if}

                <div class="options-grid" class:single-column={question.options.length <= 2}>
                  {#each question.options as option (option.id)}
                    <button
                      on:click={() => toggleOption(question.id, option.id, question.selectionType)}
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
          <button on:click={closeModal} class="secondary-btn">Cancel</button>
          <button
            on:click={submitAnswers}
            disabled={!$isValid}
            class="primary-btn"
          >
            Generate Diagram
          </button>
        </div>
      </div>
    </div>
  </svelte:body>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
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
    background: #FFFFFF;
    border: 1px solid #000000;
    box-shadow: 8px 8px 0 #000000;
    animation: modal-slide-in 200ms ease-out;
  }

  .modal-header {
    padding: 1.5rem 1.5rem 0;
  }

  .modal-title {
    font-family: 'JetBrains Mono', monospace;
    font-size: 1.25rem;
    font-weight: 600;
    color: #000000;
    margin: 0 0 0.5rem 0;
    text-align: center;
  }

  .modal-context {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    color: #6B7280;
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
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    font-weight: 600;
    color: #000000;
    margin: 0 0 0.5rem 0;
  }

  .required-marker {
    color: #EF4444;
    margin-left: 0.25rem;
  }

  .selection-hint {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    color: #6B7280;
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
    background: #FFFFFF;
    border: 1px solid #E5E5E5;
    cursor: pointer;
    transition: all 0.15s;
    text-align: left;
    position: relative;
  }

  .option-card:hover {
    border-color: #0066FF;
  }

  .option-card.selected {
    border-color: #0066FF;
    background: #0066FF;
    color: #FFFFFF;
  }

  .option-icon {
    font-size: 1.25rem;
    margin-bottom: 0.5rem;
  }

  .option-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    font-weight: 600;
    margin-bottom: 0.25rem;
  }

  .option-desc {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    color: #6B7280;
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
    border-top: 1px solid #E5E5E5;
  }

  .primary-btn {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    font-weight: 600;
    padding: 0.75rem 1.5rem;
    background: #0066FF;
    color: #FFFFFF;
    border: 1px solid #0066FF;
    cursor: pointer;
    transition: all 0.15s;
  }

  .primary-btn:hover:not(:disabled) {
    background: #0052CC;
    border-color: #0052CC;
  }

  .primary-btn:disabled {
    background: #E5E5E5;
    border-color: #E5E5E5;
    color: #9CA3AF;
    cursor: not-allowed;
  }

  .secondary-btn {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    padding: 0.75rem 1.5rem;
    background: transparent;
    color: #000000;
    border: 1px solid #000000;
    cursor: pointer;
    transition: all 0.15s;
  }

  .secondary-btn:hover {
    background: #000000;
    color: #FFFFFF;
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
