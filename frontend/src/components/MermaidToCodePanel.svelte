<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { chatModeStore } from '../stores/chatModeStore';
  import { workspaceStore } from '../stores/workspaceStore';
  import { get } from 'svelte/store';
  import { showToast } from '../stores/toastStore';
  import { processError, logError } from '../utils/errorHandler';

  interface Props {
    mermaidCode: string;
  }

  let { mermaidCode }: Props = $props();

  const dispatch = createEventDispatcher();

  let framework = $state('react');
  let language = $state('typescript');
  let isGenerating = $state(false);
  let error = $state<string | null>(null);
  let isValidMermaid = $state(true);
  let showPreview = $state(false);
  let estimatedTime = $state<number | null>(null);
  
  // Remember last selections
  const LAST_FRAMEWORK_KEY = 'mermaid-to-code-last-framework';
  const LAST_LANGUAGE_KEY = 'mermaid-to-code-last-language';
  
  // Load last selections
  if (typeof window !== 'undefined') {
    const lastFramework = localStorage.getItem(LAST_FRAMEWORK_KEY);
    const lastLanguage = localStorage.getItem(LAST_LANGUAGE_KEY);
    if (lastFramework) framework = lastFramework;
    if (lastLanguage) language = lastLanguage;
  }

  const frameworks = [
    { value: 'react', label: 'React', icon: '⚛️' },
    { value: 'vue', label: 'Vue', icon: '💚' },
    { value: 'svelte', label: 'Svelte', icon: '🧡' },
    { value: 'nextjs', label: 'Next.js', icon: '▲' },
    { value: 'express', label: 'Express.js', icon: '🚂' },
    { value: 'fastapi', label: 'FastAPI', icon: '⚡' },
  ];

  const languages = [
    { value: 'typescript', label: 'TypeScript', icon: '📘' },
    { value: 'javascript', label: 'JavaScript', icon: '📗' },
    { value: 'python', label: 'Python', icon: '🐍' },
    { value: 'java', label: 'Java', icon: '☕' },
    { value: 'go', label: 'Go', icon: '🐹' },
  ];

  function getFrameworkIcon(value: string): string {
    return frameworks.find(f => f.value === value)?.icon || '📦';
  }

  function getLanguageIcon(value: string): string {
    return languages.find(l => l.value === value)?.icon || '📄';
  }

  function estimateGenerationTime(): number {
    // Rough estimate: 5-15 seconds depending on diagram complexity
    const lines = mermaidCode.split('\n').length;
    return Math.max(5, Math.min(15, Math.floor(lines / 10) + 5));
  }

  function togglePreview() {
    showPreview = !showPreview;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      generateCode();
    }
  }

  function validateMermaidCode(code: string): boolean {
    if (!code || code.trim().length === 0) {
      return false;
    }
    
    // Basic validation: check if it looks like Mermaid code
    const hasMermaidKeywords = /(flowchart|graph|sequenceDiagram|classDiagram|erDiagram|stateDiagram|gantt|pie|gitgraph|journey|requirementDiagram|mindmap|timeline|quadrantChart|sankey-beta|xychart-beta|block-beta|packet-beta|C4Context|C4Container|C4Component|C4Deployment|C4Dynamic)/i.test(code);
    
    return hasMermaidKeywords;
  }

  async function generateCode() {
    if (!mermaidCode || isGenerating) return;

    // Validate Mermaid code
    if (!validateMermaidCode(mermaidCode)) {
      error = 'Invalid Mermaid diagram code. Please ensure the diagram is valid.';
      isValidMermaid = false;
      showToast('Invalid diagram code. Please check your Mermaid syntax.', 'error');
      return;
    }

    error = null;
    isValidMermaid = true;
    isGenerating = true;
    const ws = get(workspaceStore);

    try {
      // Validate workspace if in Code mode
      if (!ws || ws.trim().length === 0) {
        throw new Error('Workspace path is required for code generation');
      }

      // Switch to Code mode
      chatModeStore.setMode('code');

      // Save selections
      if (typeof window !== 'undefined') {
        localStorage.setItem(LAST_FRAMEWORK_KEY, framework);
        localStorage.setItem(LAST_LANGUAGE_KEY, language);
      }

      // Estimate time
      estimatedTime = estimateGenerationTime();

      // Dispatch event to trigger code generation
      dispatch('generate-code', {
        mermaidCode,
        framework,
        language,
        workspaceRoot: ws,
      });

      showToast(`Generating ${framework} code in ${language}...`, 'info');
    } catch (err: any) {
      const errorContext = processError(err, async () => {
        // Retry generation
        await generateCode();
      });
      
      logError(errorContext);
      error = errorContext.userMessage;
      showToast(errorContext.userMessage, 'error', errorContext.retryable ? 0 : 5000, {
        persistent: errorContext.retryable,
        actions: errorContext.recovery,
      });
    } finally {
      isGenerating = false;
    }
  }

  $effect(() => {
    // Validate Mermaid code when it changes
    if (mermaidCode) {
      isValidMermaid = validateMermaidCode(mermaidCode);
      if (isValidMermaid) {
        error = null;
      }
    }
  });
</script>

<div class="mermaid-to-code-panel">
  <div class="panel-header">
    <h3 class="panel-title">Generate Code from Architecture</h3>
    <p class="panel-description">Transform your Mermaid diagram into working code</p>
  </div>

  <div class="panel-content" onkeydown={handleKeydown}>
    <div class="form-group">
      <label class="form-label">
        <span class="label-icon">{getFrameworkIcon(framework)}</span>
        Framework
      </label>
      <select class="form-select" bind:value={framework} disabled={isGenerating}>
        {#each frameworks as fw}
          <option value={fw.value}>{fw.icon} {fw.label}</option>
        {/each}
      </select>
    </div>

    <div class="form-group">
      <label class="form-label">
        <span class="label-icon">{getLanguageIcon(language)}</span>
        Language
      </label>
      <select class="form-select" bind:value={language} disabled={isGenerating}>
        {#each languages as lang}
          <option value={lang.value}>{lang.icon} {lang.label}</option>
        {/each}
      </select>
    </div>

    {#if estimatedTime && isGenerating}
      <div class="progress-info">
        <div class="progress-bar">
          <div class="progress-fill" style="width: 50%"></div>
        </div>
        <span class="progress-text">Estimated time: ~{estimatedTime}s</span>
      </div>
    {/if}

    {#if showPreview}
      <div class="preview-section">
        <div class="preview-header">
          <span class="preview-title">Preview</span>
          <button class="preview-toggle" on:click={togglePreview}>Hide</button>
        </div>
        <div class="preview-content">
          <div class="preview-item">
            <strong>Framework:</strong> {frameworks.find(f => f.value === framework)?.label}
          </div>
          <div class="preview-item">
            <strong>Language:</strong> {languages.find(l => l.value === language)?.label}
          </div>
          <div class="preview-item">
            <strong>Files to generate:</strong> Project structure with components, services, and configuration
          </div>
        </div>
      </div>
    {:else if !isGenerating}
      <button class="preview-toggle" on:click={togglePreview}>Show Preview</button>
    {/if}

    {#if error}
      <div class="error-message">
        {error}
      </div>
    {/if}
    
    {#if !isValidMermaid && mermaidCode}
      <div class="validation-warning">
        ⚠️ Invalid Mermaid syntax detected
      </div>
    {/if}

    <button
      class="generate-btn"
      on:click={generateCode}
      disabled={isGenerating || !mermaidCode || !isValidMermaid}
      title="Generate code (Ctrl/Cmd + Enter)"
    >
      {#if isGenerating}
        <span class="spinner"></span>
        Generating...
      {:else}
        <span>🚀</span>
        Generate Code
      {/if}
    </button>
    
    <div class="shortcut-hint">
      Press <kbd>Ctrl/Cmd + Enter</kbd> to generate
    </div>
  </div>
</div>

<style>
  .mermaid-to-code-panel {
    background: #ffffff;
    border: 1px solid #e5e5e5;
    border-radius: 8px;
    padding: 1.5rem;
    margin: 1rem 0;
  }

  .panel-header {
    margin-bottom: 1.5rem;
  }

  .panel-title {
    font-family: 'JetBrains Mono', monospace;
    font-size: 1.125rem;
    font-weight: 600;
    color: #000000;
    margin: 0 0 0.5rem 0;
  }

  .panel-description {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0;
  }

  .panel-content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
  }

  .form-select {
    padding: 0.5rem 0.75rem;
    border: 1px solid #e5e5e5;
    border-radius: 4px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    background: #ffffff;
    color: #000000;
    cursor: pointer;
    outline: none;
    transition: border-color 0.15s;
  }

  .form-select:hover:not(:disabled) {
    border-color: #0066ff;
  }

  .form-select:focus {
    border-color: #0066ff;
    box-shadow: 0 0 0 3px rgba(0, 102, 255, 0.1);
  }

  .form-select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .generate-btn {
    padding: 0.75rem 1.5rem;
    background: #0066ff;
    color: #ffffff;
    border: none;
    border-radius: 4px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .generate-btn:hover:not(:disabled) {
    background: #0052cc;
  }

  .generate-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #ffffff;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error-message {
    padding: 0.75rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 4px;
    color: #991b1b;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    margin-bottom: 0.5rem;
  }

  .validation-warning {
    padding: 0.75rem;
    background: #fffbeb;
    border: 1px solid #fde68a;
    border-radius: 4px;
    color: #92400e;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    margin-bottom: 0.5rem;
  }
</style>
