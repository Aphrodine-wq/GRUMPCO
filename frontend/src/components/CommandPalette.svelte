<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { ComponentType } from 'svelte';
  import { chatModeStore } from '../stores/chatModeStore';
  import { setCurrentView, focusChatTrigger } from '../stores/uiStore';
  import { getSavedPrompts } from '../stores/savedPromptsStore';
  import {
    MessageSquare,
    Clipboard,
    FileText,
    Rocket,
    Palette,
    Code2,
    Bot,
    Layout,
    Mic,
    MessagesSquare,
    BookOpen,
    Blocks,
    Users,
    Brain,
    Check,
    Clock,
    Container,
    Cog,
    Cloud,
    Plug,
    DollarSign,
    Settings,
    BarChart2,
    Wrench,
    RefreshCw,
    Trash2,
    Save,
    FolderOpen,
    Keyboard,
  } from 'lucide-svelte';

  type CommandCategory =
    | 'build'
    | 'tools'
    | 'ai'
    | 'infra'
    | 'manage'
    | 'settings'
    | 'actions'
    | 'modes';

  interface Command {
    id: string;
    label: string;
    category: CommandCategory;
    icon: ComponentType;
    shortcut?: string;
    action: () => void | Promise<void>;
  }

  interface Props {
    open?: boolean;
    onClose?: () => void;
  }

  let { open = $bindable(false), onClose }: Props = $props();

  let searchQuery = $state('');
  let selectedIndex = $state(0);
  let commands: Command[] = $state([]);
  let filteredCommands: Command[] = $state([]);
  let searchInput: HTMLInputElement | null = $state(null);

  const categoryLabels: Record<CommandCategory, string> = {
    modes: 'Modes',
    build: 'Build',
    tools: 'Tools',
    ai: 'AI',
    infra: 'Infra',
    manage: 'Manage',
    settings: 'Settings',
    actions: 'Actions',
  };

  // Initialize commands
  function initializeCommands() {
    commands = [
      // Modes
      {
        id: 'switch-argument',
        label: 'Argument',
        category: 'modes',
        icon: MessageSquare,
        action: () => {
          chatModeStore.setMode('argument');
          setCurrentView('chat');
          close();
        },
      },
      {
        id: 'switch-plan',
        label: 'Plan',
        category: 'modes',
        icon: Clipboard,
        action: () => {
          chatModeStore.setMode('code');
          window.dispatchEvent(new CustomEvent('switch-plan-mode'));
          setCurrentView('chat');
          close();
        },
      },
      {
        id: 'switch-spec',
        label: 'Spec',
        category: 'modes',
        icon: FileText,
        action: () => {
          chatModeStore.setMode('code');
          window.dispatchEvent(new CustomEvent('switch-spec-mode'));
          setCurrentView('chat');
          close();
        },
      },
      {
        id: 'open-ship-mode',
        label: 'SHIP',
        category: 'modes',
        icon: Rocket,
        action: () => {
          window.dispatchEvent(new CustomEvent('open-ship-mode'));
          setCurrentView('chat');
          close();
        },
      },
      {
        id: 'switch-design',
        label: 'Design',
        category: 'modes',
        icon: Palette,
        action: () => {
          chatModeStore.setMode('design');
          setCurrentView('chat');
          close();
        },
      },
      {
        id: 'switch-code',
        label: 'Code',
        category: 'modes',
        icon: Code2,
        action: () => {
          chatModeStore.setMode('code');
          setCurrentView('chat');
          close();
        },
      },
      // Build
      {
        id: 'view-freeAgent',
        label: 'G-Agent',
        category: 'build',
        icon: Bot,
        action: () => {
          setCurrentView('freeAgent');
          close();
        },
      },
      {
        id: 'view-designToCode',
        label: 'Design to code',
        category: 'build',
        icon: Layout,
        action: () => {
          setCurrentView('designToCode');
          close();
        },
      },
      // Tools
      {
        id: 'view-voiceCode',
        label: 'Voice code',
        category: 'tools',
        icon: Mic,
        action: () => {
          setCurrentView('voiceCode');
          close();
        },
      },
      {
        id: 'view-talkMode',
        label: 'Talk Mode',
        category: 'tools',
        icon: MessagesSquare,
        action: () => {
          setCurrentView('talkMode');
          close();
        },
      },
      {
        id: 'view-askDocs',
        label: 'Ask docs',
        category: 'tools',
        icon: BookOpen,
        action: () => {
          setCurrentView('askDocs');
          close();
        },
      },
      {
        id: 'view-skills',
        label: 'Skills',
        category: 'tools',
        icon: Blocks,
        action: () => {
          setCurrentView('skills');
          close();
        },
      },
      // AI
      {
        id: 'view-swarm',
        label: 'Agent swarm',
        category: 'ai',
        icon: Users,
        action: () => {
          setCurrentView('swarm');
          close();
        },
      },
      {
        id: 'view-memory',
        label: 'Memory',
        category: 'ai',
        icon: Brain,
        action: () => {
          setCurrentView('memory');
          close();
        },
      },
      {
        id: 'view-approvals',
        label: 'Approvals',
        category: 'ai',
        icon: Check,
        action: () => {
          setCurrentView('approvals');
          close();
        },
      },
      {
        id: 'view-heartbeats',
        label: 'Scheduled tasks',
        category: 'ai',
        icon: Clock,
        action: () => {
          setCurrentView('heartbeats');
          close();
        },
      },
      // Infra
      {
        id: 'view-docker',
        label: 'Docker',
        category: 'infra',
        icon: Container,
        action: () => {
          setCurrentView('docker');
          close();
        },
      },
      {
        id: 'view-docker-setup',
        label: 'Docker setup',
        category: 'infra',
        icon: Cog,
        action: () => {
          setCurrentView('docker-setup');
          close();
        },
      },
      {
        id: 'view-cloud',
        label: 'Cloud',
        category: 'infra',
        icon: Cloud,
        action: () => {
          setCurrentView('cloud');
          close();
        },
      },
      {
        id: 'view-integrations',
        label: 'Integrations',
        category: 'infra',
        icon: Plug,
        action: () => {
          setCurrentView('integrations');
          close();
        },
      },
      // Manage
      {
        id: 'view-cost',
        label: 'Cost dashboard',
        category: 'manage',
        icon: DollarSign,
        action: () => {
          setCurrentView('cost');
          close();
        },
      },
      {
        id: 'view-auditLog',
        label: 'Audit log',
        category: 'manage',
        icon: Clipboard,
        action: () => {
          setCurrentView('auditLog');
          close();
        },
      },
      {
        id: 'view-advancedAI',
        label: 'Advanced AI',
        category: 'manage',
        icon: Brain,
        action: () => {
          setCurrentView('advancedAI');
          close();
        },
      },
      // Settings
      {
        id: 'view-settings',
        label: 'Settings',
        category: 'settings',
        icon: Settings,
        shortcut: 'Ctrl+,',
        action: () => {
          setCurrentView('settings');
          close();
        },
      },
      {
        id: 'view-model-benchmark',
        label: 'Model benchmark',
        category: 'settings',
        icon: BarChart2,
        action: () => {
          setCurrentView('model-benchmark');
          close();
        },
      },
      {
        id: 'view-troubleshooting',
        label: 'Troubleshooting',
        category: 'settings',
        icon: Wrench,
        action: () => {
          setCurrentView('troubleshooting');
          close();
        },
      },
      {
        id: 'view-reset',
        label: 'Reset settings',
        category: 'settings',
        icon: RefreshCw,
        action: () => {
          setCurrentView('reset');
          close();
        },
      },
      // Actions
      {
        id: 'clear-chat',
        label: 'Clear Chat',
        category: 'actions',
        icon: Trash2,
        action: () => {
          window.dispatchEvent(new CustomEvent('clear-chat'));
          close();
        },
      },
      {
        id: 'save-session',
        label: 'Save Session',
        category: 'actions',
        icon: Save,
        shortcut: 'Ctrl+S',
        action: () => {
          window.dispatchEvent(new CustomEvent('save-session'));
          close();
        },
      },
      {
        id: 'load-session',
        label: 'Load Session',
        category: 'actions',
        icon: FolderOpen,
        action: () => {
          window.dispatchEvent(new CustomEvent('load-session'));
          close();
        },
      },
      {
        id: 'focus-input',
        label: 'Focus Chat Input',
        category: 'actions',
        icon: Keyboard,
        shortcut: 'Ctrl+Shift+L',
        action: () => {
          focusChatTrigger.update((n) => n + 1);
          close();
        },
      },
      {
        id: 'save-current-prompt',
        label: 'Save current prompt',
        category: 'actions',
        icon: Save,
        action: () => {
          window.dispatchEvent(new CustomEvent('save-current-prompt'));
          setCurrentView('chat');
          close();
        },
      },
    ];

    // Dynamic: Insert saved prompt (one command per saved prompt)
    const saved = getSavedPrompts();
    for (const p of saved) {
      const label = p.label || (p.text.length > 45 ? p.text.slice(0, 42) + '…' : p.text);
      commands.push({
        id: `insert-prompt-${p.id}`,
        label: `Insert: ${label}`,
        category: 'actions',
        icon: FileText,
        action: () => {
          window.dispatchEvent(new CustomEvent('insert-saved-prompt', { detail: { text: p.text } }));
          setCurrentView('chat');
          focusChatTrigger.update((n) => n + 1);
          close();
        },
      });
    }

    filteredCommands = commands;
  }

  // Fuzzy search
  function fuzzyMatch(query: string, text: string): boolean {
    const lowerQuery = query.toLowerCase();
    const lowerText = text.toLowerCase();

    if (lowerText.includes(lowerQuery)) return true;

    // Simple fuzzy matching: check if all query chars appear in order
    let queryIndex = 0;
    for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
      if (lowerText[i] === lowerQuery[queryIndex]) {
        queryIndex++;
      }
    }
    return queryIndex === lowerQuery.length;
  }

  function filterCommands() {
    if (!searchQuery.trim()) {
      filteredCommands = commands;
      selectedIndex = 0;
      return;
    }

    filteredCommands = commands.filter(
      (cmd) =>
        fuzzyMatch(searchQuery, cmd.label) ||
        fuzzyMatch(searchQuery, cmd.category) ||
        fuzzyMatch(searchQuery, categoryLabels[cmd.category])
    );
    selectedIndex = Math.min(Math.max(0, selectedIndex), filteredCommands.length - 1);
  }

  type ListItem =
    | { type: 'header'; category: CommandCategory }
    | { type: 'command'; command: Command; index: number };
  const listItems = $derived.by(() => {
    const items: ListItem[] = [];
    const seen = new Set<CommandCategory>();
    let idx = 0;
    for (const cmd of filteredCommands) {
      if (!seen.has(cmd.category)) {
        seen.add(cmd.category);
        items.push({ type: 'header', category: cmd.category });
      }
      items.push({ type: 'command', command: cmd, index: idx++ });
    }
    return items;
  });

  function close() {
    open = false;
    searchQuery = '';
    selectedIndex = 0;
    onClose?.();
  }

  function executeCommand(command: Command) {
    command.action();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!open) return;

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        close();
        break;
      case 'ArrowDown':
        event.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, filteredCommands.length - 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        break;
      case 'Enter':
        event.preventDefault();
        if (filteredCommands[selectedIndex]) {
          executeCommand(filteredCommands[selectedIndex]);
        }
        break;
    }
  }

  $effect(() => {
    filterCommands();
  });

  $effect(() => {
    if (open && searchInput) {
      searchInput.focus();
    }
  });

  $effect(() => {
    if (open) {
      initializeCommands();
    }
  });

  onMount(() => {
    initializeCommands();
    document.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    document.removeEventListener('keydown', handleKeydown);
  });
</script>

{#if open}
  <div
    class="command-palette-overlay"
    role="dialog"
    aria-modal="true"
    aria-label="Command Palette"
    tabindex="-1"
    onclick={close}
    onkeydown={(e) => e.key === 'Escape' && close()}
  >
    <div
      class="command-palette"
      role="menu"
      tabindex="0"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      <div class="command-palette-header">
        <input
          bind:this={searchInput}
          bind:value={searchQuery}
          type="text"
          placeholder="Type a command or search..."
          class="command-palette-input"
          autocomplete="off"
          role="combobox"
          aria-expanded="true"
          aria-autocomplete="list"
          aria-controls="command-list"
        />
      </div>
      <div class="command-palette-list" role="listbox" id="command-list">
        {#if filteredCommands.length === 0}
          <div class="command-palette-empty">No commands found</div>
        {:else}
          {#each listItems as item}
            {#if item.type === 'header'}
              <div class="command-category-header">{categoryLabels[item.category]}</div>
            {:else}
              <button
                class="command-item"
                class:selected={item.index === selectedIndex}
                onclick={() => executeCommand(item.command)}
                onmouseenter={() => (selectedIndex = item.index)}
                role="option"
                aria-selected={item.index === selectedIndex}
              >
                <span class="command-icon">
                  {#if item.command.icon}
                    {@const IconC = item.command.icon}
                    <IconC size={18} />
                  {/if}
                </span>
                <span class="command-label">{item.command.label}</span>
                {#if item.command.shortcut}
                  <span class="command-shortcut">{item.command.shortcut}</span>
                {/if}
              </button>
            {/if}
          {/each}
        {/if}
      </div>
      <div class="command-palette-footer">
        <span class="command-hint">↑↓ Navigate</span>
        <span class="command-hint">↵ Select</span>
        <span class="command-hint">Esc Close</span>
        <span class="command-hint">/ Focus input</span>
        <span class="command-hint">Ctrl+B Sidebar</span>
      </div>
    </div>
  </div>
{/if}

<style>
  .command-palette-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 10vh;
    z-index: 10000;
    animation: fadeIn 0.15s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .command-palette {
    width: 100%;
    max-width: 600px;
    background: #1a1a1a;
    border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    overflow: hidden;
    animation: slideDown 0.2s ease-out;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .command-palette-header {
    padding: 1rem;
  }

  .command-palette-input {
    width: 100%;
    padding: 0.75rem 1rem;
    background: #f0f0f0;
    border-radius: 6px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    color: #000;
    outline: none;
  }

  .command-palette-input:focus {
    box-shadow: 0 0 0 2px rgba(0, 102, 255, 0.35);
  }

  .command-palette-input::placeholder {
    color: #9ca3af;
  }

  .command-palette-list {
    max-height: 400px;
    overflow-y: auto;
    padding: 0.5rem 0;
  }

  .command-palette-empty {
    padding: 2rem;
    text-align: center;
    color: #6b7280;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
  }

  .command-category-header {
    padding: 6px 1rem;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #9ca3af;
    background: #262626;
    margin-top: 4px;
  }

  .command-category-header:first-child {
    margin-top: 0;
  }

  .command-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.75rem 1rem;
    background: transparent;
    border: none;
    color: #e5e5e5;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s;
  }

  .command-item:hover,
  .command-item.selected {
    background: #262626;
  }

  .command-icon {
    font-size: 1.125rem;
    flex-shrink: 0;
  }

  .command-label {
    flex: 1;
  }

  .command-shortcut {
    color: #6b7280;
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    background: #262626;
    border-radius: 4px;
  }

  .command-palette-footer {
    display: flex;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: #0d0d0d;
  }

  .command-hint {
    color: #6b7280;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
  }
</style>
