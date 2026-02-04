<script lang="ts">
  import { onMount } from 'svelte';
  import { Button } from '../lib/design-system';
  import { getSkills, getSkill, generateSkillMd, type SkillSummary } from '../lib/api';
  import { settingsStore } from '../stores/settingsStore';
  import { showToast } from '../stores/toastStore';

  interface Props {
    onBack: () => void;
  }

  let { onBack }: Props = $props();

  let skills = $state<SkillSummary[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let enabledIds = $state<Set<string>>(new Set());
  let saving = $state(false);
  let showAddCustom = $state(false);
  let customDescription = $state('');
  let generatingMd = $state(false);
  let generatedMd = $state('');
  let expandedSkillId = $state<string | null>(null);
  let expandedSkillDetail = $state<{ tools?: string[] } | null>(null);

  onMount(() => {
    load();
  });

  async function load() {
    loading = true;
    error = null;
    try {
      const [skillsList, settings] = await Promise.all([getSkills(), settingsStore.load()]);
      skills = skillsList;
      const ids = settings?.skills?.enabledIds;
      if (ids && ids.length > 0) {
        const filtered = new Set(ids.filter((id) => skillsList.some((s) => s.id === id)));
        enabledIds = filtered.size > 0 ? filtered : new Set(skillsList.map((s) => s.id));
      } else {
        enabledIds = new Set(skillsList.map((s) => s.id));
      }
    } catch (e) {
      error = (e as Error).message;
      showToast('Failed to load skills', 'error');
    } finally {
      loading = false;
    }
  }

  async function toggleSkill(id: string) {
    const next = new Set(enabledIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    enabledIds = next;
    await saveEnabledIds(Array.from(next));
  }

  async function saveEnabledIds(ids: string[]) {
    saving = true;
    try {
      const ok = await settingsStore.save({ skills: { enabledIds: ids } });
      if (ok) {
        showToast('Skills updated', 'success');
      } else {
        showToast('Failed to save skills', 'error');
        await load();
      }
    } catch (e) {
      showToast('Failed to save skills', 'error');
      await load();
    } finally {
      saving = false;
    }
  }

  async function generateCustomSkill() {
    if (!customDescription.trim()) return;
    generatingMd = true;
    generatedMd = '';
    try {
      const content = await generateSkillMd(customDescription.trim());
      generatedMd = content;
      showToast('Skill template generated', 'success');
    } catch (e) {
      showToast('Failed to generate skill', 'error');
    } finally {
      generatingMd = false;
    }
  }

  function copyGeneratedMd() {
    if (!generatedMd) return;
    navigator.clipboard.writeText(generatedMd).then(() => {
      showToast('Copied to clipboard', 'success');
    });
  }

  function closeAddCustom() {
    showAddCustom = false;
    customDescription = '';
    generatedMd = '';
  }

  async function toggleExpand(id: string) {
    if (expandedSkillId === id) {
      expandedSkillId = null;
      expandedSkillDetail = null;
      return;
    }
    expandedSkillId = id;
    expandedSkillDetail = null;
    try {
      const detail = await getSkill(id);
      expandedSkillDetail = detail;
    } catch {
      expandedSkillDetail = {};
    }
  }
</script>

<div class="skills-screen">
  <header class="header">
    <button class="back-btn" onclick={onBack} type="button">
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      Back
    </button>
    <div class="header-content">
      <h1>Skills</h1>
      <p class="subtitle">
        Manage AI model skills – enable or disable built-in skills, add custom skills
      </p>
    </div>
  </header>

  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading skills...</p>
    </div>
  {:else if error}
    <div class="error-state">
      <p>{error}</p>
      <Button variant="secondary" onclick={load}>Retry</Button>
    </div>
  {:else}
    <div class="content">
      <section class="section">
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
                  onclick={() => toggleSkill(skill.id)}
                  disabled={saving}
                  title={enabledIds.has(skill.id) ? 'Disable' : 'Enable'}
                >
                  <span class="toggle-track">
                    <span class="toggle-thumb"></span>
                  </span>
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
                  onclick={() => toggleExpand(skill.id)}
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

      <section class="section">
        <h2>Add Custom Skill</h2>
        <p class="section-desc">
          Generate a SKILL.md template from a description. Save to .cursor/skills/ or use with
          Cursor.
        </p>
        {#if !showAddCustom}
          <Button variant="secondary" onclick={() => (showAddCustom = true)}
            >Add custom skill</Button
          >
        {:else}
          <div class="add-custom-form">
            <label for="skill-desc">Describe the skill (e.g. "Code review for Python")</label>
            <textarea
              id="skill-desc"
              bind:value={customDescription}
              placeholder="Describe what the skill should do..."
              rows="3"
              disabled={generatingMd}
            ></textarea>
            <div class="add-custom-actions">
              <Button
                variant="primary"
                onclick={generateCustomSkill}
                disabled={generatingMd || !customDescription.trim()}
              >
                {generatingMd ? 'Generating...' : 'Generate SKILL.md'}
              </Button>
              <Button variant="ghost" onclick={closeAddCustom}>Cancel</Button>
            </div>
            {#if generatedMd}
              <div class="generated-md">
                <span class="generated-label">Generated content</span>
                <pre>{generatedMd}</pre>
                <Button variant="secondary" size="sm" onclick={copyGeneratedMd}
                  >Copy to clipboard</Button
                >
              </div>
            {/if}
          </div>
        {/if}
      </section>

      <section class="section assignment-section">
        <h2>Assignment</h2>
        <p class="section-desc">
          Enabled skills apply to all chats by default. Per-session or per-model assignment is
          coming soon.
        </p>
        <div class="assignment-note">
          <span class="note-icon">ℹ</span>
          <span>Currently {enabledIds.size} of {skills.length} skills are enabled.</span>
        </div>
      </section>
    </div>
  {/if}
</div>

<style>
  .skills-screen {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .header {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 1rem 0;
    border-bottom: 1px solid var(--color-border-light, #e5e7eb);
    flex-shrink: 0;
  }

  .back-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem;
    background: var(--color-bg-subtle, #f4f4f5);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    color: var(--color-text, #18181b);
  }

  .back-btn:hover {
    background: var(--color-bg-card-hover, #e4e4e7);
  }

  .header-content {
    flex: 1;
    min-width: 0;
  }

  .header h1 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-text, #18181b);
  }

  .subtitle {
    margin: 0.25rem 0 0 0;
    font-size: 0.9rem;
    color: var(--color-text-muted, #71717a);
  }

  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 3rem;
    color: var(--color-text-muted, #71717a);
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--color-border, #e4e4e7);
    border-top-color: var(--color-primary, #7c3aed);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .content {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem 0;
  }

  .section {
    margin-bottom: 2rem;
  }

  .section h2 {
    margin: 0 0 0.5rem 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--color-text, #18181b);
  }

  .section-desc {
    margin: 0 0 1rem 0;
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
    margin: 0.25rem 0 0 0;
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

  .add-custom-form textarea {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 1px solid var(--color-border, #d4d4d8);
    border-radius: 8px;
    font-size: 0.9rem;
    resize: vertical;
  }

  .add-custom-form textarea:focus {
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
    margin: 0 0 1rem 0;
    padding: 1rem;
    background: #fff;
    border: 1px solid var(--color-border, #d4d4d8);
    border-radius: 6px;
    font-size: 0.8rem;
    overflow-x: auto;
    white-space: pre-wrap;
  }

  .assignment-section {
    padding-top: 1rem;
    border-top: 1px solid var(--color-border-light, #e5e7eb);
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
