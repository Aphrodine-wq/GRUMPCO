<script lang="ts">
  import type { Plan, PlanStep } from '../types/plan';
  import { editPlan } from '../stores/planStore';

  interface Props {
    plan: Plan;
  }

  let { plan = $bindable() }: Props = $props();

  let editingStep: PlanStep | null = $state(null);

  function startEdit(step: PlanStep) {
    editingStep = { ...step };
  }

  function cancelEdit() {
    editingStep = null;
  }

  async function saveEdit() {
    if (!editingStep) return;

    try {
      await editPlan(plan.id, {
        steps: [
          {
            id: editingStep.id,
            title: editingStep.title,
            description: editingStep.description,
            estimatedTime: editingStep.estimatedTime,
            risk: editingStep.risk,
          },
        ],
      });
      editingStep = null;
    } catch (error) {
      console.error('Failed to edit plan:', error);
    }
  }
</script>

<div class="plan-editor">
  <h3>Edit Plan</h3>

  {#if editingStep}
    <div class="edit-form">
      <label>
        Title:
        <input type="text" bind:value={editingStep.title} />
      </label>
      <label>
        Description:
        <textarea bind:value={editingStep.description}></textarea>
      </label>
      <label>
        Estimated Time (minutes):
        <input type="number" bind:value={editingStep.estimatedTime} min="1" />
      </label>
      <label>
        Risk:
        <select bind:value={editingStep.risk}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </label>
      <div class="form-actions">
        <button class="btn btn-primary" onclick={saveEdit}>Save</button>
        <button class="btn btn-secondary" onclick={cancelEdit}>Cancel</button>
      </div>
    </div>
  {:else}
    <ul class="step-list">
      {#each plan.steps as step}
        <li>
          <button type="button" class="step-btn" onclick={() => startEdit(step)}>
            {step.title}
          </button>
        </li>
      {/each}
    </ul>
    {#if plan.steps.length === 0}
      <p>No steps to edit</p>
    {/if}
  {/if}
</div>

<style>
  .plan-editor {
    padding: 1rem;
    background: #ffffff;
    border-radius: 8px;
  }

  .edit-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
  }

  input,
  textarea,
  select {
    padding: 0.5rem;
    border: 1px solid #e5e5e5;
    border-radius: 4px;
    font-family: inherit;
  }

  textarea {
    min-height: 100px;
    resize: vertical;
  }

  .form-actions {
    display: flex;
    gap: 0.75rem;
  }

  .btn {
    padding: 0.5rem 1rem;
    border-radius: 4px;
    border: none;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    cursor: pointer;
  }

  .btn-primary {
    background: var(--color-primary);
    color: #ffffff;
  }

  .btn-secondary {
    background: #f5f5f5;
    color: #000000;
  }

  .step-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .step-btn {
    display: block;
    width: 100%;
    padding: 0.5rem;
    text-align: left;
    border: 1px solid #e5e5e5;
    border-radius: 4px;
    background: #fafafa;
    cursor: pointer;
    font-family: inherit;
  }

  .step-btn:hover {
    background: #f0f0f0;
  }
</style>
