<script lang="ts">
  import Button from '$lib/design-system/components/Button/Button.svelte';
  import Card from '$lib/design-system/components/Card/Card.svelte';
  import {
    QUICK_START_TEMPLATES,
    tutorialStore,
    type QuickStartTemplate,
  } from '../stores/tutorialStore';
  import {
    Check,
    Plug,
    Palette,
    Building2,
    ShoppingCart,
    MessageCircle,
    BarChart3,
    Smartphone,
    X,
  } from 'lucide-svelte';

  interface Props {
    onSelect?: (template: QuickStartTemplate) => void;
    onClose?: () => void;
  }

  let { onSelect, onClose }: Props = $props();

  let selectedCategory = $state<string>('all');
  let searchQuery = $state('');

  const categories = ['all', 'Full-stack', 'Frontend', 'Backend', 'Architecture'];

  const filteredTemplates = $derived.by(() => {
    let templates = QUICK_START_TEMPLATES;

    if (selectedCategory !== 'all') {
      templates = templates.filter((t) => t.tags.includes(selectedCategory));
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      templates = templates.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.description.toLowerCase().includes(query) ||
          t.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    return templates;
  });

  function handleSelect(template: QuickStartTemplate) {
    tutorialStore.hideQuickStart();
    onSelect?.(template);
    onClose?.();
  }

  function handleClose() {
    tutorialStore.hideQuickStart();
    onClose?.();
  }

  const iconMap: Record<string, typeof Check> = {
    check: Check,
    plug: Plug,
    palette: Palette,
    building: Building2,
    'shopping-cart': ShoppingCart,
    'message-circle': MessageCircle,
    'bar-chart': BarChart3,
    smartphone: Smartphone,
  };
</script>

<div
  class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
  role="dialog"
  aria-modal="true"
  aria-label="Quick Start Templates"
  tabindex="-1"
  onclick={handleClose}
  onkeydown={(e) => {
    if (e.key === 'Escape') handleClose();
  }}
>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="w-full max-w-4xl max-h-[90vh] overflow-hidden"
    role="document"
    onclick={(e) => e.stopPropagation()}
  >
    <Card>
      <div class="p-6">
        <!-- Header -->
        <div class="flex justify-between items-start mb-6">
          <div>
            <h2 class="text-2xl font-bold mb-2">Quick Start Templates</h2>
            <p class="text-gray-600">Choose a template to get started quickly</p>
          </div>
          <button
            onclick={handleClose}
            class="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X class="w-6 h-6" strokeWidth={2} />
          </button>
        </div>

        <!-- Search and Filter -->
        <div class="mb-6 space-y-4">
          <input
            type="text"
            placeholder="Search templates..."
            bind:value={searchQuery}
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <div class="flex gap-2 flex-wrap">
            {#each categories as category}
              <button
                onclick={() => (selectedCategory = category)}
                class="px-4 py-2 rounded-full text-sm font-medium transition-colors"
                class:bg-blue-500={selectedCategory === category}
                class:text-white={selectedCategory === category}
                class:bg-gray-100={selectedCategory !== category}
                class:hover:bg-gray-200={selectedCategory !== category}
              >
                {category}
              </button>
            {/each}
          </div>
        </div>

        <!-- Templates Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2">
          {#each filteredTemplates as template}
            <button
              onclick={() => handleSelect(template)}
              class="text-left p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all group"
            >
              <div class="flex items-start gap-3">
                <div class="shrink-0">
                  {#if iconMap[template.icon]}
                    {@const Icon = iconMap[template.icon]}
                    <Icon class="w-8 h-8 text-gray-600" strokeWidth={1.5} />
                  {:else}
                    <Check class="w-8 h-8 text-gray-600" strokeWidth={1.5} />
                  {/if}
                </div>
                <div class="flex-1">
                  <h3 class="font-semibold mb-1 group-hover:text-blue-600 transition-colors">
                    {template.name}
                  </h3>
                  <p class="text-sm text-gray-600 mb-3">{template.description}</p>
                  <div class="flex flex-wrap gap-1">
                    {#each template.tags as tag}
                      <span class="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                        {tag}
                      </span>
                    {/each}
                  </div>
                </div>
              </div>
            </button>
          {:else}
            <div class="col-span-2 text-center py-12 text-gray-500">
              No templates found matching your search.
            </div>
          {/each}
        </div>

        <!-- Footer -->
        <div class="mt-6 pt-6 border-t border-gray-200">
          <div class="flex justify-between items-center">
            <p class="text-sm text-gray-500">
              {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''} available
            </p>
            <Button variant="ghost" onclick={handleClose}>Close</Button>
          </div>
        </div>
      </div>
    </Card>
  </div>
</div>

<style>
  /* Custom scrollbar */
  .overflow-y-auto::-webkit-scrollbar {
    width: 8px;
  }

  .overflow-y-auto::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 4px;
  }

  .overflow-y-auto::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 4px;
  }

  .overflow-y-auto::-webkit-scrollbar-thumb:hover {
    background: #555;
  }
</style>
