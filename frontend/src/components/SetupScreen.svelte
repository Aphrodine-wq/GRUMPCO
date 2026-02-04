<script lang="ts">
  import Button from '$lib/design-system/components/Button/Button.svelte';
  import Card from '$lib/design-system/components/Card/Card.svelte';
  import { preferencesStore, type UserPreferences } from '../stores/preferencesStore';
  import { trackSetupComplete, trackSetupSkipped } from '$lib/analytics';
  import { Building2, FileText, Code2, Sparkles, Check } from 'lucide-svelte';

  interface Props {
    onComplete?: () => void;
    onSkip?: () => void;
  }

  let { onComplete, onSkip }: Props = $props();

  let currentStep = $state(0);
  let isSubmitting = $state(false);
  let connectionStatus = $state<'idle' | 'checking' | 'ok' | 'error'>('idle');

  const steps = ['Welcome', 'Preferences', 'Model', 'Tech Stack', 'Complete'];

  type ModelChoice = 'kimi' | 'nemotron-ultra' | 'nemotron-super' | 'auto';
  let selectedModel = $state<ModelChoice>('kimi');

  const modelOptions: { value: ModelChoice; label: string; desc: string }[] = [
    { value: 'kimi', label: 'KimiK2.5', desc: 'Recommended for most users (cost-effective)' },
    { value: 'nemotron-ultra', label: 'NemoTRON Ultra 253B', desc: 'Highest quality' },
    { value: 'nemotron-super', label: 'NemoTRON Super 49B', desc: 'Balanced' },
    { value: 'auto', label: 'Let G-Rump decide', desc: 'Auto-routing by task' },
  ];

  let preferences = $state<Partial<UserPreferences>>({
    diagramStyle: 'detailed',
    primaryTechStack: [],
    analyticsOptIn: true,
  });

  const diagramStyles = [
    {
      value: 'minimal',
      label: 'Minimal',
      description: 'Simple, focused diagrams with essential components only',
    },
    {
      value: 'detailed',
      label: 'Detailed',
      description: 'Comprehensive diagrams with most details included',
    },
    {
      value: 'comprehensive',
      label: 'Comprehensive',
      description: 'Maximum detail with all annotations and relationships',
    },
  ];

  const techOptions = {
    Frontend: ['React', 'Vue', 'Svelte', 'Angular', 'Next.js'],
    Backend: ['Node.js', 'Python', 'Go', 'Java', '.NET', 'Ruby'],
    Database: ['PostgreSQL', 'MySQL', 'MongoDB', 'SQLite', 'Redis'],
    Cloud: ['AWS', 'GCP', 'Azure', 'Vercel', 'Netlify'],
  };

  function toggleTechStack(tech: string) {
    const stack = preferences.primaryTechStack || [];
    const index = stack.indexOf(tech);
    if (index > -1) {
      stack.splice(index, 1);
    } else {
      stack.push(tech);
    }
    preferences.primaryTechStack = [...stack];
  }

  function goNext() {
    if (currentStep < steps.length - 1) {
      currentStep++;
    }
  }

  function goBack() {
    if (currentStep > 0) {
      currentStep--;
    }
  }

  function handleComplete() {
    isSubmitting = true;
    try {
      // Save preferences and mark setup complete
      preferencesStore.update({
        diagramStyle: preferences.diagramStyle as 'minimal' | 'detailed' | 'comprehensive',
        primaryTechStack: preferences.primaryTechStack || [],
        analyticsOptIn: preferences.analyticsOptIn ?? true,
        setupComplete: true,
      });

      // Track analytics
      trackSetupComplete({
        diagramStyle: preferences.diagramStyle,
        techStackCount: preferences.primaryTechStack?.length || 0,
      });

      // Call completion callback
      onComplete?.();
    } catch (error) {
      console.error('Failed to complete setup:', error);
    } finally {
      isSubmitting = false;
    }
  }

  function handleSkip() {
    preferencesStore.completeSetup();
    trackSetupSkipped();
    onSkip?.();
  }

  async function testConnection() {
    connectionStatus = 'checking';
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const res = await fetch(`${apiUrl.replace(/\/$/, '')}/health/quick`, { method: 'GET' });
      const data = (await res.json()) as { status?: string };
      connectionStatus = data?.status === 'healthy' ? 'ok' : 'error';
    } catch {
      connectionStatus = 'error';
    }
  }
</script>

<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
  <Card class="w-full max-w-2xl mx-4 shadow-2xl">
    <div class="p-8">
      <!-- Progress indicator -->
      <div class="mb-8">
        <div class="flex justify-between items-center mb-4">
          {#each steps as step, i}
            <div class="flex flex-col items-center flex-1" class:opacity-50={i > currentStep}>
              <div
                class="w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors"
                class:bg-blue-500={i <= currentStep}
                class:bg-gray-300={i > currentStep}
                class:text-white={i <= currentStep}
                class:text-gray-600={i > currentStep}
              >
                {i + 1}
              </div>
              <span class="text-xs mt-2 text-center">{step}</span>
            </div>
          {/each}
        </div>
        <div class="h-1 bg-gray-200 rounded-full overflow-hidden">
          <div
            class="h-full bg-blue-500 transition-all duration-300"
            style="width: {((currentStep + 1) / steps.length) * 100}%"
          ></div>
        </div>
      </div>

      <!-- Step content -->
      <div class="min-h-64">
        <!-- Step 0: Welcome -->
        {#if currentStep === 0}
          <div class="text-center">
            <h2 class="text-3xl font-bold mb-4">Welcome to G-Rump</h2>
            <p class="text-gray-600 mb-6">
              Let's set up your preferences to get you started quickly. Or try the one-click demo
              first.
            </p>
            <p class="text-sm text-gray-500 mb-2">
              <strong>API key:</strong> For Architecture, PRD, and Code generation, add
              <code class="text-xs bg-gray-100 px-1 rounded">NVIDIA_NIM_API_KEY</code>
              or <code class="text-xs bg-gray-100 px-1 rounded">OPENROUTER_API_KEY</code> to your
              backend <code class="text-xs bg-gray-100 px-1 rounded">.env</code>. Get keys from
              <a
                href="https://build.nvidia.com/"
                target="_blank"
                rel="noopener noreferrer"
                class="text-blue-600 hover:underline">NVIDIA</a
              >
              or
              <a
                href="https://openrouter.ai/"
                target="_blank"
                rel="noopener noreferrer"
                class="text-blue-600 hover:underline">OpenRouter</a
              >.
            </p>
            <p class="text-sm text-gray-500 mb-4">
              After completing or skipping setup, use <strong>Run demo</strong> in the chat to see Architecture
              → PRD with sample data (no API key required for demo).
            </p>
            <div class="mb-4 flex justify-center gap-2">
              <button
                type="button"
                class="text-sm px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                onclick={testConnection}
                disabled={connectionStatus === 'checking'}
              >
                {connectionStatus === 'checking' ? 'Checking…' : 'Test connection'}
              </button>
              {#if connectionStatus === 'ok'}
                <span class="text-sm text-green-600">Backend connected</span>
              {:else if connectionStatus === 'error'}
                <span class="text-sm text-amber-600"
                  >Backend unreachable. Start it with <code class="text-xs">npm run dev</code> or
                  <code class="text-xs">start-app.bat</code>.</span
                >
              {/if}
            </div>
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-6 text-left space-y-3">
              <div class="flex items-start gap-3">
                <Building2 class="w-8 h-8 shrink-0 text-blue-600" strokeWidth={1.5} />
                <div>
                  <h3 class="font-semibold">Design Architecture</h3>
                  <p class="text-sm text-gray-600">
                    Generate system architecture diagrams from descriptions
                  </p>
                </div>
              </div>
              <div class="flex items-start gap-3">
                <FileText class="w-8 h-8 shrink-0 text-blue-600" strokeWidth={1.5} />
                <div>
                  <h3 class="font-semibold">Create PRDs</h3>
                  <p class="text-sm text-gray-600">Automatic Product Requirements Documents</p>
                </div>
              </div>
              <div class="flex items-start gap-3">
                <Code2 class="w-8 h-8 shrink-0 text-blue-600" strokeWidth={1.5} />
                <div>
                  <h3 class="font-semibold">Generate Code</h3>
                  <p class="text-sm text-gray-600">Complete applications from your designs</p>
                </div>
              </div>
            </div>
          </div>
        {/if}

        <!-- Step 1: Diagram Style (Preferences) -->
        {#if currentStep === 1}
          <div>
            <h2 class="text-2xl font-bold mb-6">Diagram Preference</h2>
            <p class="text-gray-600 mb-6">How detailed should your diagrams be?</p>
            <div class="space-y-3">
              {#each diagramStyles as style}
                <label
                  class="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                  class:border-blue-500={preferences.diagramStyle === style.value}
                  class:bg-blue-50={preferences.diagramStyle === style.value}
                >
                  <input
                    type="radio"
                    name="diagramStyle"
                    value={style.value}
                    bind:group={preferences.diagramStyle}
                    class="mr-4"
                  />
                  <div class="flex-1">
                    <div class="font-semibold">{style.label}</div>
                    <div class="text-sm text-gray-600">{style.description}</div>
                  </div>
                </label>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Step 2: Tech Stack -->
        {#if currentStep === 2}
          <div>
            <h2 class="text-2xl font-bold mb-6">Primary Tech Stack</h2>
            <p class="text-gray-600 mb-6">Select your preferred technologies</p>
            <div class="space-y-6">
              {#each Object.entries(techOptions) as [category, techs]}
                <div>
                  <h3 class="font-semibold mb-3 text-sm text-gray-700">{category}</h3>
                  <div class="flex flex-wrap gap-2">
                    {#each techs as tech}
                      <button
                        type="button"
                        class="px-4 py-2 rounded-full border transition-colors text-sm font-medium"
                        class:bg-blue-500={preferences.primaryTechStack?.includes(tech)}
                        class:text-white={preferences.primaryTechStack?.includes(tech)}
                        class:border-blue-500={preferences.primaryTechStack?.includes(tech)}
                        class:border-gray-300={!preferences.primaryTechStack?.includes(tech)}
                        class:hover:border-gray-400={!preferences.primaryTechStack?.includes(tech)}
                        onclick={() => toggleTechStack(tech)}
                      >
                        {tech}
                      </button>
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
            {#if preferences.primaryTechStack && preferences.primaryTechStack.length > 0}
              <div class="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p class="text-sm text-gray-700">
                  <strong>Selected:</strong>
                  {preferences.primaryTechStack.join(', ')}
                </p>
              </div>
            {/if}
          </div>
        {/if}

        <!-- Step 4: Complete -->
        {#if currentStep === 4}
          <div class="text-center">
            <div class="mb-6 flex justify-center">
              <Sparkles class="w-16 h-16 text-amber-500" strokeWidth={1.5} />
            </div>
            <h2 class="text-2xl font-bold mb-4">All Set!</h2>
            <p class="text-gray-600 mb-6">
              Your preferences have been saved. You're ready to start creating amazing projects.
            </p>
            <div class="bg-green-50 border border-green-200 rounded-lg p-6 text-left space-y-2">
              <div class="flex items-center gap-2 text-sm">
                <Check class="w-4 h-4 shrink-0 text-green-600" strokeWidth={2} />
                <span>Diagram style: <strong>{preferences.diagramStyle}</strong></span>
              </div>
              <div class="flex items-center gap-2 text-sm">
                <Check class="w-4 h-4 shrink-0 text-green-600" strokeWidth={2} />
                <span
                  >Default model: <strong
                    >{modelOptions.find((m) => m.value === selectedModel)?.label ??
                      selectedModel}</strong
                  ></span
                >
              </div>
              <div class="flex items-center gap-2 text-sm">
                <Check class="w-4 h-4 shrink-0 text-green-600" strokeWidth={2} />
                <span
                  >Tech stack: <strong
                    >{preferences.primaryTechStack?.length || 0} technologies</strong
                  ></span
                >
              </div>
              <div class="flex items-center gap-2 text-sm">
                <Check class="w-4 h-4 shrink-0 text-green-600" strokeWidth={2} />
                <span
                  >Analytics: <strong>{preferences.analyticsOptIn ? 'Enabled' : 'Disabled'}</strong
                  ></span
                >
              </div>
            </div>
          </div>
        {/if}
      </div>

      <!-- Navigation buttons -->
      <div class="mt-12 flex justify-between items-center gap-4">
        <div>
          {#if currentStep > 0}
            <Button variant="ghost" size="sm" onclick={goBack} disabled={isSubmitting}>Back</Button>
          {/if}
        </div>
        <div class="flex gap-3">
          {#if currentStep < steps.length - 1}
            <Button variant="ghost" size="sm" onclick={handleSkip} disabled={isSubmitting}>
              Skip
            </Button>
          {/if}
          {#if currentStep < steps.length - 1}
            <Button size="sm" onclick={goNext} disabled={isSubmitting}>Next</Button>
          {:else}
            <Button
              size="sm"
              onclick={handleComplete}
              disabled={isSubmitting}
              loading={isSubmitting}
            >
              Get Started
            </Button>
          {/if}
        </div>
      </div>
    </div>
  </Card>
</div>

<style>
  /* Smooth transitions */
  :global(.transition-colors) {
    transition-property: background-color, border-color, color;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 150ms;
  }

  :global(.transition-all) {
    transition-property: all;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 300ms;
  }
</style>
