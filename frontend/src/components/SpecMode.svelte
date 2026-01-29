<script lang="ts">
  import type { SpecSession, SpecQuestion } from '../types/spec';
  import { 
    currentSession, 
    isSpecLoading, 
    specError, 
    submitAnswer, 
    generateSpecification,
    getNextQuestion 
  } from '../stores/specStore';

  let session = $derived($currentSession);
  let loading = $derived($isSpecLoading);
  let error = $derived($specError);
  let nextQuestion = $derived(getNextQuestion());

  let answerValues = $state<Record<string, any>>({});

  function handleAnswer(questionId: string, value: any) {
    answerValues[questionId] = value;
  }

  async function submitAnswerForQuestion(questionId: string) {
    if (!session || !answerValues[questionId]) return;

    try {
      await submitAnswer(session.id, {
        questionId,
        value: answerValues[questionId],
      });
      answerValues[questionId] = undefined;
    } catch (error) {
      console.error('Failed to submit answer:', error);
    }
  }

  async function handleGenerate() {
    if (!session) return;

    try {
      await generateSpecification(session.id);
    } catch (error) {
      console.error('Failed to generate specification:', error);
    }
  }

  function getAnswerValue(questionId: string): any {
    return session?.answers[questionId]?.value ?? answerValues[questionId];
  }

  function isAnswered(questionId: string): boolean {
    return session?.answers[questionId] !== undefined;
  }
</script>

<div class="spec-mode">
  {#if loading}
    <div class="loading">Loading...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else if session}
    <div class="spec-session">
      <div class="session-header">
        <h2>Specification Gathering</h2>
        <p class="session-description">{session.originalRequest}</p>
        <div class="progress">
          {session.questions.filter(q => isAnswered(q.id)).length} / {session.questions.length} questions answered
        </div>
      </div>

      <div class="questions">
        {#each session.questions as question (question.id)}
          <div class="question-card" class:answered={isAnswered(question.id)}>
            <div class="question-header">
              <span class="question-number">{question.order}</span>
              <h3 class="question-text">{question.question}</h3>
              {#if question.required}
                <span class="required-badge">Required</span>
              {/if}
            </div>

            {#if question.helpText}
              <p class="help-text">{question.helpText}</p>
            {/if}

            {#if isAnswered(question.id)}
              <div class="answer-display">
                <strong>Your answer:</strong> {JSON.stringify(getAnswerValue(question.id))}
              </div>
            {:else}
              <div class="answer-input">
                {#if question.type === 'text'}
                  <textarea
                    placeholder={question.placeholder}
                    value={answerValues[question.id] || ''}
                    oninput={(e) => handleAnswer(question.id, (e.target as HTMLTextAreaElement).value)}
                  ></textarea>
                {:else if question.type === 'choice'}
                  <select
                    value={answerValues[question.id] || ''}
                    onchange={(e) => handleAnswer(question.id, (e.target as HTMLSelectElement).value)}
                  >
                    <option value="">Select an option</option>
                    {#each question.options || [] as option}
                      <option value={option}>{option}</option>
                    {/each}
                  </select>
                {:else if question.type === 'multi-choice'}
                  <div class="checkbox-group">
                    {#each question.options || [] as option}
                      <label>
                        <input
                          type="checkbox"
                          checked={answerValues[question.id]?.includes(option) || false}
                          onchange={(e) => {
                            const current = answerValues[question.id] || [];
                            if ((e.target as HTMLInputElement).checked) {
                              handleAnswer(question.id, [...current, option]);
                            } else {
                              handleAnswer(question.id, current.filter((v: string) => v !== option));
                            }
                          }}
                        />
                        {option}
                      </label>
                    {/each}
                  </div>
                {:else if question.type === 'number'}
                  <input
                    type="number"
                    placeholder={question.placeholder}
                    value={answerValues[question.id] || ''}
                    oninput={(e) => handleAnswer(question.id, Number((e.target as HTMLInputElement).value))}
                  />
                {:else if question.type === 'boolean'}
                  <div class="boolean-group">
                    <label>
                      <input
                        type="radio"
                        name={question.id}
                        value="true"
                        checked={answerValues[question.id] === true}
                        onchange={() => handleAnswer(question.id, true)}
                      />
                      Yes
                    </label>
                    <label>
                      <input
                        type="radio"
                        name={question.id}
                        value="false"
                        checked={answerValues[question.id] === false}
                        onchange={() => handleAnswer(question.id, false)}
                      />
                      No
                    </label>
                  </div>
                {/if}

                <button
                  class="btn btn-primary"
                  disabled={!answerValues[question.id]}
                  onclick={() => submitAnswerForQuestion(question.id)}
                >
                  Submit Answer
                </button>
              </div>
            {/if}
          </div>
        {/each}
      </div>

      {#if nextQuestion === null && session.status === 'collecting'}
        <div class="generate-section">
          <button class="btn btn-primary btn-large" onclick={handleGenerate}>
            Generate Specification
          </button>
        </div>
      {/if}

      {#if session.specification}
        <div class="specification-display">
          <h3>Generated Specification</h3>
          <div class="spec-content">
            <h4>{session.specification.title}</h4>
            <p>{session.specification.description}</p>
            <!-- Add more spec details as needed -->
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .spec-mode {
    max-width: 800px;
    margin: 0 auto;
    padding: 1.5rem;
  }

  .loading, .error {
    padding: 2rem;
    text-align: center;
  }

  .error {
    color: #DC2626;
  }

  .session-header {
    margin-bottom: 2rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #E5E5E5;
  }

  .session-header h2 {
    margin: 0 0 0.5rem 0;
    font-size: 1.5rem;
  }

  .session-description {
    color: #6B7280;
    margin: 0 0 1rem 0;
  }

  .progress {
    font-size: 0.875rem;
    color: #6B7280;
  }

  .questions {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .question-card {
    border: 1px solid #E5E5E5;
    border-radius: 8px;
    padding: 1.5rem;
    background: #FFFFFF;
  }

  .question-card.answered {
    background: #F9FAFB;
    border-color: #10B981;
  }

  .question-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.75rem;
  }

  .question-number {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: #0EA5E9;
    color: #FFFFFF;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    flex-shrink: 0;
  }

  .question-text {
    flex: 1;
    margin: 0;
    font-size: 1.125rem;
  }

  .required-badge {
    padding: 0.25rem 0.5rem;
    background: #FEE2E2;
    color: #991B1B;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .help-text {
    color: #6B7280;
    font-size: 0.875rem;
    margin: 0 0 1rem 0;
  }

  .answer-input {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  textarea, input[type="text"], input[type="number"], select {
    padding: 0.75rem;
    border: 1px solid #E5E5E5;
    border-radius: 4px;
    font-family: inherit;
    width: 100%;
  }

  textarea {
    min-height: 100px;
    resize: vertical;
  }

  .checkbox-group, .boolean-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .answer-display {
    padding: 0.75rem;
    background: #D1FAE5;
    border-radius: 4px;
    color: #065F46;
  }

  .btn {
    padding: 0.5rem 1rem;
    border-radius: 4px;
    border: none;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary {
    background: #0EA5E9;
    color: #FFFFFF;
  }

  .btn-primary:hover:not(:disabled) {
    background: #0052CC;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-large {
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
  }

  .generate-section {
    margin-top: 2rem;
    text-align: center;
  }

  .specification-display {
    margin-top: 2rem;
    padding: 1.5rem;
    background: #F9FAFB;
    border-radius: 8px;
    border: 1px solid #E5E5E5;
  }

  .spec-content h4 {
    margin: 0 0 0.5rem 0;
  }
</style>
