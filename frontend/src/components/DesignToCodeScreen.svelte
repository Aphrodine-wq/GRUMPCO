<script lang="ts">
  import { onMount } from 'svelte';
  import { Button, Card } from '../lib/design-system';
  import { getApiBase } from '../lib/api.js';
  import { showToast } from '../stores/toastStore.js';
  import { getFigmaMe, getFigmaFiles, type FigmaFile } from '../lib/integrationsApi.js';
  import { Image, Code } from 'lucide-svelte';

  interface Props {
    onBack?: () => void;
  }

  let { onBack }: Props = $props();

  let description = $state('');
  let targetFramework = $state<
    'svelte' | 'react' | 'vue' | 'flutter' | 'angular' | 'nextjs' | 'nuxt' | 'solid' | 'qwik'
  >('svelte');
  let styling = $state<
    | 'tailwind'
    | 'css-modules'
    | 'vanilla-css'
    | 'sass'
    | 'styled-components'
    | 'emotion'
    | 'unocss'
    | 'panda-css'
    | 'shadcn-ui'
  >('tailwind');
  let theme = $state<'light' | 'dark' | 'system'>('system');
  let outputLang = $state<'ts' | 'js' | 'python' | 'go' | 'rust'>('ts');
  let componentStyle = $state<'composition' | 'options'>('composition');
  let imageFiles = $state<File[]>([]);
  let imagePreviews = $state<string[]>([]);
  let primaryImageIndex = $state(0);
  let loading = $state(false);
  let code = $state<string | null>(null);
  let explanation = $state<string | null>(null);
  let error = $state<string | null>(null);
  let resultTab = $state<'code' | 'explanation'>('code');
  let dropZoneActive = $state(false);
  let figmaConnected = $state(false);
  let showFigmaPicker = $state(false);
  let figmaFiles = $state<FigmaFile[]>([]);
  let figmaFilesLoading = $state(false);
  let selectedFigmaUrl = $state<string | null>(null);
  let layoutPreset = $state<string>('none');
  let templatesFromApi = $state<
    { id: string; label: string; description: string; group: string }[] | null
  >(null);

  const LAYOUT_PRESETS = [
    { id: 'none', label: 'None', description: 'No structure preset' },
    {
      id: 'header-hero-2col-footer',
      label: 'Header + Hero + 2-col + Footer',
      description: 'Section-based page',
    },
    { id: 'header-hero-footer', label: 'Header + Hero + Footer', description: 'Simple landing' },
    { id: '2col', label: '2-column grid', description: 'Two equal columns' },
    { id: '3col', label: '3-column grid', description: 'Three equal columns' },
    { id: 'sidebar-main', label: 'Sidebar + Main', description: 'Sidebar layout' },
    { id: 'app-shell', label: 'App shell', description: 'Header, nav, main content area' },
  ] as const;

  const TEMPLATES_FALLBACK: { label: string; description: string; group: string }[] = [
    {
      label: 'Dashboard',
      description: 'A dashboard with header, sidebar, and main content area with stats cards.',
      group: 'Layouts',
    },
    {
      label: 'Card',
      description: 'A responsive card grid with image, title, and description per card.',
      group: 'Layouts',
    },
    {
      label: 'Form',
      description: 'A form with labels, inputs, and submit button.',
      group: 'Forms & Pages',
    },
    {
      label: 'Auth',
      description: 'Login or signup form with email, password, and Submit.',
      group: 'Forms & Pages',
    },
    {
      label: 'List',
      description: 'A list view with items, optional filters, and actions.',
      group: 'Layouts',
    },
    {
      label: 'Settings',
      description: 'A settings page with sections and toggle/input controls.',
      group: 'Forms & Pages',
    },
    {
      label: 'Pricing',
      description: 'A pricing table with tiers and feature lists.',
      group: 'Layouts',
    },
    {
      label: 'Landing',
      description: 'A landing page with hero, features section, and CTA.',
      group: 'Layouts',
    },
    {
      label: 'Data table',
      description: 'A data table with sortable columns, filters, and pagination.',
      group: 'Layouts',
    },
    {
      label: 'Profile',
      description: 'A user profile page with avatar, bio, and edit form.',
      group: 'Forms & Pages',
    },
    {
      label: 'Hero',
      description: 'A hero section with headline, subtext, and CTA button.',
      group: 'Layouts',
    },
    {
      label: 'Sidebar layout',
      description: 'App layout with sidebar navigation and main content.',
      group: 'Layouts',
    },
    {
      label: 'App shell',
      description: 'Shell with header, nav, and main content area.',
      group: 'Layouts',
    },
    {
      label: 'Login form',
      description: 'A login form with email, password, and Submit button.',
      group: 'Forms & Pages',
    },
    {
      label: 'Settings page',
      description: 'A settings page with sections and toggle/input controls.',
      group: 'Forms & Pages',
    },
    {
      label: 'Pricing table',
      description: 'A pricing table with tiers and feature lists.',
      group: 'Layouts',
    },
  ];

  const TEMPLATES = $derived(templatesFromApi ?? TEMPLATES_FALLBACK);

  const STEP_LABELS = [
    { step: 1, title: 'Image(s)', hint: 'Screenshot or design mockup' },
    { step: 2, title: 'Description', hint: 'What you want the UI to do' },
    { step: 3, title: 'Template & Layout', hint: 'Preset and structure' },
    { step: 4, title: 'Framework', hint: 'Output framework' },
    { step: 5, title: 'Generate', hint: 'Get code + explanation' },
  ] as const;

  const templateGroups = $derived([...new Set(TEMPLATES.map((t) => t.group))]);

  function setTemplate(desc: string) {
    description = desc;
  }

  function onFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = input.files;
    if (!files?.length) return;
    for (let i = 0; i < files.length; i++) acceptFile(files[i]!);
    input.value = '';
  }

  function acceptFile(file: File) {
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file', 'error');
      return;
    }
    imageFiles = [...imageFiles, file];
    const reader = new FileReader();
    reader.onload = () => {
      imagePreviews = [...imagePreviews, reader.result as string];
    };
    reader.readAsDataURL(file);
  }

  function _removeImage(index: number) {
    imageFiles = imageFiles.filter((_, i) => i !== index);
    imagePreviews = imagePreviews.filter((_, i) => i !== index);
    if (primaryImageIndex >= imagePreviews.length)
      primaryImageIndex = Math.max(0, imagePreviews.length - 1);
  }

  function setPrimary(index: number) {
    primaryImageIndex = index;
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    dropZoneActive = false;
    const files = e.dataTransfer?.files;
    if (files) for (let i = 0; i < files.length; i++) acceptFile(files[i]!);
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'copy';
    dropZoneActive = true;
  }

  function onDragLeave() {
    dropZoneActive = false;
  }

  function clearImages() {
    imageFiles = [];
    imagePreviews = [];
    primaryImageIndex = 0;
    selectedFigmaUrl = null;
  }

  onMount(async () => {
    try {
      const me = await getFigmaMe();
      figmaConnected = me.connected;
    } catch {
      figmaConnected = false;
    }
    try {
      const res = await fetch(`${getApiBase()}/api/vision/design-templates`);
      if (res.ok) {
        const data = (await res.json()) as {
          templates?: { id: string; label: string; description: string; group: string }[];
        };
        if (data.templates?.length) templatesFromApi = data.templates;
      }
    } catch {
      templatesFromApi = null;
    }
  });

  async function openFigmaPicker() {
    showFigmaPicker = true;
    figmaFilesLoading = true;
    figmaFiles = [];
    try {
      figmaFiles = await getFigmaFiles();
    } catch (e) {
      showToast('Failed to load Figma files', 'error');
      console.error(e);
    } finally {
      figmaFilesLoading = false;
    }
  }

  function selectFigmaFile(file: FigmaFile) {
    selectedFigmaUrl = `https://www.figma.com/file/${file.key}`;
    showFigmaPicker = false;
  }

  async function submit() {
    if (!description.trim()) {
      showToast('Enter a description', 'error');
      return;
    }
    const hasImages = imagePreviews.length > 0;
    const hasFigma = !!selectedFigmaUrl;
    if (!hasImages && !hasFigma) {
      showToast('Upload an image, choose a Figma file, or drop one in the zone', 'error');
      return;
    }
    loading = true;
    error = null;
    code = null;
    explanation = null;
    try {
      let imageBase64: string | undefined;
      const primaryFile = imageFiles[primaryImageIndex];
      const primaryPreview = imagePreviews[primaryImageIndex];
      if (primaryFile) {
        const buf = await primaryFile.arrayBuffer();
        imageBase64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      } else if (primaryPreview?.startsWith('data:')) {
        imageBase64 = primaryPreview.replace(/^data:image\/\w+;base64,/, '');
      }
      const body: Record<string, unknown> = {
        description: description.trim(),
        targetFramework,
        styling,
        theme,
        outputLang,
        ...(targetFramework === 'vue' && { componentStyle }),
        ...(layoutPreset && layoutPreset !== 'none' && { layoutPreset }),
      };
      if (imageBase64) body.image = imageBase64;
      if (selectedFigmaUrl) body.figmaUrl = selectedFigmaUrl;
      const res = await fetch(`${getApiBase()}/api/vision/design-to-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { code?: string; explanation?: string };
      code = data.code ?? null;
      explanation = data.explanation ?? null;
      resultTab = explanation ? 'explanation' : 'code';
      showToast('Code generated', 'success');
    } catch (e) {
      error = (e as Error).message;
      showToast('Design-to-code failed', 'error');
    } finally {
      loading = false;
    }
  }
</script>

<div class="design-screen" role="application" aria-label="Design to code">
  <header class="design-header">
    <div class="header-left">
      {#if onBack}
        <Button variant="ghost" size="sm" onclick={onBack}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Back
        </Button>
      {/if}
      <div class="hero-section">
        <div class="hero-icon">
          <Code size={28} strokeWidth={2} />
        </div>
        <div>
          <h1 class="design-title">Design to code</h1>
          <p class="design-subtitle">
            Upload a design or screenshot and get production-ready code. Pick a template, choose
            your framework, and generate.
          </p>
        </div>
      </div>
    </div>
  </header>

  <!-- Step progress -->
  <div class="step-progress" role="navigation" aria-label="Steps">
    <div class="step-progress-track">
      {#each STEP_LABELS as step, i}
        <div class="step-progress-item">
          <span class="step-dot" aria-hidden="true">{i + 1}</span>
          <span class="step-label">{step.title}</span>
          {#if i < STEP_LABELS.length - 1}
            <span class="step-connector" aria-hidden="true"></span>
          {/if}
        </div>
      {/each}
    </div>
  </div>

  <div class="design-scroll-wrap">
    <div class="design-container design-two-col" role="main" aria-label="Design to code steps">
      <div class="design-col-left">
        <!-- Step 1: Image(s) -->
        <Card padding="md" variant="outlined" class="step-card">
          <section class="region region-drop" aria-label="Step 1: Image upload">
            <div class="step-heading">
              <span class="step-num" aria-hidden="true">1</span>
              <div class="step-heading-text">
                <h2 class="region-title">{STEP_LABELS[0].title}</h2>
                <p class="step-hint">{STEP_LABELS[0].hint}</p>
              </div>
            </div>
            {#if imagePreviews.length > 0 || selectedFigmaUrl}
              <div class="preview-area">
                {#if imagePreviews.length > 0}
                  <div class="image-carousel">
                    <div class="carousel-main">
                      <img
                        src={imagePreviews[primaryImageIndex]}
                        alt="Design preview"
                        class="image-preview"
                      />
                    </div>
                    <div class="carousel-thumbs">
                      {#each imagePreviews as preview, i}
                        <button
                          type="button"
                          class="thumb"
                          class:primary={i === primaryImageIndex}
                          onclick={() => setPrimary(i)}
                          aria-label="Select image {i + 1}"
                        >
                          <img src={preview} alt="" />
                        </button>
                      {/each}
                    </div>
                    <div class="preview-actions">
                      <Button variant="ghost" size="sm" onclick={clearImages} disabled={loading}
                        >Clear all</Button
                      >
                      <label class="add-more">
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onchange={onFileChange}
                          class="drop-input"
                          disabled={loading}
                        />
                        <span>Add another</span>
                      </label>
                    </div>
                  </div>
                {:else if selectedFigmaUrl}
                  <div class="preview-wrap">
                    <p class="figma-selected">Figma file selected</p>
                    <p class="figma-url">{selectedFigmaUrl}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      class="clear-btn"
                      onclick={() => (selectedFigmaUrl = null)}
                      disabled={loading}>Remove</Button
                    >
                  </div>
                {/if}
              </div>
            {:else}
              <div
                class="drop-zone"
                class:active={dropZoneActive}
                role="region"
                aria-label="Image drop zone"
                ondragover={onDragOver}
                ondragleave={onDragLeave}
                ondrop={onDrop}
              >
                <div class="drop-content">
                  <div class="drop-icon-wrap">
                    <Image size={48} strokeWidth={1.5} />
                  </div>
                  <p class="drop-text">Drop image(s) here or click to upload</p>
                  <p class="drop-hint">
                    Screenshots, mockups, or design files. Multiple images allowed.
                  </p>
                  {#if figmaConnected}
                    <Button
                      variant="secondary"
                      size="sm"
                      class="figma-btn"
                      onclick={openFigmaPicker}
                      disabled={loading}
                    >
                      Choose from Figma
                    </Button>
                  {/if}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onchange={onFileChange}
                    class="drop-input"
                    disabled={loading}
                  />
                </div>
              </div>
            {/if}
          </section>
        </Card>

        <!-- Step 2: Description -->
        <Card padding="md" variant="outlined" class="step-card">
          <section class="region" aria-label="Step 2: Description and templates">
            <div class="step-heading">
              <span class="step-num" aria-hidden="true">2</span>
              <div class="step-heading-text">
                <h2 class="region-title">{STEP_LABELS[1].title}</h2>
                <p class="step-hint">{STEP_LABELS[1].hint}</p>
              </div>
            </div>
            <p class="region-desc">Optional: pick a template to prefill, or type your own.</p>
            <div class="template-chips">
              {#each templateGroups as group}
                <div class="template-group">
                  <span class="template-group-label">{group}</span>
                  <div class="template-row">
                    {#each TEMPLATES.filter((t) => t.group === group) as t}
                      <button
                        type="button"
                        class="chip"
                        class:selected={description === t.description}
                        onclick={() => setTemplate(t.description)}
                        disabled={loading}
                      >
                        {t.label}
                      </button>
                    {/each}
                  </div>
                </div>
              {/each}
            </div>

            <!-- Layout / Structure -->
            <div class="layout-section">
              <label class="label" for="design-layout">Layout / Structure</label>
              <select
                id="design-layout"
                bind:value={layoutPreset}
                class="select"
                disabled={loading}
              >
                {#each LAYOUT_PRESETS as opt}
                  <option value={opt.id}>{opt.label} – {opt.description}</option>
                {/each}
              </select>
            </div>
            <textarea
              class="textarea"
              bind:value={description}
              placeholder="e.g. A login form with email, password, and Submit button"
              rows="3"
              disabled={loading}
            ></textarea>
          </section>
        </Card>
      </div>

      <div class="design-col-right">
        <!-- Step 4 & 5: Framework + options + Generate -->
        <Card padding="md" variant="outlined" class="step-card">
          <section class="region region-actions" aria-label="Step 4: Framework and generate">
            <div class="step-heading">
              <span class="step-num" aria-hidden="true">4</span>
              <div class="step-heading-text">
                <h2 class="region-title">{STEP_LABELS[3].title}</h2>
                <p class="step-hint">{STEP_LABELS[3].hint}</p>
              </div>
            </div>
            <div class="action-row action-row-multi">
              <div class="field-inline">
                <label class="label" for="design-framework">Framework</label>
                <select
                  id="design-framework"
                  bind:value={targetFramework}
                  class="select"
                  disabled={loading}
                >
                  <option value="svelte">Svelte</option>
                  <option value="react">React</option>
                  <option value="vue">Vue</option>
                  <option value="flutter">Flutter</option>
                  <option value="angular">Angular</option>
                  <option value="nextjs">Next.js</option>
                  <option value="nuxt">Nuxt</option>
                  <option value="solid">Solid</option>
                  <option value="qwik">Qwik</option>
                </select>
              </div>
              <div class="field-inline">
                <label class="label" for="design-styling">Styling</label>
                <select id="design-styling" bind:value={styling} class="select" disabled={loading}>
                  <option value="tailwind">Tailwind CSS</option>
                  <option value="css-modules">CSS Modules</option>
                  <option value="vanilla-css">Vanilla CSS</option>
                  <option value="sass">Sass/SCSS</option>
                  <option value="styled-components">Styled Components</option>
                  <option value="emotion">Emotion</option>
                  <option value="unocss">UnoCSS</option>
                  <option value="panda-css">Panda CSS</option>
                  <option value="shadcn-ui">shadcn/ui</option>
                </select>
              </div>
              <div class="field-inline">
                <label class="label" for="design-theme">Theme</label>
                <select id="design-theme" bind:value={theme} class="select" disabled={loading}>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System</option>
                </select>
              </div>
              <div class="field-inline">
                <label class="label" for="design-lang">Language</label>
                <select id="design-lang" bind:value={outputLang} class="select" disabled={loading}>
                  <option value="ts">TypeScript</option>
                  <option value="js">JavaScript</option>
                  <option value="python">Python</option>
                  <option value="go">Go</option>
                  <option value="rust">Rust</option>
                </select>
              </div>
              {#if targetFramework === 'vue'}
                <div class="field-inline">
                  <label class="label" for="design-vue-style">Vue API</label>
                  <select
                    id="design-vue-style"
                    bind:value={componentStyle}
                    class="select"
                    disabled={loading}
                  >
                    <option value="composition">Composition API</option>
                    <option value="options">Options API</option>
                  </select>
                </div>
              {/if}
            </div>
            <div class="generate-section generate-section-inline">
              <p class="step-hint">
                Step 5: Click <strong>Generate code</strong> in the bar below when ready.
              </p>
            </div>
          </section>
        </Card>

        {#if error}
          <Card padding="md" variant="outlined" class="result-card error">
            <p class="result-label">Error</p>
            <p class="result-text">{error}</p>
          </Card>
        {/if}

        <!-- Result: code + explanation (tabs) -->
        {#if code !== null}
          <Card padding="md" variant="outlined" class="step-card region-result">
            <section class="region" aria-label="Generated code and explanation">
              <h2 class="region-title">Result</h2>
              <div class="result-tabs">
                <button
                  type="button"
                  class="tab"
                  class:active={resultTab === 'code'}
                  onclick={() => (resultTab = 'code')}
                >
                  Code
                </button>
                {#if explanation}
                  <button
                    type="button"
                    class="tab"
                    class:active={resultTab === 'explanation'}
                    onclick={() => (resultTab = 'explanation')}
                  >
                    Explanation
                  </button>
                {/if}
              </div>
              <div class="result-panel">
                {#if resultTab === 'code'}
                  <pre class="code-block">{code}</pre>
                {:else if explanation}
                  <div class="explanation-block">{explanation}</div>
                {/if}
              </div>
            </section>
          </Card>
        {/if}
      </div>
    </div>
  </div>

  <!-- Sticky footer: Generate button always visible -->
  <footer class="design-footer" role="region" aria-label="Generate">
    <div class="design-footer-inner">
      <Button
        variant="primary"
        size="md"
        onclick={submit}
        disabled={loading}
        class="generate-btn generate-btn-sticky {loading ? 'loading' : ''}"
      >
        {#if loading}
          <span class="generate-btn-text">Generating…</span>
        {:else}
          <span class="generate-btn-text">Generate code</span>
        {/if}
      </Button>
    </div>
  </footer>

  <!-- Figma file picker modal -->
  {#if showFigmaPicker}
    <div
      class="figma-modal-overlay"
      role="dialog"
      aria-label="Choose Figma file"
      tabindex="-1"
      onclick={() => (showFigmaPicker = false)}
      onkeydown={(e) => e.key === 'Escape' && (showFigmaPicker = false)}
    >
      <div
        class="figma-modal"
        role="document"
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.stopPropagation()}
      >
        <div class="figma-modal-header">
          <h3>Choose a Figma file</h3>
          <button
            type="button"
            class="figma-modal-close"
            onclick={() => (showFigmaPicker = false)}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div class="figma-modal-body">
          {#if figmaFilesLoading}
            <p>Loading files…</p>
          {:else if figmaFiles.length === 0}
            <p>No files found. Connect Figma in Integrations first.</p>
          {:else}
            <ul class="figma-file-list">
              {#each figmaFiles as file (file.key)}
                <li>
                  <button
                    type="button"
                    class="figma-file-item"
                    onclick={() => selectFigmaFile(file)}
                  >
                    <span class="figma-file-name">{file.name}</span>
                    {#if file.thumbnail_url}
                      <img src={file.thumbnail_url} alt="" class="figma-thumb" />
                    {/if}
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .design-screen {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    background: var(--color-bg-subtle, #f9fafb);
    overflow: hidden;
    font-family: 'Inter', system-ui, sans-serif;
  }

  .design-header {
    flex-shrink: 0;
    background: var(--color-bg-card, #ffffff);
    border-bottom: 1px solid var(--color-border, #e5e7eb);
    padding: 0.875rem 1.25rem;
    display: flex;
    align-items: center;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .hero-section {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
  }

  .hero-icon {
    flex-shrink: 0;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(124, 58, 237, 0.12), rgba(124, 58, 237, 0.06));
    color: var(--color-primary, #7c3aed);
    border-radius: 12px;
  }

  .design-title {
    font-size: 1.125rem;
    font-weight: 700;
    margin: 0 0 0.2rem;
    color: var(--color-text, #111827);
    letter-spacing: -0.02em;
  }

  .design-subtitle {
    font-size: 0.8125rem;
    color: var(--color-text-muted, #6b7280);
    margin: 0;
    line-height: 1.4;
  }

  .step-progress {
    flex-shrink: 0;
    padding: 0.5rem 1.25rem;
    background: var(--color-bg-subtle, #fafafa);
    border-bottom: 1px solid var(--color-border, #e5e7eb);
  }

  .step-progress-track {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 0;
    flex-wrap: wrap;
    row-gap: 0.5rem;
  }

  .step-progress-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .step-dot {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: var(--color-border, #e5e7eb);
    color: var(--color-text-muted, #6b7280);
    font-size: 0.75rem;
    font-weight: 600;
    border-radius: 50%;
  }

  .step-label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-text-secondary, #374151);
  }

  .step-connector {
    width: 20px;
    height: 2px;
    background: var(--color-border, #e5e7eb);
    margin: 0 0.25rem;
  }

  .design-scroll-wrap {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
  }

  .design-container {
    padding: 1rem 1.25rem 1.5rem;
    max-width: 960px;
    margin: 0 auto;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    box-sizing: border-box;
  }

  .design-container.design-two-col {
    max-width: 1280px;
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.25rem;
    align-items: start;
  }

  @media (min-width: 1024px) {
    .design-container.design-two-col {
      grid-template-columns: 1fr 1fr;
    }
  }

  .design-col-left,
  .design-col-right {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-width: 0;
  }

  .design-footer {
    flex-shrink: 0;
    background: var(--color-bg-card, #ffffff);
    border-top: 1px solid var(--color-border, #e5e7eb);
    padding: 0.75rem 1.25rem;
    z-index: 10;
  }

  .design-footer-inner {
    max-width: 960px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: flex-start;
  }

  .generate-section-inline {
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: none;
  }

  .generate-section-inline .step-hint {
    margin: 0;
  }

  .generate-btn-sticky {
    min-width: 160px;
    font-weight: 600;
  }

  .step-card {
    flex-shrink: 0;
  }

  .region {
    background: transparent;
    border: none;
    padding: 0;
  }

  .region .step-heading {
    margin-top: 0;
  }

  .region-title {
    font-size: 0.9375rem;
    font-weight: 700;
    color: var(--color-text, #111827);
    margin: 0 0 0.25rem;
    letter-spacing: -0.01em;
  }

  .region-desc {
    font-size: 0.8125rem;
    color: var(--color-text-muted, #6b7280);
    margin: 0 0 0.75rem;
    line-height: 1.4;
  }

  .step-heading {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--color-border-light, #f3f4f6);
  }

  .step-heading-text {
    flex: 1;
    min-width: 0;
  }

  .step-num {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    flex-shrink: 0;
    background: var(--color-bg-secondary);
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    font-weight: 700;
    border-radius: 8px;
  }

  .step-hint {
    font-size: 0.8125rem;
    color: var(--color-text-muted);
    margin: 0;
    line-height: 1.3;
  }

  .step-hint-inline {
    font-size: 0.8125rem;
    color: var(--color-text-muted);
    display: block;
    margin-bottom: 0.5rem;
  }

  .figma-btn {
    margin-top: 0.5rem;
  }

  .figma-selected {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text);
    margin: 0 0 0.25rem;
  }

  .figma-url {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    word-break: break-all;
    margin: 0;
  }

  .figma-modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .figma-modal {
    background: var(--color-bg-card);
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    max-width: 480px;
    width: 100%;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
  }

  .figma-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--color-border);
  }

  .figma-modal-header h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text);
  }

  .figma-modal-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    line-height: 1;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 0.25rem;
  }

  .figma-modal-close:hover {
    color: var(--color-text);
  }

  .figma-modal-body {
    padding: 1rem 1.25rem;
    overflow-y: auto;
  }

  .figma-file-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .figma-file-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.75rem;
    text-align: left;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    margin-bottom: 0.5rem;
    cursor: pointer;
    font-size: 0.875rem;
  }

  .figma-file-item:hover {
    background: var(--color-bg-secondary);
  }

  .figma-file-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .figma-thumb {
    width: 48px;
    height: 36px;
    object-fit: cover;
    border-radius: 4px;
  }

  .template-group {
    margin-bottom: 0.75rem;
  }

  .template-group-label {
    display: block;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 0.5rem;
  }

  .template-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .generate-wrap {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  /* Drop zone */
  .region-drop .drop-zone {
    position: relative;
    min-height: 160px;
    border: 2px dashed var(--color-border);
    border-radius: 10px;
    background: var(--color-bg-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    transition:
      border-color 0.15s,
      background 0.15s;
  }

  .drop-zone.active {
    border-color: #3b82f6;
    background: #eff6ff;
  }

  .drop-zone.has-image {
    min-height: 120px;
    padding: 12px;
  }

  .drop-content {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 2rem 1.5rem;
  }

  .drop-icon-wrap {
    width: 80px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-subtle, #f5f3ff);
    color: var(--color-text-muted, #9ca3af);
    border-radius: 16px;
    border: 2px dashed var(--color-border, #e9d5ff);
    transition:
      border-color 0.2s,
      background 0.2s;
  }

  .drop-zone.active .drop-icon-wrap {
    border-color: var(--color-primary, #7c3aed);
    background: rgba(124, 58, 237, 0.06);
    color: var(--color-primary, #7c3aed);
  }

  .drop-text {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-text, #111827);
    margin: 0;
  }

  .drop-hint {
    font-size: 0.8125rem;
    color: var(--color-text-muted, #6b7280);
    margin: 0;
  }

  .drop-input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
    font-size: 0;
  }

  .preview-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    width: 100%;
  }

  .image-preview {
    max-width: 260px;
    max-height: 140px;
    object-fit: contain;
    border-radius: 8px;
    border: 1px solid var(--color-border);
  }

  .clear-btn {
    flex-shrink: 0;
  }

  .preview-area {
    width: 100%;
  }

  .image-carousel {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .carousel-main {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 160px;
    background: var(--color-bg-secondary);
    border-radius: 10px;
    border: 1px solid var(--color-border);
    padding: 0.5rem;
  }

  .carousel-main .image-preview {
    max-width: 100%;
    max-height: 280px;
  }

  .carousel-thumbs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-content: center;
  }

  .carousel-thumbs .thumb {
    width: 56px;
    height: 56px;
    padding: 0;
    border: 2px solid var(--color-border);
    border-radius: 8px;
    overflow: hidden;
    background: var(--color-bg-card);
    cursor: pointer;
    flex-shrink: 0;
  }

  .carousel-thumbs .thumb.primary {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
  }

  .carousel-thumbs .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .preview-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .add-more {
    font-size: 0.875rem;
    color: #3b82f6;
    cursor: pointer;
  }

  .add-more input {
    position: absolute;
    width: 0;
    height: 0;
    opacity: 0;
  }

  .layout-section {
    margin-top: 1rem;
    margin-bottom: 0.5rem;
  }

  .layout-section .select {
    max-width: 360px;
  }

  /* Template chips */
  .template-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
  }

  .chip {
    font-size: 0.8125rem;
    padding: 6px 12px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-bg-card);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition:
      border-color 0.15s,
      background 0.15s;
  }

  .chip:hover:not(:disabled) {
    border-color: var(--color-border);
    background: var(--color-bg-secondary);
  }

  .chip.selected {
    border-color: #3b82f6;
    background: #eff6ff;
    color: #1d4ed8;
  }

  .chip:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .textarea {
    width: 100%;
    padding: 12px 14px;
    border: 1px solid var(--color-border);
    border-radius: 10px;
    font-size: 0.875rem;
    resize: vertical;
    color: var(--color-text);
    background: var(--color-bg-card);
  }

  .textarea:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  /* Actions */
  .action-row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 1rem;
  }

  .action-row-multi {
    margin-bottom: 1rem;
  }

  .generate-section {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-border);
  }

  .generate-heading {
    margin-bottom: 0.75rem;
    padding-bottom: 0.5rem;
  }

  .generate-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1rem;
  }

  .field-inline {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .field-inline .label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .select {
    padding: 10px 14px;
    border: 1px solid var(--color-border);
    border-radius: 10px;
    font-size: 0.875rem;
    background: var(--color-bg-card);
    color: var(--color-text);
  }

  .select:focus {
    outline: none;
    border-color: #3b82f6;
  }

  .generate-btn {
    flex-shrink: 0;
    min-width: 160px;
    font-weight: 600;
  }

  .generate-btn.loading {
    opacity: 0.9;
    cursor: wait;
  }

  .generate-btn-text {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  /* Error */
  .result-card.error {
    padding: 1.25rem 1.5rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 12px;
  }

  .result-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #dc2626;
    margin: 0 0 8px;
    text-transform: uppercase;
  }

  .result-text {
    font-size: 0.875rem;
    color: var(--color-text);
    margin: 0;
  }

  /* Result tabs + panel */
  .region-result {
    padding-bottom: 1.5rem;
  }

  .result-tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 12px;
    border-bottom: 1px solid var(--color-border);
  }

  .tab {
    font-size: 0.875rem;
    font-weight: 500;
    padding: 8px 14px;
    border: none;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    margin-bottom: -1px;
    border-bottom: 2px solid transparent;
    border-radius: 6px 6px 0 0;
  }

  .tab:hover {
    color: var(--color-text-secondary);
  }

  .tab.active {
    color: var(--color-text);
    border-bottom-color: #3b82f6;
  }

  .result-panel {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    overflow: hidden;
  }

  .code-block {
    margin: 0;
    padding: 1rem 1.25rem;
    background: var(--color-bg-card);
    color: var(--color-text);
    font-size: 0.8125rem;
    line-height: 1.5;
    overflow-x: auto;
    white-space: pre;
    border: none;
  }

  .explanation-block {
    padding: 1rem 1.25rem;
    font-size: 0.875rem;
    color: var(--color-text-secondary);
    line-height: 1.6;
    white-space: pre-wrap;
  }
</style>
