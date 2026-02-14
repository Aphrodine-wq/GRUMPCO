<script lang="ts">
  /**
   * KBSkillsTab – Skills list, toggles, and custom skill creation for KnowledgeBase.
   */
  import { BookOpen } from 'lucide-svelte';
  import type { SkillSummary } from '../../lib/api';

  interface Props {
    skills: SkillSummary[];
    skillsLoading: boolean;
    skillsError: string | null;
    enabledIds: Set<string>;
    skillsSaving: boolean;
    expandedSkillId: string | null;
    expandedSkillDetail: { tools?: string[] } | null;
    showAddCustom: boolean;
    customDescription: string;
    generatingMd: boolean;
    generatedMd: string;
    showCreateInHouse: boolean;
    createName: string;
    createDescription: string;
    creating: boolean;
    createError: string | null;
    onLoadSkills: () => void;
    onToggleSkill: (id: string) => void;
    onToggleExpand: (id: string) => void;
    onGenerateCustomSkill: () => void;
    onCopyGeneratedMd: () => void;
    onCloseAddCustom: () => void;
    onHandleCreateInHouse: () => void;
    onCloseCreateInHouse: () => void;
    onSetShowAddCustom: (val: boolean) => void;
    onSetShowCreateInHouse: (val: boolean) => void;
    onSetCustomDescription: (val: string) => void;
    onSetCreateName: (val: string) => void;
    onSetCreateDescription: (val: string) => void;
  }

  let {
    skills,
    skillsLoading,
    skillsError,
    enabledIds,
    skillsSaving,
    expandedSkillId,
    expandedSkillDetail,
    showAddCustom,
    customDescription,
    generatingMd,
    generatedMd,
    showCreateInHouse,
    createName,
    createDescription,
    creating,
    createError,
    onLoadSkills,
    onToggleSkill,
    onToggleExpand,
    onGenerateCustomSkill,
    onCopyGeneratedMd,
    onCloseAddCustom,
    onHandleCreateInHouse,
    onCloseCreateInHouse,
    onSetShowAddCustom,
    onSetShowCreateInHouse,
    onSetCustomDescription,
    onSetCreateName,
    onSetCreateDescription,
  }: Props = $props();
</script>

{#if skillsLoading}
  <div class="loading-state">
    <div class="spinner"></div>
    <p>Loading skills...</p>
  </div>
{:else if skillsError}
  <div class="empty-state">
    <BookOpen size={40} />
    <h3>Could not load skills</h3>
    <p>{skillsError}</p>
    <button class="action-btn primary" onclick={onLoadSkills}>Retry</button>
  </div>
{:else}
  <div class="skills-content">
    <section class="skills-section">
      <h2>Built-in Skills</h2>
      <p class="section-desc">
        These skills extend your AI's capabilities. Toggle to enable or disable.
      </p>
      <div class="skills-list">
        {#each skills as skill (skill.id)}
          <div class="skill-card" class:enabled={enabledIds.has(skill.id)}>
            <div class="skill-header">
              <button
                type="button"
                class="skill-toggle"
                role="switch"
                aria-checked={enabledIds.has(skill.id)}
                onclick={() => onToggleSkill(skill.id)}
                disabled={skillsSaving}
                title={enabledIds.has(skill.id) ? 'Disable' : 'Enable'}
              >
                <span class="toggle-track"><span class="toggle-thumb"></span></span>
              </button>
              <div class="skill-info">
                <h3 class="skill-name">{skill.name}</h3>
                {#if skill.description}
                  <p class="skill-desc">{skill.description}</p>
                {/if}
                {#if skill.category}
                  <span class="skill-category">{skill.category}</span>
                {/if}
              </div>
              <button
                type="button"
                class="expand-btn"
                onclick={() => onToggleExpand(skill.id)}
                aria-expanded={expandedSkillId === skill.id}
              >
                {expandedSkillId === skill.id ? '−' : '+'}
              </button>
            </div>
            {#if expandedSkillId === skill.id}
              <div class="skill-details">
                {#if expandedSkillDetail === null}
                  <p class="detail-row">Loading...</p>
                {:else}
                  {#if skill.version}
                    <p class="detail-row"><strong>Version:</strong> {skill.version}</p>
                  {/if}
                  {#if skill.tags && skill.tags.length > 0}
                    <p class="detail-row"><strong>Tags:</strong> {skill.tags.join(', ')}</p>
                  {/if}
                  {#if skill.capabilities && skill.capabilities.length > 0}
                    <p class="detail-row">
                      <strong>Capabilities:</strong>
                      {skill.capabilities.join(', ')}
                    </p>
                  {/if}
                  {#if expandedSkillDetail?.tools && expandedSkillDetail.tools.length > 0}
                    <p class="detail-row">
                      <strong>Tools:</strong>
                      {expandedSkillDetail.tools.join(', ')}
                    </p>
                  {/if}
                {/if}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </section>

    <section class="skills-section">
      <h2>Add Custom Skill</h2>
      <p class="section-desc">Generate a SKILL.md template from a description.</p>
      {#if !showAddCustom}
        <button class="action-btn secondary" onclick={() => onSetShowAddCustom(true)}
          >Add custom skill</button
        >
      {:else}
        <div class="add-custom-form">
          <label for="skill-desc">Describe the skill</label>
          <textarea
            id="skill-desc"
            value={customDescription}
            oninput={(e) => onSetCustomDescription(e.currentTarget.value)}
            placeholder="Describe what the skill should do..."
            rows="3"
            disabled={generatingMd}
          ></textarea>
          <div class="add-custom-actions">
            <button
              class="action-btn primary"
              onclick={onGenerateCustomSkill}
              disabled={generatingMd || !customDescription.trim()}
            >
              {generatingMd ? 'Generating...' : 'Generate SKILL.md'}
            </button>
            <button class="action-btn secondary" onclick={onCloseAddCustom}>Cancel</button>
          </div>
          {#if generatedMd}
            <div class="generated-md">
              <span class="generated-label">Generated content</span>
              <pre>{generatedMd}</pre>
              <button class="action-btn secondary" onclick={onCopyGeneratedMd}
                >Copy to clipboard</button
              >
            </div>
          {/if}
        </div>
      {/if}
    </section>

    <section class="skills-section">
      <h2>Create in-house skill</h2>
      <p class="section-desc">Add a custom skill that lives on the backend.</p>
      {#if !showCreateInHouse}
        <button class="action-btn secondary" onclick={() => onSetShowCreateInHouse(true)}
          >Create in-house skill</button
        >
      {:else}
        <div class="add-custom-form">
          <label for="create-name">Name</label>
          <input
            id="create-name"
            type="text"
            value={createName}
            oninput={(e) => onSetCreateName(e.currentTarget.value)}
            placeholder="e.g. Code review for Python"
            disabled={creating}
          />
          <label for="create-desc">Description</label>
          <textarea
            id="create-desc"
            value={createDescription}
            oninput={(e) => onSetCreateDescription(e.currentTarget.value)}
            placeholder="What does this skill do?"
            rows="3"
            disabled={creating}
          ></textarea>
          {#if createError}
            <p class="create-error">{createError}</p>
          {/if}
          <div class="add-custom-actions">
            <button
              class="action-btn primary"
              onclick={onHandleCreateInHouse}
              disabled={creating || !createName.trim() || !createDescription.trim()}
            >
              {creating ? 'Creating...' : 'Create skill'}
            </button>
            <button class="action-btn secondary" onclick={onCloseCreateInHouse} disabled={creating}
              >Cancel</button
            >
          </div>
        </div>
      {/if}
    </section>

    <div class="assignment-note">
      <span class="note-icon">ℹ</span>
      <span>Currently {enabledIds.size} of {skills.length} skills are enabled.</span>
    </div>
  </div>
{/if}

<style>
  /* ── Loading / Empty ── */
  .loading-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    gap: 0.75rem;
    text-align: center;
    color: var(--color-text-muted, #71717a);
  }

  .empty-state h3 {
    margin: 0;
    color: var(--color-text, #18181b);
    font-size: 1.125rem;
  }

  .empty-state p {
    margin: 0;
    font-size: 0.875rem;
    max-width: 360px;
  }

  .spinner {
    width: 28px;
    height: 28px;
    border: 3px solid var(--color-border, #e5e7eb);
    border-top-color: var(--color-primary, #7c3aed);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* ── Buttons ── */
  .action-btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 8px;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }

  .action-btn.primary {
    background: var(--color-primary, #7c3aed);
    color: white;
  }

  .action-btn.primary:hover:not(:disabled) {
    background: var(--color-primary-hover, #6d28d9);
  }

  .action-btn.secondary {
    background: var(--color-bg-card, #fff);
    color: var(--color-text, #374151);
    border: 1px solid var(--color-border, #e5e7eb);
  }

  .action-btn.secondary:hover {
    background: var(--color-bg-card-hover, #f9fafb);
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ── Skills ── */
  .skills-content {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .skills-section h2 {
    margin: 0 0 0.5rem;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--color-text, #18181b);
  }

  .section-desc {
    margin: 0 0 1rem;
    font-size: 0.875rem;
    color: var(--color-text-muted, #71717a);
  }

  .skills-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .skill-card {
    background: var(--color-bg-card, #fff);
    border: 1px solid var(--color-border-light, #e5e7eb);
    border-radius: 10px;
    padding: 1rem 1.25rem;
    transition:
      border-color 0.15s,
      box-shadow 0.15s;
  }

  .skill-card.enabled {
    border-color: rgba(124, 58, 237, 0.4);
  }

  .skill-header {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
  }

  .skill-toggle {
    flex-shrink: 0;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    margin-top: 2px;
  }

  .skill-toggle:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .toggle-track {
    display: block;
    width: 40px;
    height: 22px;
    background: var(--color-border, #d4d4d8);
    border-radius: 11px;
    position: relative;
    transition: background 0.2s;
  }

  .skill-card.enabled .toggle-track {
    background: var(--color-primary, #7c3aed);
  }

  .toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 18px;
    height: 18px;
    background: white;
    border-radius: 50%;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    transition: transform 0.2s;
  }

  .skill-card.enabled .toggle-thumb {
    transform: translateX(18px);
  }

  .skill-info {
    flex: 1;
    min-width: 0;
  }

  .skill-name {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text, #18181b);
  }

  .skill-desc {
    margin: 0.25rem 0 0;
    font-size: 0.875rem;
    color: var(--color-text-muted, #71717a);
    line-height: 1.4;
  }

  .skill-category {
    display: inline-block;
    margin-top: 0.5rem;
    font-size: 0.75rem;
    color: var(--color-primary, #7c3aed);
    background: rgba(124, 58, 237, 0.1);
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
  }

  .expand-btn {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--color-border, #d4d4d8);
    background: var(--color-bg-subtle, #f4f4f5);
    border-radius: 6px;
    cursor: pointer;
    font-size: 1rem;
    color: var(--color-text-muted, #71717a);
  }

  .expand-btn:hover {
    background: var(--color-bg-card-hover, #e4e4e7);
  }

  .skill-details {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-border-light, #e5e7eb);
  }

  .detail-row {
    margin: 0.25rem 0;
    font-size: 0.8rem;
    color: var(--color-text-muted, #71717a);
  }

  .add-custom-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 500px;
  }

  .add-custom-form label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text, #18181b);
  }

  .add-custom-form textarea,
  .add-custom-form input[type='text'] {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 1px solid var(--color-border, #d4d4d8);
    border-radius: 8px;
    font-size: 0.9rem;
    resize: vertical;
    background: var(--color-bg-card, #fff);
    color: var(--color-text, #18181b);
  }

  .add-custom-form textarea:focus,
  .add-custom-form input[type='text']:focus {
    outline: none;
    border-color: var(--color-primary, #7c3aed);
  }

  .add-custom-actions {
    display: flex;
    gap: 0.75rem;
  }

  .generated-md {
    margin-top: 1rem;
    padding: 1rem;
    background: var(--color-bg-subtle, #f4f4f5);
    border-radius: 8px;
  }

  .generated-md .generated-label {
    display: block;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text, #18181b);
  }

  .generated-md pre {
    margin: 0 0 1rem;
    padding: 1rem;
    background: #fff;
    border: 1px solid var(--color-border, #d4d4d8);
    border-radius: 6px;
    font-size: 0.8rem;
    overflow-x: auto;
    white-space: pre-wrap;
  }

  .create-error {
    font-size: 0.875rem;
    color: var(--color-error, #dc2626);
    margin: 0;
  }

  .assignment-note {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: rgba(124, 58, 237, 0.08);
    border-radius: 8px;
    font-size: 0.875rem;
    color: var(--color-text-muted, #71717a);
  }

  .note-icon {
    font-size: 1.1rem;
  }
</style>
