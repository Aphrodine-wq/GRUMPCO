<script lang="ts">
  /**
   * GAgentLiveOutput - Real-time execution output panel
   * Shows tool calls, streaming output, and execution timeline
   */
  import type { ComponentType } from 'svelte';
  import {
    FileText,
    PenTool,
    Edit3,
    File,
    Trash2,
    Folder,
    Search,
    Terminal,
    GitBranch,
    Package,
    Container,
    Globe,
    Plug,
    Database,
    CheckCircle,
    Zap,
    Clipboard,
    Play,
    Circle,
    X,
    ArrowRight,
    Check,
  } from 'lucide-svelte';

  interface ToolCall {
    id: string;
    taskId: string;
    toolName: string;
    input: Record<string, unknown>;
    output?: string;
    success?: boolean;
    timestamp: number;
    duration?: number;
  }

  interface ExecutionEvent {
    type: string;
    taskId?: string;
    message?: string;
    timestamp: number;
  }

  interface Props {
    isExecuting?: boolean;
    currentTaskId?: string;
    onClose?: () => void;
  }

  let { isExecuting = false, currentTaskId: _currentTaskId = '', onClose }: Props = $props();

  let toolCalls = $state<ToolCall[]>([]);
  let events = $state<ExecutionEvent[]>([]);
  let autoScroll = $state(true);
  let filter = $state<'all' | 'tools' | 'events'>('all');
  let outputRef: HTMLDivElement | null = null;

  // Tool icon mappings
  const toolIconMap: Record<string, ComponentType> = {
    read_file: FileText,
    write_file: PenTool,
    edit_file: Edit3,
    create_file: File,
    delete_file: Trash2,
    list_directory: Folder,
    search_files: Search,
    bash: Terminal,
    terminal: Terminal,
    git: GitBranch,
    npm: Package,
    docker: Container,
    browser: Globe,
    api_call: Plug,
    database: Database,
    test: CheckCircle,
    default: Zap,
  };

  function getToolIcon(toolName: string): ComponentType {
    const lowerName = toolName.toLowerCase();
    for (const [key, icon] of Object.entries(toolIconMap)) {
      if (lowerName.includes(key)) return icon;
    }
    return toolIconMap.default;
  }

  function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }

  function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  function truncateOutput(output: string, maxLen = 200): string {
    if (output.length <= maxLen) return output;
    return output.slice(0, maxLen) + '...';
  }

  // Add a tool call (called from parent via binding)
  export function addToolCall(call: Omit<ToolCall, 'id' | 'timestamp'>) {
    const newCall: ToolCall = {
      ...call,
      id: `tc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
    };
    toolCalls = [...toolCalls, newCall];
    scrollToBottom();
  }

  // Update a tool call with result
  export function updateToolCall(
    taskId: string,
    toolName: string,
    output: string,
    success: boolean
  ) {
    toolCalls = toolCalls.map((tc) => {
      if (tc.taskId === taskId && tc.toolName === toolName && !tc.output) {
        return {
          ...tc,
          output,
          success,
          duration: Date.now() - tc.timestamp,
        };
      }
      return tc;
    });
    scrollToBottom();
  }

  // Add an event
  export function addEvent(type: string, message: string, taskId?: string) {
    const event: ExecutionEvent = {
      type,
      message,
      taskId,
      timestamp: Date.now(),
    };
    events = [...events, event];
    scrollToBottom();
  }

  // Clear all
  export function clear() {
    toolCalls = [];
    events = [];
  }

  function scrollToBottom() {
    if (autoScroll && outputRef) {
      setTimeout(() => {
        outputRef?.scrollTo({ top: outputRef.scrollHeight, behavior: 'smooth' });
      }, 50);
    }
  }

  function getFilteredItems() {
    const items: Array<{
      type: 'tool' | 'event';
      data: ToolCall | ExecutionEvent;
      timestamp: number;
    }> = [];

    if (filter === 'all' || filter === 'tools') {
      for (const tc of toolCalls) {
        items.push({ type: 'tool', data: tc, timestamp: tc.timestamp });
      }
    }

    if (filter === 'all' || filter === 'events') {
      for (const ev of events) {
        items.push({ type: 'event', data: ev, timestamp: ev.timestamp });
      }
    }

    return items.sort((a, b) => a.timestamp - b.timestamp);
  }
</script>

<div class="live-output-panel">
  <div class="panel-header">
    <div class="header-left">
      <span class="panel-icon">
        {#if isExecuting}
          <Zap size={18} />
        {:else}
          <Clipboard size={18} />
        {/if}
      </span>
      <h3>Live Execution</h3>
      {#if isExecuting}
        <span class="live-badge">
          <span class="pulse"></span>
          LIVE
        </span>
      {/if}
    </div>

    <div class="header-controls">
      <div class="filter-tabs">
        <button class:active={filter === 'all'} onclick={() => (filter = 'all')}>All</button>
        <button class:active={filter === 'tools'} onclick={() => (filter = 'tools')}
          >Tools ({toolCalls.length})</button
        >
        <button class:active={filter === 'events'} onclick={() => (filter = 'events')}
          >Events ({events.length})</button
        >
      </div>

      <label class="auto-scroll">
        <input type="checkbox" bind:checked={autoScroll} />
        Auto-scroll
      </label>

      {#if onClose}
        <button class="close-btn" onclick={onClose}>✕</button>
      {/if}
    </div>
  </div>

  <div class="output-container" bind:this={outputRef}>
    {#if getFilteredItems().length === 0}
      <div class="empty-state">
        {#if isExecuting}
          <div class="waiting-animation">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </div>
          <p>Waiting for execution output...</p>
        {:else}
          <p>No execution output yet. Start a plan to see live updates.</p>
        {/if}
      </div>
    {:else}
      {#each getFilteredItems() as item}
        {#if item.type === 'tool'}
          {@const tc = item.data as ToolCall}
          <div
            class="tool-call"
            class:success={tc.success === true}
            class:failed={tc.success === false}
            class:pending={tc.success === undefined}
          >
            <div class="tool-header">
              <span class="tool-icon">
                {#if getToolIcon(tc.toolName)}
                  {@const ToolIcon = getToolIcon(tc.toolName)}
                  <ToolIcon size={16} />
                {/if}
              </span>
              <span class="tool-name">{tc.toolName}</span>
              <span class="task-tag">{tc.taskId}</span>
              <span class="timestamp">{formatTime(tc.timestamp)}</span>
              {#if tc.duration}
                <span class="duration">{formatDuration(tc.duration)}</span>
              {/if}
              {#if tc.success !== undefined}
                <span class="status-icon">
                  {#if tc.success}
                    <Check size={14} />
                  {:else}
                    <X size={14} />
                  {/if}
                </span>
              {:else}
                <span class="spinner"></span>
              {/if}
            </div>

            {#if Object.keys(tc.input).length > 0}
              <div class="tool-input">
                <span class="label">Input:</span>
                <code>{JSON.stringify(tc.input, null, 0).slice(0, 150)}</code>
              </div>
            {/if}

            {#if tc.output}
              <div class="tool-output" class:error={!tc.success}>
                <span class="label">Output:</span>
                <pre>{truncateOutput(tc.output)}</pre>
              </div>
            {/if}
          </div>
        {:else}
          {@const ev = item.data as ExecutionEvent}
          <div
            class="event-item"
            class:highlight={ev.type.includes('started') || ev.type.includes('completed')}
          >
            <span class="event-icon">
              {#if ev.type.includes('started')}
                <Play size={12} />
              {:else if ev.type.includes('completed')}
                <Circle size={12} />
              {:else if ev.type.includes('failed')}
                <X size={12} />
              {:else}
                <ArrowRight size={12} />
              {/if}
            </span>
            <span class="event-type">{ev.type}</span>
            {#if ev.taskId}
              <span class="task-tag">{ev.taskId}</span>
            {/if}
            <span class="event-message">{ev.message}</span>
            <span class="timestamp">{formatTime(ev.timestamp)}</span>
          </div>
        {/if}
      {/each}
    {/if}
  </div>

  {#if toolCalls.length > 0 || events.length > 0}
    <div class="panel-footer">
      <span class="stats">
        {toolCalls.length} tool calls • {events.length} events
      </span>
      <button class="clear-btn" onclick={clear}>Clear</button>
    </div>
  {/if}
</div>

<style>
  .live-output-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #1a1a2e;
    border-radius: 8px;
    overflow: hidden;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 13px;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: #16162a;
    border-bottom: 1px solid #2a2a4a;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .panel-icon {
    font-size: 18px;
  }

  .panel-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: #e0e0e0;
  }

  .live-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 8px;
    background: #dc2626;
    color: white;
    font-size: 10px;
    font-weight: 700;
    border-radius: 4px;
    letter-spacing: 0.5px;
  }

  .pulse {
    width: 6px;
    height: 6px;
    background: white;
    border-radius: 50%;
    animation: pulse 1s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.5;
      transform: scale(0.8);
    }
  }

  .header-controls {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .filter-tabs {
    display: flex;
    gap: 2px;
    background: #0d0d1a;
    padding: 2px;
    border-radius: 6px;
  }

  .filter-tabs button {
    padding: 4px 10px;
    background: transparent;
    border: none;
    color: #888;
    font-size: 11px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .filter-tabs button.active {
    background: #3b82f6;
    color: white;
  }

  .filter-tabs button:hover:not(.active) {
    color: #e0e0e0;
  }

  .auto-scroll {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: #888;
    cursor: pointer;
  }

  .auto-scroll input {
    width: 14px;
    height: 14px;
  }

  .close-btn {
    padding: 4px 8px;
    background: transparent;
    border: none;
    color: #888;
    font-size: 16px;
    cursor: pointer;
    border-radius: 4px;
  }

  .close-btn:hover {
    background: #2a2a4a;
    color: #e0e0e0;
  }

  .output-container {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #666;
    gap: 12px;
  }

  .waiting-animation {
    display: flex;
    gap: 6px;
  }

  .waiting-animation .dot {
    width: 8px;
    height: 8px;
    background: #3b82f6;
    border-radius: 50%;
    animation: bounce 1.4s infinite ease-in-out both;
  }

  .waiting-animation .dot:nth-child(1) {
    animation-delay: -0.32s;
  }
  .waiting-animation .dot:nth-child(2) {
    animation-delay: -0.16s;
  }

  @keyframes bounce {
    0%,
    80%,
    100% {
      transform: scale(0);
    }
    40% {
      transform: scale(1);
    }
  }

  .tool-call {
    background: #0d0d1a;
    border-radius: 6px;
    padding: 10px;
    border-left: 3px solid #3b82f6;
    transition: all 0.3s;
  }

  .tool-call.success {
    border-left-color: #10b981;
  }

  .tool-call.failed {
    border-left-color: #ef4444;
    background: #1a0d0d;
  }

  .tool-call.pending {
    animation: glow 2s ease-in-out infinite;
  }

  @keyframes glow {
    0%,
    100% {
      box-shadow: 0 0 5px rgba(59, 130, 246, 0.3);
    }
    50% {
      box-shadow: 0 0 15px rgba(59, 130, 246, 0.5);
    }
  }

  .tool-header {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .tool-icon {
    font-size: 16px;
  }

  .tool-name {
    font-weight: 600;
    color: #e0e0e0;
  }

  .task-tag {
    padding: 2px 6px;
    background: #2a2a4a;
    color: #888;
    font-size: 10px;
    border-radius: 4px;
  }

  .timestamp {
    color: #555;
    font-size: 11px;
    margin-left: auto;
  }

  .duration {
    padding: 2px 6px;
    background: #1a1a2e;
    color: #10b981;
    font-size: 10px;
    border-radius: 4px;
  }

  .status-icon {
    font-size: 14px;
  }

  .tool-call.success .status-icon {
    color: #10b981;
  }
  .tool-call.failed .status-icon {
    color: #ef4444;
  }

  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid #2a2a4a;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .tool-input,
  .tool-output {
    margin-top: 8px;
    font-size: 11px;
  }

  .tool-input .label,
  .tool-output .label {
    color: #666;
    margin-right: 6px;
  }

  .tool-input code {
    color: #888;
    background: #1a1a2e;
    padding: 2px 6px;
    border-radius: 4px;
    word-break: break-all;
  }

  .tool-output pre {
    margin: 4px 0 0;
    padding: 8px;
    background: #1a1a2e;
    border-radius: 4px;
    color: #a0a0a0;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 100px;
    overflow-y: auto;
  }

  .tool-output.error pre {
    color: #ef4444;
    background: #1a0d0d;
  }

  .event-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: #0d0d1a;
    border-radius: 4px;
    color: #888;
    font-size: 11px;
  }

  .event-item.highlight {
    background: #1a1a2e;
    color: #e0e0e0;
  }

  .event-icon {
    font-size: 12px;
  }

  .event-type {
    font-weight: 600;
    color: #3b82f6;
  }

  .event-message {
    flex: 1;
  }

  .panel-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 16px;
    background: #16162a;
    border-top: 1px solid #2a2a4a;
  }

  .stats {
    color: #666;
    font-size: 11px;
  }

  .clear-btn {
    padding: 4px 12px;
    background: #2a2a4a;
    border: none;
    color: #888;
    font-size: 11px;
    border-radius: 4px;
    cursor: pointer;
  }

  .clear-btn:hover {
    background: #3a3a5a;
    color: #e0e0e0;
  }
</style>
