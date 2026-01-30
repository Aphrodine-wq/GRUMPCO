<script lang="ts">
  import Button from '$lib/design-system/components/Button/Button.svelte';
  import Card from '$lib/design-system/components/Card/Card.svelte';
  import QuickStartModal from './QuickStartModal.svelte';
  import { tutorialStore, TUTORIALS, type QuickStartTemplate } from '../stores/tutorialStore';
  import { demoStore } from '../stores/demoStore';
  import { chatModeStore } from '../stores/chatModeStore';
  import { showToast } from '../stores/toastStore';

  interface Props {
    onTemplateSelect?: (template: QuickStartTemplate) => void;
    onStartTutorial?: () => void;
  }

  let { onTemplateSelect, onStartTutorial }: Props = $props();

  let showQuickStart = $state(false);
  let showExamples = $state(false);
  let demoStarting = $state(false);

  const examplePrompts = [
    {
      icon: '🏗️',
      title: 'Architecture Design',
      prompt: 'Design a microservices architecture for an e-commerce platform with user service, product catalog, and order management',
    },
    {
      icon: '💻',
      title: 'Full-Stack App',
      prompt: 'Build a task management app with React, Node.js, and PostgreSQL. Include authentication and real-time updates',
    },
    {
      icon: '🔌',
      title: 'REST API',
      prompt: 'Create a RESTful API for a blog platform with posts, comments, and user authentication using JWT',
    },
    {
      icon: '🎨',
      title: 'Component Library',
      prompt: 'Build a design system with reusable React components, TypeScript, and Storybook documentation',
    },
  ];

  function handleStartTutorial() {
    tutorialStore.startTutorial('first-time');
    onStartTutorial?.();
  }

  function handleTemplateSelect(template: QuickStartTemplate) {
    showQuickStart = false;
    onTemplateSelect?.(template);
  }

  function handleExampleClick(prompt: string) {
    onTemplateSelect?.({
      id: 'custom',
      name: 'Custom',
      description: '',
      icon: '💡',
      prompt,
      mode: 'design',
      tags: [],
    });
  }

  async function handleTryDemo() {
    if (demoStarting) return;
    demoStarting = true;
    const result = await demoStore.startDemo();
    demoStarting = false;
    if (!result.ok) {
      showToast(result.error ?? 'Failed to start demo', 'error');
      return;
    }
    chatModeStore.setMode('code');
    showToast('Demo workspace ready. Follow the steps to try Code mode.', 'success');
  }
</script>

<div class="flex flex-col items-center justify-center min-h-[60vh] p-8">
  <div class="max-w-3xl w-full space-y-8">
    <!-- Hero Section -->
    <div class="text-center space-y-4">
      <div class="text-6xl mb-4">🚀</div>
      <h1 class="text-4xl font-bold text-gray-900">Welcome to G-Rump</h1>
      <p class="text-xl text-gray-600">
        AI-powered platform for architecture design, code generation, and development workflows
      </p>
    </div>

    <!-- Quick Actions -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <button
        onclick={() => (showQuickStart = true)}
        class="p-6 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl hover:shadow-lg transition-all group"
      >
        <div class="text-3xl mb-3">⚡</div>
        <h3 class="font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
          Quick Start
        </h3>
        <p class="text-sm text-gray-600">
          Choose from pre-built templates
        </p>
      </button>

      <button
        onclick={handleStartTutorial}
        class="p-6 bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 rounded-xl hover:shadow-lg transition-all group"
      >
        <div class="text-3xl mb-3">🎓</div>
        <h3 class="font-bold text-gray-900 mb-2 group-hover:text-purple-600 transition-colors">
          Take a Tour
        </h3>
        <p class="text-sm text-gray-600">
          Learn how to use G-Rump
        </p>
      </button>

      <button
        onclick={handleTryDemo}
        disabled={demoStarting}
        class="p-6 bg-gradient-to-br from-amber-50 to-amber-100 border-2 border-amber-200 rounded-xl hover:shadow-lg transition-all group disabled:opacity-60"
      >
        <div class="text-3xl mb-3">🎬</div>
        <h3 class="font-bold text-gray-900 mb-2 group-hover:text-amber-600 transition-colors">
          Try Demo
        </h3>
        <p class="text-sm text-gray-600">
          Sample project + guided walkthrough
        </p>
      </button>

      <button
        onclick={() => (showExamples = !showExamples)}
        class="p-6 bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 rounded-xl hover:shadow-lg transition-all group"
      >
        <div class="text-3xl mb-3">💡</div>
        <h3 class="font-bold text-gray-900 mb-2 group-hover:text-green-600 transition-colors">
          See Examples
        </h3>
        <p class="text-sm text-gray-600">
          Explore what you can build
        </p>
      </button>
    </div>

    <!-- Example Prompts (Expandable) -->
    {#if showExamples}
      <div class="space-y-3 animate-fadeIn">
        <h3 class="font-semibold text-gray-900">Try these examples:</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          {#each examplePrompts as example}
            <button
              onclick={() => handleExampleClick(example.prompt)}
              class="text-left p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all group"
            >
              <div class="flex items-start gap-3">
                <div class="text-2xl">{example.icon}</div>
                <div class="flex-1">
                  <h4 class="font-semibold mb-1 group-hover:text-blue-600 transition-colors">
                    {example.title}
                  </h4>
                  <p class="text-sm text-gray-600">{example.prompt}</p>
                </div>
              </div>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Features Overview -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 border-t border-gray-200">
      <div class="text-center">
        <div class="text-3xl mb-2">🏗️</div>
        <h4 class="font-semibold mb-1">Architecture Design</h4>
        <p class="text-sm text-gray-600">Generate system diagrams from descriptions</p>
      </div>
      <div class="text-center">
        <div class="text-3xl mb-2">💻</div>
        <h4 class="font-semibold mb-1">Code Generation</h4>
        <p class="text-sm text-gray-600">Complete applications from your designs</p>
      </div>
      <div class="text-center">
        <div class="text-3xl mb-2">⚡</div>
        <h4 class="font-semibold mb-1">Ship Mode</h4>
        <p class="text-sm text-gray-600">Architecture → PRD → Plan → Code</p>
      </div>
    </div>

    <!-- Keyboard Shortcuts Hint -->
    <div class="text-center text-sm text-gray-500 pt-4">
      <p>
        <kbd class="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs">Ctrl</kbd>
        +
        <kbd class="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs">K</kbd>
        for command palette •
        <kbd class="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs">/</kbd>
        to focus input
      </p>
    </div>
  </div>
</div>

{#if showQuickStart}
  <QuickStartModal
    onSelect={handleTemplateSelect}
    onClose={() => (showQuickStart = false)}
  />
{/if}

<style>
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-fadeIn {
    animation: fadeIn 0.3s ease;
  }

  kbd {
    font-family: ui-monospace, monospace;
  }
</style>
