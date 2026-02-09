<script lang="ts">
  /**
   * ProjectsScreen - Dedicated Projects view
   * Tracks user projects and lets them switch between them.
   * New Project uses a minimal onboarding wizard: Name → Type/Template → Integrations → Review.
   */
  import ProjectsDashboard from './ProjectsDashboard.svelte';
  import { setCurrentView, showPricing } from '../stores/uiStore';
  import { sessionsStore } from '../stores/sessionsStore';
  import { Button, Modal, Input } from '../lib/design-system';
  import { ArrowLeft, ChevronLeft, ChevronRight, Plug2 } from 'lucide-svelte';
  import type { SessionType } from '../types';
  import {
    listIntegrations,
    PROVIDER_METADATA,
    type Integration,
    type IntegrationProvider,
  } from '../lib/integrationsApi';
  import OnboardingDots from './OnboardingDots.svelte';

  interface Props {
    onBack?: () => void;
  }

  let { onBack }: Props = $props();

  const WIZARD_STEPS = 4;
  type WizardStep = 1 | 2 | 3 | 4;
  const PROJECT_INTEGRATIONS_KEY = 'g-rump-project-integrations';

  let showNewProjectModal = $state(false);
  let wizardStep = $state<WizardStep>(1);
  let projectName = $state('');
  let projectDescription = $state('');
  let selectedTemplate = $state<string>('blank');
  let selectedFramework = $state<string>('none');
  let linkedIntegrationIds = $state<string[]>([]);
  let integrations = $state<Integration[]>([]);
  let integrationsLoading = $state(false);

  /** Project type / starter template */
  const TEMPLATES = [
    { id: 'blank', label: 'Blank', desc: 'Start from scratch' },
    { id: 'webapp', label: 'Web App', desc: 'Frontend or full-stack web' },
    { id: 'api', label: 'API', desc: 'Backend REST or GraphQL' },
    { id: 'cli', label: 'CLI', desc: 'Command-line tool' },
    { id: 'gAgent', label: 'Agent', desc: 'AI agent workflow' },
    { id: 'saas', label: 'SaaS', desc: 'Subscription software product' },
    { id: 'dashboard', label: 'Dashboard', desc: 'Analytics, admin panels' },
    { id: 'ecommerce', label: 'E-commerce', desc: 'Online store, marketplace' },
    { id: 'mobile', label: 'Mobile App', desc: 'iOS and Android apps' },
  ];

  /** Framework for frontend / full-stack projects */
  const FRAMEWORKS = [
    { id: 'none', label: 'None' },
    { id: 'svelte', label: 'Svelte' },
    { id: 'react', label: 'React' },
    { id: 'vue', label: 'Vue' },
    { id: 'nextjs', label: 'Next.js' },
    { id: 'nuxt', label: 'Nuxt' },
    { id: 'solid', label: 'Solid' },
    { id: 'qwik', label: 'Qwik' },
    { id: 'angular', label: 'Angular' },
  ];

  const PROJECT_TYPES = [
    { id: 'blank', label: 'Blank' },
    { id: 'webapp', label: 'Web App' },
    { id: 'api', label: 'API' },
    { id: 'cli', label: 'CLI' },
    { id: 'gAgent', label: 'Agent' },
    { id: 'saas', label: 'SaaS' },
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'ecommerce', label: 'E-commerce' },
    { id: 'mobile', label: 'Mobile' },
  ];

  function handleBack() {
    onBack?.() ?? setCurrentView('chat');
  }

  function handleSelectProject(id: string) {
    sessionsStore.switchSession(id);
    setCurrentView('chat');
  }

  function openNewProjectModal() {
    projectName = '';
    projectDescription = '';
    selectedTemplate = 'blank';
    selectedFramework = 'none';
    linkedIntegrationIds = [];
    wizardStep = 1;
    showNewProjectModal = true;
    loadIntegrationsForWizard();
  }

  async function loadIntegrationsForWizard() {
    integrationsLoading = true;
    try {
      integrations = await listIntegrations();
    } catch {
      integrations = [];
    } finally {
      integrationsLoading = false;
    }
  }

  function getProviderDisplayName(provider: IntegrationProvider): string {
    return PROVIDER_METADATA[provider]?.name ?? provider;
  }

  function toggleLinkedIntegration(id: string) {
    if (linkedIntegrationIds.includes(id)) {
      linkedIntegrationIds = linkedIntegrationIds.filter((x) => x !== id);
    } else {
      linkedIntegrationIds = [...linkedIntegrationIds, id];
    }
  }

  function goToIntegrationsScreen() {
    showNewProjectModal = false;
    setCurrentView('integrations');
  }

  function wizardNext() {
    if (wizardStep < WIZARD_STEPS) wizardStep = (wizardStep + 1) as WizardStep;
  }

  function wizardBack() {
    if (wizardStep > 1) wizardStep = (wizardStep - 1) as WizardStep;
  }

  function selectProjectType(templateId: string) {
    selectedTemplate = templateId;
  }

  function handleNewProjectSubmit() {
    const name = projectName.trim() || 'New Project';
    const sessionType: SessionType | undefined =
      selectedTemplate === 'gAgent' ? 'gAgent' : undefined;
    const session = sessionsStore.createSession([], null, sessionType);
    sessionsStore.renameSession(session.id, name);
    try {
      localStorage.setItem(
        `${PROJECT_INTEGRATIONS_KEY}-${session.id}`,
        JSON.stringify(linkedIntegrationIds)
      );
    } catch {
      /* ignore */
    }
    showNewProjectModal = false;
    wizardStep = 1;
    setCurrentView('chat');
  }

  function handleUpgrade() {
    showPricing.set(true);
  }
</script>

<div class="projects-screen">
  <header class="projects-header">
    <Button variant="ghost" size="sm" onclick={handleBack} title="Back">
      <ArrowLeft size={16} />
      Back
    </Button>
    <div class="header-text">
      <h1>Projects</h1>
      <p class="subtitle">Manage and switch between your projects</p>
    </div>
  </header>
  <main class="projects-main">
    <ProjectsDashboard
      onSelectProject={handleSelectProject}
      onNewProject={openNewProjectModal}
      onUpgrade={handleUpgrade}
    />
  </main>

  <Modal
    bind:open={showNewProjectModal}
    onClose={() => (showNewProjectModal = false)}
    title="New Project"
    description={wizardStep === 1
      ? 'Name your project.'
      : wizardStep === 2
        ? 'Choose type and framework.'
        : wizardStep === 3
          ? 'Link integrations to this project.'
          : 'Review and create.'}
    size="lg"
    footer={newProjectModalFooter}
  >
    <div class="wizard-dots">
      <OnboardingDots
        total={WIZARD_STEPS}
        current={wizardStep - 1}
        onDotClick={(i) => (wizardStep = (i + 1) as WizardStep)}
        background="white"
      />
    </div>
    <div class="new-project-wizard">
      {#if wizardStep === 1}
        <div class="wizard-step">
          <Input
            type="text"
            placeholder="My Project"
            bind:value={projectName}
            label="Project name"
            fullWidth
          />
          <div class="form-field">
            <label class="field-label" for="project-description">Description (optional)</label>
            <textarea
              id="project-description"
              class="project-description-input"
              placeholder="Briefly describe what you want to build..."
              bind:value={projectDescription}
              rows="3"
            ></textarea>
          </div>
        </div>
      {:else if wizardStep === 2}
        <div class="wizard-step">
          <fieldset class="template-fieldset">
            <legend class="field-label">Project type</legend>
            <p class="field-hint">Choose a type and template</p>
            <div class="template-chips">
              {#each PROJECT_TYPES as t}
                <button
                  type="button"
                  class="template-chip"
                  class:selected={selectedTemplate === t.id}
                  onclick={() => selectProjectType(t.id)}
                >
                  {t.label}
                </button>
              {/each}
            </div>
          </fieldset>
          <fieldset class="template-fieldset">
            <legend class="field-label">Template</legend>
            <div class="template-chips template-chips-secondary">
              {#each TEMPLATES as tpl}
                <button
                  type="button"
                  class="template-chip template-chip-with-desc"
                  class:selected={selectedTemplate === tpl.id}
                  onclick={() => (selectedTemplate = tpl.id)}
                >
                  <span class="template-chip-label">{tpl.label}</span>
                  <span class="template-chip-desc">{tpl.desc}</span>
                </button>
              {/each}
            </div>
          </fieldset>
          <fieldset class="template-fieldset">
            <legend class="field-label">Framework (optional)</legend>
            <div class="template-chips">
              {#each FRAMEWORKS as fw}
                <button
                  type="button"
                  class="template-chip"
                  class:selected={selectedFramework === fw.id}
                  onclick={() => (selectedFramework = fw.id)}
                >
                  {fw.label}
                </button>
              {/each}
            </div>
          </fieldset>
        </div>
      {:else if wizardStep === 3}
        <div class="wizard-step">
          <p class="field-hint">Link existing integrations to this project, or connect new ones.</p>
          {#if integrationsLoading}
            <p class="wizard-loading">Loading integrations…</p>
          {:else if integrations.length === 0}
            <p class="wizard-empty">No integrations connected yet.</p>
            <Button variant="primary" size="sm" onclick={goToIntegrationsScreen}>
              <Plug2 size={16} />
              Connect integrations
            </Button>
          {:else}
            <div class="integrations-link-list">
              {#each integrations as integration}
                <label class="integration-link-row">
                  <input
                    type="checkbox"
                    checked={linkedIntegrationIds.includes(integration.id)}
                    onchange={() => toggleLinkedIntegration(integration.id)}
                  />
                  <span
                    >{integration.displayName ||
                      getProviderDisplayName(integration.provider as IntegrationProvider)}</span
                  >
                </label>
              {/each}
            </div>
            <Button variant="ghost" size="sm" onclick={goToIntegrationsScreen}>
              <Plug2 size={16} />
              Connect another integration
            </Button>
          {/if}
        </div>
      {:else}
        <div class="wizard-step wizard-summary">
          <dl class="summary-list">
            <dt>Name</dt>
            <dd>{projectName.trim() || 'New Project'}</dd>
            <dt>Description</dt>
            <dd>{projectDescription.trim() || '—'}</dd>
            <dt>Type</dt>
            <dd>{TEMPLATES.find((t) => t.id === selectedTemplate)?.label ?? selectedTemplate}</dd>
            <dt>Framework</dt>
            <dd>
              {FRAMEWORKS.find((f) => f.id === selectedFramework)?.label ?? selectedFramework}
            </dd>
            <dt>Integrations</dt>
            <dd>
              {#if linkedIntegrationIds.length === 0}
                None
              {:else}
                {linkedIntegrationIds.length} linked
              {/if}
            </dd>
          </dl>
        </div>
      {/if}
    </div>
  </Modal>

  {#snippet newProjectModalFooter()}
    <Button variant="ghost" onclick={() => (showNewProjectModal = false)}>Cancel</Button>
    {#if wizardStep > 1}
      <Button variant="ghost" onclick={wizardBack}>
        <ChevronLeft size={16} />
        Back
      </Button>
    {/if}
    {#if wizardStep < WIZARD_STEPS}
      <Button variant="primary" onclick={wizardNext}>
        Next
        <ChevronRight size={16} />
      </Button>
    {:else}
      <Button variant="primary" onclick={handleNewProjectSubmit}>Create Project</Button>
    {/if}
  {/snippet}
</div>

<style>
  .projects-screen {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    background: var(--color-bg-app, #fafafa);
  }

  .projects-header {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 1rem 1.5rem;
    flex-shrink: 0;
    border-bottom: 1px solid var(--color-border, #e5e7eb);
    background: var(--color-bg-card, #fff);
  }

  .header-text {
    flex: 1;
  }

  .projects-header h1 {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-text, #111827);
    margin: 0 0 0.25rem;
  }

  .subtitle {
    font-size: 0.9375rem;
    color: var(--color-text-muted, #6b7280);
    margin: 0;
  }

  .projects-main {
    flex: 1;
    overflow-y: auto;
  }

  .projects-main :global(.dashboard) {
    height: 100%;
  }

  .projects-main :global(.header) {
    border-bottom: none;
  }

  .wizard-dots {
    margin-bottom: 1rem;
  }

  .new-project-wizard {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .wizard-step {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .wizard-loading,
  .wizard-empty {
    font-size: 0.875rem;
    color: var(--color-text-muted, #6b7280);
    margin: 0 0 0.5rem;
  }

  .integrations-link-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .integration-link-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0;
    font-size: 0.875rem;
    cursor: pointer;
  }

  .integration-link-row input {
    width: 1rem;
    height: 1rem;
  }

  .wizard-summary .summary-list {
    margin: 0;
    font-size: 0.875rem;
  }

  .wizard-summary .summary-list dt {
    font-weight: 600;
    color: var(--color-text-muted, #6b7280);
    margin-top: 0.75rem;
  }

  .wizard-summary .summary-list dt:first-child {
    margin-top: 0;
  }

  .wizard-summary .summary-list dd {
    margin: 0.25rem 0 0;
    color: var(--color-text, #111827);
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .field-hint {
    font-size: 0.8125rem;
    color: var(--color-text-muted, #6b7280);
    margin: 0 0 0.5rem;
  }

  .project-description-input {
    width: 100%;
    min-height: 80px;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    font-family: inherit;
    color: var(--color-text, #1f1147);
    background: var(--color-bg-input, #f3e8ff);
    border: 1px solid var(--color-border, #e9d5ff);
    border-radius: 8px;
    resize: vertical;
  }

  .project-description-input::placeholder {
    color: var(--color-text-muted, #6b7280);
  }

  .project-description-input:focus {
    outline: 2px solid var(--color-primary, #7c3aed);
    outline-offset: 2px;
  }

  .field-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text, #1f1147);
  }

  .template-fieldset {
    border: none;
    padding: 0;
    margin: 0;
  }

  .template-fieldset legend {
    margin-bottom: 0.5rem;
  }

  .template-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .template-chips-secondary {
    margin-top: 0.25rem;
  }

  .template-chip-with-desc {
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
    gap: 0.25rem;
  }

  .template-chip-label {
    font-weight: 500;
  }

  .template-chip-desc {
    font-size: 0.75rem;
    color: var(--color-text-muted, #6b7280);
  }

  .template-chip {
    padding: 0.5rem 1rem;
    border: 1px solid var(--color-border, #e9d5ff);
    border-radius: 8px;
    background: var(--color-bg-card, #fff);
    color: var(--color-text, #1f1147);
    font-size: 0.875rem;
    cursor: pointer;
  }

  .template-chip:hover {
    background: var(--color-bg-card-hover, #f8f5ff);
  }

  .template-chip.selected {
    border-color: var(--color-primary, #7c3aed);
    background: var(--color-primary-subtle, rgba(124, 58, 237, 0.1));
    color: var(--color-primary, #7c3aed);
  }
</style>
