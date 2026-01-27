<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import { get } from 'svelte/store';
  import DiagramRenderer from './DiagramRenderer.svelte';
  import SuggestionChips from './SuggestionChips.svelte';
  import RefinementActions from './RefinementActions.svelte';
  import GRumpBlob from './GRumpBlob.svelte';
  import CodeGenPanel from './CodeGenPanel.svelte';
  import MermaidToCodePanel from './MermaidToCodePanel.svelte';
  import WorkflowPhaseBar from './WorkflowPhaseBar.svelte';
  import WorkflowActions from './WorkflowActions.svelte';
  import ToolCallCard from './ToolCallCard.svelte';
  import ToolResultCard from './ToolResultCard.svelte';
  import { exportAsSvg } from '../lib/mermaid';
  import { trackMessageSent, trackDiagramGenerated, trackError, trackTemplateUsed } from '../lib/analytics';
  import { showToast } from '../stores/toastStore';
  import { processError, logError, type ErrorContext } from '../utils/errorHandler';
  import { retryWithBackoff } from '../utils/retryHandler';
  import { sessionsStore, currentSession } from '../stores/sessionsStore';
  import { chatModeStore } from '../stores/chatModeStore';
  import { workspaceStore } from '../stores/workspaceStore';
  import { codeSessionsStore } from '../stores/codeSessionsStore';
  import { openModal } from '../stores/clarificationStore';
  import { phase, canProceedToPrd, canProceedToCodegen, canDownload, streamArchitecture, streamPrd, startCodeGeneration, downloadProject, reset as resetWorkflow, architecture } from '../stores/workflowStore';
  import { parseAssistantResponse } from '../utils/responseParser';
  import { flattenTextContent } from '../utils/contentParser';
  import { generatePlan, currentPlan, approvePlan, startPlanExecution } from '../stores/planStore';
  import { startSpecSession, currentSession, submitAnswer, generateSpecification } from '../stores/specStore';
  import PlanViewer from './PlanViewer.svelte';
  import SpecMode from './SpecMode.svelte';
  import CommandPalette from './CommandPalette.svelte';
  import type { Message, ContentBlock } from '../types';

  interface Props {
    initialMessages?: Message[];
    key?: number;
  }

  let {
    initialMessages = $bindable(undefined),
    key = $bindable(0)
  }: Props = $props();

  const API_URL = typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL
    ? import.meta.env.VITE_API_URL
    : 'http://localhost:3000/api';
  const API_BASE = API_URL.replace(/\/api\/?$/, '') || 'http://localhost:3000';

  const defaultMessage: Message = {
    role: 'assistant',
    content: "Tell me what you want to build. I'll design the architecture and help you code it section by section.",
  };

  let messages = $state<Message[]>(initialMessages || [defaultMessage]);
  let inputText = $state('');
  let messagesRef: HTMLElement | null = $state(null);
  let inputRef: HTMLInputElement | null = $state(null);
  let streaming = $state(false);
  let streamingContent = $state('');
  let streamingBlocks = $state<ContentBlock[]>([]);
  let diagramRefs: Record<string, HTMLElement> = $state({});
  let lastError = $state(false);
  let lastUserMessage = $state('');
  let activeController: AbortController | null = $state(null);
  let workspaceInput = $state('');
  let chatMode: 'normal' | 'plan' | 'spec' | 'execute' = $state('normal');
  let planMode = $state(false); // Deprecated, kept for backward compatibility
  let agentProfile = $state<string>('general');
  let currentPlanId = $state<string | null>(null);
  let currentSpecSessionId = $state<string | null>(null);
  let commandPaletteOpen = $state(false);
  let isTyping = $state(false);
  let typingTimeout: ReturnType<typeof setTimeout> | null = null;
  let editingMessageIndex = $state<number | null>(null);

  function parseMessageContent(content: string | ContentBlock[]): ContentBlock[] {
    if (Array.isArray(content)) return content;

    const blocks: ContentBlock[] = [];
    const mermaidRegex = /```mermaid\s*([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = mermaidRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        const text = content.slice(lastIndex, match.index).trim();
        if (text) blocks.push({ type: 'text', content: text });
      }
      blocks.push({ type: 'mermaid', content: match[1].trim() });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      const text = content.slice(lastIndex).trim();
      if (text) blocks.push({ type: 'text', content: text });
    }

    if (blocks.length === 0 && typeof content === 'string' && content.trim()) {
      blocks.push({ type: 'text', content: content.trim() });
    }

    return blocks;
  }

  function flattenMessagesForChatApi(msgs: Message[]): Array<{ role: 'user' | 'assistant'; content: string }> {
    return msgs
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: typeof m.content === 'string' ? m.content : flattenTextContent(m.content),
      }))
      .filter((m) => (m.content || '').trim().length > 0);
  }

  function hasMermaidInStream(): boolean {
    return streamingContent.includes('```mermaid');
  }

  function getBuildingPhase(): string {
    const content = streamingContent.toLowerCase();
    if (!content) return 'Understanding your idea...';
    if (content.includes('```mermaid')) return 'Building architecture...';
    if (content.includes('frontend') || content.includes('backend') || content.includes('api')) {
      return 'Designing system...';
    }
    return 'Analyzing requirements...';
  }

  function scrollToBottom() {
    if (messagesRef) {
      messagesRef.scrollTop = messagesRef.scrollHeight;
    }
  }

  // Format timestamp for display
  function formatTimestamp(timestamp?: number): string {
    if (!timestamp) return '';
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return new Date(timestamp).toLocaleDateString();
  }

  // Handle typing indicator
  function handleInputChange() {
    isTyping = true;
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }
    typingTimeout = setTimeout(() => {
      isTyping = false;
    }, 500);
  }

  // Keyboard shortcuts handler
  function handleGlobalKeydown(event: KeyboardEvent) {
    // Ctrl/Cmd + K for command palette
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
      event.preventDefault();
      commandPaletteOpen = !commandPaletteOpen;
      return;
    }

    // Ctrl/Cmd + / for shortcuts help
    if ((event.ctrlKey || event.metaKey) && event.key === '/') {
      event.preventDefault();
      showToast('Keyboard Shortcuts:\nCtrl/Cmd+K: Command Palette\nCtrl/Cmd+/: Show Shortcuts\nEscape: Cancel\nArrow Up: Edit Last Message', 'info', 5000);
      return;
    }

    // Escape to cancel streaming
    if (event.key === 'Escape' && streaming) {
      event.preventDefault();
      cancelGeneration();
      return;
    }

    // Arrow Up to edit last message (when input is focused and empty)
    if (event.key === 'ArrowUp' && document.activeElement === inputRef && !inputText.trim()) {
      event.preventDefault();
      const lastUserMessageIndex = messages.findLastIndex(m => m.role === 'user');
      if (lastUserMessageIndex >= 0) {
        const lastMsg = messages[lastUserMessageIndex];
        if (typeof lastMsg.content === 'string') {
          inputText = lastMsg.content;
          editingMessageIndex = lastUserMessageIndex;
          inputRef?.focus();
        }
      }
    }
  }

  function isLastAssistantMessage(index: number): boolean {
    return index === messages.length - 1 && messages[index].role === 'assistant';
  }

  async function sendMessage() {
    const text = inputText.trim();
    if (!text || streaming) return;

    const mode = get(chatModeStore);
    lastUserMessage = text;
    lastError = false;
    trackMessageSent(text.length);

    // Handle plan mode - generate plan instead of chat
    if (mode === 'code' && chatMode === 'plan') {
      try {
        const ws = workspaceInput.trim() || get(workspaceStore) || undefined;
        const plan = await generatePlan({
          userRequest: text,
          workspaceRoot: ws,
          agentProfile: agentProfile,
        });
        currentPlanId = plan.id;
        inputText = '';
        return;
      } catch (error) {
        console.error('Failed to generate plan:', error);
        showToast('Failed to generate plan', 'error');
        return;
      }
    }

    // Handle spec mode - start spec session
    if (mode === 'code' && chatMode === 'spec') {
      try {
        const ws = workspaceInput.trim() || get(workspaceStore) || undefined;
        const session = await startSpecSession({
          userRequest: text,
          workspaceRoot: ws,
        });
        currentSpecSessionId = session.id;
        inputText = '';
        return;
      } catch (error) {
        console.error('Failed to start spec session:', error);
        showToast('Failed to start spec session', 'error');
        return;
      }
    }

    // If editing, replace the message; otherwise add new
    if (editingMessageIndex !== null && editingMessageIndex >= 0) {
      const updated = [...messages];
      updated[editingMessageIndex] = { 
        role: 'user', 
        content: text,
        timestamp: Date.now()
      };
      messages = updated;
      editingMessageIndex = null;
    } else {
      messages = [...messages, { 
        role: 'user', 
        content: text,
        timestamp: Date.now()
      }];
    }
    inputText = '';
    isTyping = false;
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }
    streaming = true;
    streamingContent = '';
    streamingBlocks = [];
    await tick();
    scrollToBottom();

    const controller = new AbortController();
    activeController = controller;
    const timeoutMs = (mode === 'code' || mode === 'argument') ? 120000 : 60000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      if (mode === 'code' || mode === 'argument') {
        await runCodeModeStream(controller.signal);
      } else {
        await runDesignModeStream(controller.signal);
      }
    } catch (err: any) {
      streaming = false;
      streamingContent = '';
      streamingBlocks = [];
      lastError = true;
      
      // Process error with enhanced handling
      const errorContext = processError(err, async () => {
        // Retry handler
        if (lastUserMessage) {
          inputText = lastUserMessage;
          await tick();
          sendMessage();
        }
      });
      
      logError(errorContext, { 
        mode: get(chatModeStore),
        workspaceRoot: get(workspaceStore),
      });
      trackError('api_error', errorContext.message);
      
      // Show error toast with retry option
      showToast(errorContext.userMessage, 'error', errorContext.retryable ? 0 : 5000, {
        persistent: errorContext.retryable,
        actions: errorContext.recovery,
      });
    } finally {
      clearTimeout(timeoutId);
      activeController = null;
    }
  }

  async function runDesignModeStream(signal: AbortSignal) {
    const text = lastUserMessage;
    
    let response: Response;
    try {
      response = await fetch(`${API_URL}/generate-diagram-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
        signal,
      });
    } catch (err: any) {
      // Network error or abort
      if (err.name === 'AbortError') {
        throw new Error('Request cancelled');
      }
      throw new Error('Network error: Failed to connect to server');
    }
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      const status = response.status;
      throw new Error(`Server error (${status}): ${errorText || 'Unknown error'}`);
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          if (parsed.text) {
            streamingContent += parsed.text;
            await tick();
            scrollToBottom();
          }
        } catch {
          /* ignore */
        }
      }
    }
    const parsed = parseAssistantResponse(streamingContent);
    if (parsed.type === 'clarification' && parsed.clarification) {
      streaming = false;
      streamingContent = '';
      const answers = await openModal(parsed.clarification);
      if (!answers || answers.length === 0) return;
      return;
    }
    messages = [...messages, { 
      role: 'assistant', 
      content: streamingContent,
      timestamp: Date.now()
    }];
    streaming = false;
    streamingContent = '';
    if (parsed.mermaidCode) trackDiagramGenerated('mermaid', true);
    if ($currentSession) sessionsStore.updateSession($currentSession.id, messages);
    else sessionsStore.createSession(messages);
    dispatch('messages-updated', { detail: messages });
  }

  async function runCodeModeStream(signal: AbortSignal) {
    const apiMessages = flattenMessagesForChatApi(messages);
    if (apiMessages.length === 0) throw new Error('No messages to send');
    let ws = workspaceInput.trim() || get(workspaceStore) || undefined;
    if (ws) workspaceStore.setWorkspace(ws);

    let response: Response;
    try {
      response = await fetch(`${API_BASE}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          workspaceRoot: ws || undefined,
          mode: get(chatModeStore) === 'argument' ? 'argument' : (chatMode !== 'normal' ? chatMode : (planMode ? 'plan' : 'normal')),
          planMode: planMode, // Keep for backward compatibility
          planId: currentPlanId || undefined,
          specSessionId: currentSpecSessionId || undefined,
          agentProfile: agentProfile || undefined,
        }),
        signal,
      });
    } catch (err: any) {
      // Network error or abort
      if (err.name === 'AbortError') {
        throw new Error('Request cancelled');
      }
      throw new Error('Network error: Failed to connect to server');
    }
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      const status = response.status;
      throw new Error(`Server error (${status}): ${errorText || 'Unknown error'}`);
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lineList = buffer.split('\n');
      buffer = lineList.pop() || '';
      for (const line of lineList) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6);
        try {
          const ev = JSON.parse(raw) as { type: string; text?: string; message?: string; id?: string; name?: string; input?: Record<string, unknown>; toolName?: string; output?: string; success?: boolean; executionTime?: number; diff?: { filePath: string; beforeContent: string; afterContent: string; changeType: 'created' | 'modified' | 'deleted'; operations?: Array<{ type: string; lineStart: number; lineEnd?: number }> } };
          if (ev.type === 'text' && ev.text) {
            const last = streamingBlocks[streamingBlocks.length - 1];
            if (last?.type === 'text') {
              streamingBlocks = [...streamingBlocks.slice(0, -1), { type: 'text', content: last.content + ev.text }];
            } else {
              streamingBlocks = [...streamingBlocks, { type: 'text', content: ev.text }];
            }
            await tick();
            scrollToBottom();
          } else if (ev.type === 'tool_call' && ev.id && ev.name) {
            streamingBlocks = [...streamingBlocks, { type: 'tool_call', id: ev.id, name: ev.name, input: ev.input ?? {}, status: 'executing' }];
            await tick();
            scrollToBottom();
          } else if (ev.type === 'tool_result' && ev.id && ev.toolName) {
            const idx = streamingBlocks.findIndex((b) => b.type === 'tool_call' && (b as { id: string }).id === ev.id);
            if (idx >= 0) {
              const blk = streamingBlocks[idx] as { type: 'tool_call'; id: string; name: string; input: Record<string, unknown>; status: string };
              const updated = [...streamingBlocks];
              updated[idx] = { ...blk, status: ev.success ? 'success' : 'error' };
              streamingBlocks = updated;
            }
            streamingBlocks = [...streamingBlocks, { type: 'tool_result', id: ev.id, toolName: ev.toolName, output: ev.output ?? '', success: ev.success ?? false, executionTime: ev.executionTime ?? 0, diff: ev.diff }];
            await tick();
            scrollToBottom();
          } else if (ev.type === 'error' && ev.message) {
            const errorContext = processError(new Error(ev.message));
            logError(errorContext, { toolId: ev.id });
            showToast(errorContext.userMessage, 'error', errorContext.retryable ? 0 : 5000, {
              persistent: errorContext.retryable,
              actions: errorContext.recovery,
            });
            throw new Error(ev.message);
          }
        } catch (e) {
          const s = line.slice(6);
          if (typeof s === 'string' && s.trimStart().startsWith('{')) throw e;
        }
      }
    }
    messages = [...messages, { 
      role: 'assistant', 
      content: [...streamingBlocks],
      timestamp: Date.now()
    }];
    streaming = false;
    streamingBlocks = [];
    if ($currentSession) sessionsStore.updateSession($currentSession.id, messages);
    else sessionsStore.createSession(messages);
    dispatch('messages-updated', { detail: messages });
  }

  function cancelGeneration() {
    if (activeController) {
      activeController.abort();
      activeController = null;
    }
    streaming = false;
    streamingContent = '';
    streamingBlocks = [];
  }

  function retryLastMessage() {
    if (lastUserMessage) {
      inputText = lastUserMessage;
      sendMessage();
    }
  }

  function handleTemplateSelect(event: CustomEvent) {
    const template = event.detail;
    inputText = template.prompt;
    trackTemplateUsed(template.id || 'unknown');
    inputRef?.focus();
  }

  function exportSvg(msgIndex: number, blockIndex: number) {
    const key = `${msgIndex}-${blockIndex}`;
    const svgElement = diagramRefs[key]?.querySelector('svg') as SVGElement;
    if (svgElement) {
      exportAsSvg(svgElement, 'diagram.svg');
    }
  }

  function setDiagramRef(el: HTMLElement | null, msgIndex: number, blockIndex: number) {
    if (el) {
      diagramRefs[`${msgIndex}-${blockIndex}`] = el;
    }
  }

  function handleRefinement() {
    // Simplified refinement
    showToast('Refinement feature coming soon', 'info');
  }

  const dispatch = createEventDispatcher();

  // Workflow handlers
  async function handleProceedToPrd() {
    for await (const _ of streamPrd()) {
      // Stream updates handled by store
    }
  }

  async function handleProceedToCodegen() {
    await startCodeGeneration();
  }

  async function handleDownload() {
    await downloadProject();
  }

  function handleWorkflowRefine() {
    showToast('Refinement feature coming soon', 'info');
  }

  function handleWorkflowReset() {
    resetWorkflow();
  }

  function handleSaveCodeSession() {
    const name = typeof window !== 'undefined' && window.prompt
      ? window.prompt('Session name', `Code ${new Date().toLocaleString()}`)
      : null;
    if (name == null) return;
    const ws = workspaceInput.trim() || get(workspaceStore) || null;
    codeSessionsStore.save(name, messages, ws, agentProfile || undefined);
    showToast('Session saved', 'success');
  }

  async function handleMermaidToCode(detail: {
    mermaidCode: string;
    framework: string;
    language: string;
    workspaceRoot?: string;
  }) {
    // Switch to Code mode
    chatModeStore.setMode('code');
    
    // Set workspace if provided
    if (detail.workspaceRoot) {
      workspaceStore.setWorkspace(detail.workspaceRoot);
      workspaceInput = detail.workspaceRoot;
    }

    // Create a message to generate code from the diagram
    const prompt = `Generate ${detail.framework} code in ${detail.language} based on this architecture diagram:\n\n\`\`\`mermaid\n${detail.mermaidCode}\n\`\`\`\n\nCreate a complete project structure with all necessary files.`;
    
    inputText = prompt;
    await tick();
    sendMessage();
  }

  function handleLoadCodeSession(e: Event) {
    const sel = e.currentTarget as HTMLSelectElement;
    const id = sel?.value;
    if (!id) return;
    const session = codeSessionsStore.load(id);
    if (session) {
      messages = JSON.parse(JSON.stringify(session.messages));
      workspaceInput = session.workspaceRoot ?? '';
      if (session.workspaceRoot) workspaceStore.setWorkspace(session.workspaceRoot);
      if (session.agentProfile) agentProfile = session.agentProfile;
      showToast(`Loaded: ${session.name}`, 'success');
    }
    sel.value = '';
  }

  // Handle command palette events
  function handleClearChat() {
    messages = [defaultMessage];
    inputText = '';
    editingMessageIndex = null;
    showToast('Chat cleared', 'info');
  }

  function handleSaveSession() {
    handleSaveCodeSession();
  }

  function handleLoadSession() {
    // Focus the load session select
    const select = document.querySelector('.session-select') as HTMLSelectElement;
    if (select) {
      select.focus();
      select.click();
    }
  }

  function handleShowShortcuts() {
    showToast('Keyboard Shortcuts:\nCtrl/Cmd+K: Command Palette\nCtrl/Cmd+/: Show Shortcuts\nEscape: Cancel\nArrow Up: Edit Last Message', 'info', 8000);
  }

  onMount(() => {
    inputRef?.focus();
    const w = get(workspaceStore);
    if (w) workspaceInput = w;

    // Set up global keyboard shortcuts
    document.addEventListener('keydown', handleGlobalKeydown);

    // Set up command palette event listeners
    if (typeof window !== 'undefined') {
      window.addEventListener('clear-chat', handleClearChat);
      window.addEventListener('save-session', handleSaveSession);
      window.addEventListener('load-session', handleLoadSession);
      window.addEventListener('show-shortcuts', handleShowShortcuts);
    }

    return () => {
      document.removeEventListener('keydown', handleGlobalKeydown);
      if (typeof window !== 'undefined') {
        window.removeEventListener('clear-chat', handleClearChat);
        window.removeEventListener('save-session', handleSaveSession);
        window.removeEventListener('load-session', handleLoadSession);
        window.removeEventListener('show-shortcuts', handleShowShortcuts);
      }
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
    };
  });
</script>

<div class="chat-interface">
  <div class="mode-bar">
    <div class="mode-tabs">
      <button
        type="button"
        class="mode-tab"
        class:active={$chatModeStore === 'design'}
        on:click={() => chatModeStore.setMode('design')}
      >Design</button>
      <button
        type="button"
        class="mode-tab"
        class:active={$chatModeStore === 'code'}
        on:click={() => chatModeStore.setMode('code')}
      >Code</button>
      <button
        type="button"
        class="mode-tab"
        class:active={$chatModeStore === 'argument'}
        on:click={() => chatModeStore.setMode('argument')}
      >Argument</button>
    </div>
    {#if $chatModeStore === 'code' || $chatModeStore === 'argument'}
      <div class="workspace-row">
        <label class="workspace-label">Workspace</label>
        <input
          type="text"
          class="workspace-input"
          placeholder="C:\path\to\project or /home/user/project"
          bind:value={workspaceInput}
          on:blur={() => { const v = workspaceInput.trim(); if (v) workspaceStore.setWorkspace(v); }}
        />
      </div>
      {#if $chatModeStore === 'code'}
      <div class="mode-selector-row">
        <label class="workspace-label">Mode</label>
        <select class="mode-select" bind:value={chatMode} title="Chat mode">
          <option value="normal">Normal</option>
          <option value="plan">Plan Mode</option>
          <option value="spec">Spec Mode</option>
          <option value="execute">Execute Plan</option>
        </select>
      </div>
      {/if}
      <style>
        .mode-selector-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .mode-select {
          flex: 1;
          padding: 0.5rem;
          border: 1px solid #E5E5E5;
          border-radius: 4px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.875rem;
        }
        .plan-section, .spec-section {
          padding: 1rem;
          background: #F9FAFB;
          border-top: 1px solid #E5E5E5;
        }
        .plan-info {
          padding: 0.5rem;
          background: #E0F2FE;
          border-radius: 4px;
          font-size: 0.875rem;
          color: #0C4A6E;
          margin-top: 0.5rem;
        }
      </style>
      {#if chatMode === 'execute' && $currentPlan}
        <div class="plan-info">
          Executing: {$currentPlan.title}
        </div>
      {/if}
      {#if chatMode === 'plan'}
        <label class="plan-mode-check">
          <input type="checkbox" bind:checked={planMode} />
          <span>Legacy plan mode (deprecated)</span>
        </label>
      {/if}
      <div class="agent-profile-row">
        <label class="workspace-label">Agent</label>
        <select class="agent-select" bind:value={agentProfile} title="Specialist profile">
          <option value="general">General</option>
          <option value="router">Router</option>
          <option value="frontend">Frontend</option>
          <option value="backend">Backend</option>
          <option value="devops">DevOps</option>
          <option value="test">Test</option>
        </select>
      </div>
      <div class="session-actions">
        <button type="button" class="session-btn" on:click={handleSaveCodeSession}>Save</button>
        <select class="session-select" on:change={handleLoadCodeSession} title="Load session">
          <option value="">Load session…</option>
          {#each $codeSessionsStore as session}
            <option value={session.id}>{session.name}</option>
          {/each}
        </select>
      </div>
    {/if}
  </div>

  {#if $chatModeStore === 'design'}
    <WorkflowPhaseBar
      phase={$phase}
      progress={0}
    />
  {/if}

  {#if chatMode === 'plan' && $currentPlan}
    <div class="plan-section">
      <PlanViewer plan={$currentPlan} />
    </div>
  {/if}

  {#if chatMode === 'spec' && $currentSession}
    <div class="spec-section">
      <SpecMode />
    </div>
  {/if}

  <div class="messages-container" bind:this={messagesRef}>
    {#if messages.length <= 1 && !streaming}
      <div class="empty-state">
        <GRumpBlob size="lg" state="idle" animated={true} />
        {#if $chatModeStore === 'design'}
          <h2 class="empty-title">What do you want to build?</h2>
          <p class="empty-subtitle">Describe your app idea and I'll help you code it</p>
          <SuggestionChips on:select={handleTemplateSelect} />
        {:else if $chatModeStore === 'argument'}
          <h2 class="empty-title">Argue with me</h2>
          <p class="empty-subtitle">Describe what you want to build or change—I'll push back, suggest alternatives, and only implement when you say so.</p>
        {:else}
          <h2 class="empty-title">Code with tools</h2>
          <p class="empty-subtitle">Set a workspace path, then ask me to run commands, read or edit files</p>
        {/if}
      </div>
    {/if}
    
    <div class="messages-list">
      {#each messages as msg, index (index)}
        <div class="message {msg.role}">
          {#if msg.role === 'user'}
            <div class="message-header">
              <span class="prompt-symbol">&gt;</span>
            </div>
          {/if}
          <div class="message-body">
            {#if msg.timestamp}
              <div class="message-timestamp" title={new Date(msg.timestamp).toLocaleString()}>
                {formatTimestamp(msg.timestamp)}
              </div>
            {/if}
            {#if msg.role === 'assistant'}
              {#each parseMessageContent(msg.content) as block, blockIdx (blockIdx)}
                {#if block.type === 'text'}
                  <div class="text-block">{(block as { content: string }).content}</div>
                {:else if block.type === 'mermaid'}
                  <div class="diagram-block">
                    <div class="diagram-header">
                      <span class="diagram-label">Architecture</span>
                      <div class="diagram-actions">
                        <button on:click={() => exportSvg(index, blockIdx)} class="action-btn" title="Export SVG">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                          </svg>
                        </button>
                      </div>
                    </div>
                    <DiagramRenderer
                      bind:this={(el) => setDiagramRef(el, index, blockIdx)}
                      code={(block as { content: string }).content}
                      architectureMetadata={$architecture?.metadata}
                      on:generate-code={(e) => handleMermaidToCode({ mermaidCode: e.detail.mermaidCode, framework: 'react', language: 'typescript', workspaceRoot: get(workspaceStore) })}
                    />
                    {#if isLastAssistantMessage(index) && !streaming}
                      <RefinementActions on:refine={handleRefinement} />
                      {#if $chatModeStore === 'design'}
                        <MermaidToCodePanel
                          mermaidCode={(block as { content: string }).content}
                          on:generate-code={(e) => handleMermaidToCode(e.detail)}
                        />
                      {:else}
                        <CodeGenPanel mermaidCode={(block as { content: string }).content} />
                      {/if}
                    {/if}
                  </div>
                {:else if block.type === 'tool_call'}
                  <ToolCallCard toolCall={block} />
                {:else if block.type === 'tool_result'}
                  <ToolResultCard toolResult={block} />
                {/if}
              {/each}
            {:else}
              <span class="user-text">{typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}</span>
            {/if}
          </div>
        </div>
      {/each}
      
      {#if streaming}
        <div class="message assistant streaming-message">
          <div class="streaming-progress"></div>
          <div class="streaming-header">
            <GRumpBlob size="sm" state="thinking" animated={true} />
            <span class="streaming-label">
              {($chatModeStore === 'code' || $chatModeStore === 'argument') ? 'Running tools...' : getBuildingPhase()}
            </span>
          </div>
          <div class="message-body">
            {#if $chatModeStore === 'code' || $chatModeStore === 'argument'}
              {#if streamingBlocks.length === 0}
                <span class="thinking-dots"><span>.</span><span>.</span><span>.</span></span>
              {:else}
                {#each streamingBlocks as block, blockIdx (blockIdx)}
                  {#if block.type === 'text'}
                    <div class="text-block">{(block as { content: string }).content}</div>
                  {:else if block.type === 'tool_call'}
                    <ToolCallCard toolCall={block} />
                  {:else if block.type === 'tool_result'}
                    <ToolResultCard toolResult={block} />
                  {/if}
                {/each}
                <span class="cursor">|</span>
              {/if}
            {:else}
              {#if !streamingContent}
                <span class="thinking-dots"><span>.</span><span>.</span><span>.</span></span>
              {:else}
                {#each parseMessageContent(streamingContent) as block, blockIdx (blockIdx)}
                  {#if block.type === 'text'}
                    <div class="text-block">{(block as { content: string }).content}</div>
                  {:else if block.type === 'mermaid'}
                    <div class="building-indicator">
                      <div class="building-animation">
                        <div class="building-blocks">
                          <span class="block b1"></span>
                          <span class="block b2"></span>
                          <span class="block b3"></span>
                        </div>
                        <span class="building-text">Building your architecture...</span>
                      </div>
                    </div>
                  {/if}
                {/each}
              {/if}
              {#if streaming && streamingContent && !hasMermaidInStream()}
                <span class="cursor">|</span>
              {/if}
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </div>
  
  {#if $chatModeStore === 'design'}
    <WorkflowActions
      phase={$phase}
      canProceedToPrd={$canProceedToPrd}
      canProceedToCodegen={$canProceedToCodegen}
      canDownload={$canDownload}
      isStreaming={streaming}
      on:proceed-prd={handleProceedToPrd}
      on:proceed-codegen={handleProceedToCodegen}
      on:download={handleDownload}
      on:refine={handleWorkflowRefine}
      on:reset={handleWorkflowReset}
    />
  {/if}

  <form on:submit|preventDefault={sendMessage} class="input-container">
    <span class="input-prompt">&gt;</span>
    <div class="input-wrapper">
      <input
        bind:value={inputText}
        on:input={handleInputChange}
        type="text"
        placeholder={$chatModeStore === 'code' ? 'e.g. list files in src, add a hello.js script...' : $chatModeStore === 'argument' ? 'e.g. add Auth0 login, switch to Postgres…' : "Describe what you want to build..."}
        disabled={streaming}
        class="message-input"
        bind:this={inputRef}
      />
      {#if isTyping && !streaming}
        <div class="typing-indicator">
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
        </div>
      {/if}
    </div>
    {#if streaming}
      <button type="button" on:click={cancelGeneration} class="cancel-button">
        Stop
      </button>
    {:else}
      <button type="submit" disabled={!inputText.trim()} class="send-button">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
      </button>
    {/if}
    {#if lastError && !streaming}
      <button type="button" on:click={retryLastMessage} class="retry-button">
        Retry
      </button>
      {/if}
    </form>

  <CommandPalette bind:open={commandPaletteOpen} />
</div>

<style>
  .chat-interface {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: #F5F5F5;
  }

  .mode-bar {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.5rem 1rem;
    background: #fff;
    border-bottom: 1px solid #E5E5E5;
    flex-wrap: wrap;
  }

  .mode-tabs {
    display: flex;
    gap: 0.25rem;
  }

  .mode-tab {
    padding: 0.4rem 0.75rem;
    border: 1px solid #E5E5E5;
    border-radius: 4px;
    background: #F5F5F5;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8rem;
    cursor: pointer;
    color: #6B7280;
  }

  .mode-tab:hover {
    background: #EBEBEB;
    border-color: #0066FF;
    color: #0066FF;
  }

  .mode-tab.active {
    background: #0066FF;
    border-color: #0066FF;
    color: #fff;
  }

  .workspace-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
    min-width: 200px;
  }

  .workspace-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    color: #6B7280;
    white-space: nowrap;
  }

  .workspace-input {
    flex: 1;
    padding: 0.4rem 0.6rem;
    border: 1px solid #E5E5E5;
    border-radius: 4px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8rem;
    outline: none;
  }

  .workspace-input:focus {
    border-color: #0066FF;
  }

  .plan-mode-check {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8rem;
    color: #6B7280;
    cursor: pointer;
    white-space: nowrap;
  }
  .plan-mode-check input { cursor: pointer; }

  .agent-profile-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .agent-select {
    padding: 0.35rem 0.6rem;
    border: 1px solid #E5E5E5;
    border-radius: 4px;
    background: #F5F5F5;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8rem;
    color: #374151;
    cursor: pointer;
    min-width: 110px;
  }

  .session-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .session-btn {
    padding: 0.35rem 0.6rem;
    border: 1px solid #E5E5E5;
    border-radius: 4px;
    background: #F5F5F5;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8rem;
    cursor: pointer;
    color: #374151;
  }
  .session-btn:hover {
    background: #EBEBEB;
    border-color: #0066FF;
    color: #0066FF;
  }
  .session-select {
    padding: 0.35rem 0.6rem;
    border: 1px solid #E5E5E5;
    border-radius: 4px;
    background: #F5F5F5;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8rem;
    color: #374151;
    cursor: pointer;
    max-width: 180px;
  }

  .messages-container {
    flex: 1;
    overflow-y: auto;
    padding: 2rem;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 1.5rem;
    text-align: center;
  }

  .empty-title {
    font-family: 'JetBrains Mono', monospace;
    font-size: 1.5rem;
    font-weight: 600;
    color: #000000;
    margin: 0;
  }

  .empty-subtitle {
    font-family: 'JetBrains Mono', monospace;
    font-size: 1rem;
    color: #6B7280;
    margin: 0;
  }

  .messages-list {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .message {
    display: flex;
    gap: 1rem;
    animation: fadeIn 0.3s ease-in;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .message.user {
    justify-content: flex-end;
  }

  .message.assistant {
    justify-content: flex-start;
  }

  .message-header {
    flex-shrink: 0;
  }

  .prompt-symbol {
    font-family: 'JetBrains Mono', monospace;
    color: #0066FF;
    font-size: 1.25rem;
  }

  .message-body {
    max-width: 80%;
  }

  .text-block {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    line-height: 1.7;
    color: #000000;
    white-space: pre-wrap;
    margin: 0.5rem 0;
  }

  .user-text {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    color: #000000;
  }

  .diagram-block {
    margin: 1.5rem 0;
    background: #FFFFFF;
    border: 1px solid #E5E5E5;
    border-radius: 8px;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    animation: slideIn 0.4s ease-out;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(20px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .diagram-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .diagram-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    font-weight: 600;
    color: #000000;
  }

  .diagram-actions {
    display: flex;
    gap: 0.5rem;
  }

  .action-btn {
    background: transparent;
    border: 1px solid #E5E5E5;
    border-radius: 4px;
    padding: 0.25rem 0.5rem;
    cursor: pointer;
    color: #6B7280;
  }

  .action-btn:hover {
    background: #F5F5F5;
    border-color: #0066FF;
    color: #0066FF;
  }

  .streaming-message {
    opacity: 0.9;
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 0.9;
    }
    50% {
      opacity: 0.7;
    }
  }

  .streaming-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .streaming-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    color: #6B7280;
  }

  .thinking-dots {
    display: inline-flex;
    gap: 0.25rem;
  }

  .building-indicator {
    padding: 2rem;
    text-align: center;
  }

  .building-animation {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .building-blocks {
    display: flex;
    gap: 0.5rem;
  }

  .block {
    width: 12px;
    height: 12px;
    background: #0066FF;
    border-radius: 2px;
    animation: bounce 1.4s infinite;
  }

  .block.b1 { animation-delay: 0s; }
  .block.b2 { animation-delay: 0.2s; }
  .block.b3 { animation-delay: 0.4s; }

  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }

  .building-text {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    color: #6B7280;
  }

  .cursor {
    display: inline-block;
    animation: blink 1s infinite;
  }

  @keyframes blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0; }
  }

  .input-container {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    background: #FFFFFF;
    border-top: 1px solid #E5E5E5;
  }

  .input-wrapper {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
  }

  .input-prompt {
    font-family: 'JetBrains Mono', monospace;
    color: #0066FF;
    font-size: 1.25rem;
  }

  .message-input {
    flex: 1;
    padding: 0.75rem 1rem;
    border: 1px solid #E5E5E5;
    border-radius: 4px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    outline: none;
  }

  .message-input:focus {
    border-color: #0066FF;
  }

  .send-button, .cancel-button, .retry-button {
    padding: 0.75rem 1rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
  }

  .send-button {
    background: #0066FF;
    color: #FFFFFF;
  }

  .send-button:hover:not(:disabled) {
    background: #0052CC;
  }

  .send-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .cancel-button {
    background: #DC2626;
    color: #FFFFFF;
  }

  .retry-button {
    background: #F5F5F5;
    color: #000000;
    border: 1px solid #E5E5E5;
  }

  .typing-indicator {
    position: absolute;
    right: 0.75rem;
    display: flex;
    gap: 0.25rem;
    align-items: center;
    pointer-events: none;
  }

  .typing-dot {
    width: 4px;
    height: 4px;
    background: #6B7280;
    border-radius: 50%;
    animation: typing-bounce 1.4s infinite;
  }

  .typing-dot:nth-child(2) {
    animation-delay: 0.2s;
  }

  .typing-dot:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes typing-bounce {
    0%, 60%, 100% {
      transform: translateY(0);
      opacity: 0.7;
    }
    30% {
      transform: translateY(-4px);
      opacity: 1;
    }
  }

  .message-timestamp {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.7rem;
    color: #9CA3AF;
    margin-bottom: 0.25rem;
    opacity: 0.7;
  }

  .message.user .message-timestamp {
    text-align: right;
  }
</style>
