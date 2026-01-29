<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { chatModeStore } from '../stores/chatModeStore';
  import { showSettings } from '../stores/uiStore';
  import { get } from 'svelte/store';

  interface Command {
    id: string;
    label: string;
    category: 'navigation' | 'actions' | 'settings';
    icon: string;
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

  // Initialize commands
  function initializeCommands() {
    commands = [
      {
        id: 'switch-design',
        label: 'Switch to Design Mode',
        category: 'navigation',
        icon: '🎨',
        action: () => {
          chatModeStore.setMode('design');
          close();
        },
      },
      {
        id: 'switch-code',
        label: 'Switch to Code Mode',
        category: 'navigation',
        icon: '💻',
        action: () => {
          chatModeStore.setMode('code');
          close();
        },
      },
      {
        id: 'open-ship-mode',
        label: 'Open SHIP Mode',
        category: 'navigation',
        icon: '🚀',
        action: () => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('open-ship-mode'));
          }
          close();
        },
      },
      {
        id: 'clear-chat',
        label: 'Clear Chat',
        category: 'actions',
        icon: '🗑️',
        action: () => {
          // Dispatch event to clear chat
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('clear-chat'));
          }
          close();
        },
      },
      {
        id: 'save-session',
        label: 'Save Session',
        category: 'actions',
        icon: '💾',
        shortcut: 'Ctrl+S',
        action: () => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('save-session'));
          }
          close();
        },
      },
      {
        id: 'load-session',
        label: 'Load Session',
        category: 'actions',
        icon: '📂',
        action: () => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('load-session'));
          }
          close();
        },
      },
      {
        id: 'focus-input',
        label: 'Focus Chat Input',
        category: 'navigation',
        icon: '⌨️',
        shortcut: 'Ctrl+Shift+I',
        action: () => {
          const input = document.querySelector('.message-input') as HTMLInputElement;
          input?.focus();
          close();
        },
      },
      {
        id: 'open-settings',
        label: 'Open Settings',
        category: 'settings',
        icon: '⚙️',
        shortcut: 'Ctrl+,',
        action: () => {
          showSettings.set(true);
          close();
        },
      },
      {
        id: 'show-shortcuts',
        label: 'Show Keyboard Shortcuts',
        category: 'settings',
        icon: '⌨️',
        shortcut: 'Ctrl+/',
        action: () => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('show-shortcuts'));
          }
          close();
        },
      },
    ];
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

    filteredCommands = commands.filter(cmd => 
      fuzzyMatch(searchQuery, cmd.label) || 
      fuzzyMatch(searchQuery, cmd.category)
    );
    selectedIndex = Math.min(selectedIndex, filteredCommands.length - 1);
  }

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

  onMount(() => {
    initializeCommands();
    document.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    document.removeEventListener('keydown', handleKeydown);
  });
</script>

{#if open}
  <div class="command-palette-overlay" on:click={close} role="dialog" aria-modal="true" aria-label="Command Palette">
    <div class="command-palette" on:click|stopPropagation role="menu">
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
        />
      </div>
      <div class="command-palette-list" role="listbox">
        {#if filteredCommands.length === 0}
          <div class="command-palette-empty">
            No commands found
          </div>
        {:else}
          {#each filteredCommands as command, index (command.id)}
            <button
              class="command-item"
              class:selected={index === selectedIndex}
              on:click={() => executeCommand(command)}
              on:mouseenter={() => selectedIndex = index}
              role="option"
              aria-selected={index === selectedIndex}
            >
              <span class="command-icon">{command.icon}</span>
              <span class="command-label">{command.label}</span>
              {#if command.shortcut}
                <span class="command-shortcut">
                  {command.shortcut}
                </span>
              {/if}
            </button>
          {/each}
        {/if}
      </div>
      <div class="command-palette-footer">
        <span class="command-hint">↑↓ Navigate</span>
        <span class="command-hint">↵ Select</span>
        <span class="command-hint">Esc Close</span>
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
    background: #F0F0F0;
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
    color: #9CA3AF;
  }

  .command-palette-list {
    max-height: 400px;
    overflow-y: auto;
    padding: 0.5rem 0;
  }

  .command-palette-empty {
    padding: 2rem;
    text-align: center;
    color: #6B7280;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
  }

  .command-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.75rem 1rem;
    background: transparent;
    border: none;
    color: #E5E5E5;
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
    color: #6B7280;
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
    color: #6B7280;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
  }
</style>
