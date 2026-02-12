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
    Clock,
    Container,
    Cog,
    Cloud,
    Plug,
    DollarSign,
    Settings,
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

  let { open = false, onClose }: Props = $props();

  let searchQuery = $state('');
  let selectedIndex = $state(0);
  let commands: Command[] = $state([]);
  let searchInput: HTMLInputElement | null = $state(null);

  // Derive filtered commands reactively — avoids the infinite $effect loop
  // that was caused by reading + writing $state inside $effect.
  const filteredCommands = $derived.by(() => {
    if (!searchQuery.trim()) return commands;
    return commands.filter(
      (cmd) =>
        fuzzyMatch(searchQuery, cmd.label) ||
        fuzzyMatch(searchQuery, cmd.category) ||
        fuzzyMatch(searchQuery, categoryLabels[cmd.category])
    );
  });

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
      // Build
      {
        id: 'view-gAgent',
        label: 'Agent',
        category: 'build',
        icon: Bot,
        action: () => {
          setCurrentView('gAgent');
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
          setCurrentView('memory');
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
          setCurrentView('gAgent');
          close();
        },
      },
      {
        id: 'view-memory',
        label: 'Knowledge',
        category: 'ai',
        icon: Brain,
        action: () => {
          setCurrentView('memory');
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
          window.dispatchEvent(
            new CustomEvent('insert-saved-prompt', { detail: { text: p.text } })
          );
          setCurrentView('chat');
          focusChatTrigger.update((n) => n + 1);
          close();
        },
      });
    }
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

  // Clamp selectedIndex when filteredCommands changes length
  $effect(() => {
    if (filteredCommands.length === 0) {
      selectedIndex = 0;
    } else if (selectedIndex >= filteredCommands.length) {
      selectedIndex = filteredCommands.length - 1;
    }
  });

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

  // Reset selectedIndex when search query changes
  $effect(() => {
    searchQuery; // track
    selectedIndex = 0;
  });

  $effect(() => {
    if (open && searchInput) {
      requestAnimationFrame(() => searchInput?.focus());
    }
  });

  // Only initialize when opening (avoids effect_update_depth from reactive loops)
  let prevOpen = false;
  $effect(() => {
    if (open && !prevOpen) {
      initializeCommands();
      prevOpen = true;
    } else if (!open) {
      prevOpen = false;
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
      onkeydown={handleKeydown}
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
    background: var(--color-bg-card);
    border-radius: 8px;
    box-shadow: 0 8px 32px rgba(124, 58, 237, 0.15);
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
    background: var(--color-bg-subtle);
    border-radius: 6px;
    font-family: inherit;
    font-size: 0.875rem;
    color: var(--color-text);
    outline: none;
    border: 1px solid rgba(124, 58, 237, 0.2);
  }

  .command-palette-input:focus {
    box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.35);
  }

  .command-palette-input::placeholder {
    color: var(--color-text-muted);
  }

  .command-palette-list {
    max-height: 400px;
    overflow-y: auto;
    padding: 0.5rem 0;
  }

  .command-palette-empty {
    padding: 2rem;
    text-align: center;
    color: var(--color-text-muted);
    font-size: 0.875rem;
  }

  .command-category-header {
    padding: 6px 1rem;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-primary-hover);
    background: var(--color-bg-subtle);
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
    color: var(--color-text);
    font-size: 0.875rem;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s;
  }

  .command-item:hover,
  .command-item.selected {
    background: var(--color-bg-subtle);
  }

  .command-item .command-icon {
    color: var(--color-primary, #7c3aed);
  }

  .command-icon {
    font-size: 1.125rem;
    flex-shrink: 0;
  }

  .command-label {
    flex: 1;
  }

  .command-shortcut {
    color: var(--color-primary-hover);
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    background: var(--color-bg-inset);
    border-radius: 4px;
  }

  .command-palette-footer {
    display: flex;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: var(--color-bg-subtle);
    border-top: 1px solid rgba(124, 58, 237, 0.15);
  }

  .command-hint {
    color: var(--color-primary-hover);
    font-size: 0.75rem;
  }
</style>
