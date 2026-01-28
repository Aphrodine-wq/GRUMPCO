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
  import { CollapsibleSidebar, Badge } from '../lib/design-system';
  import { exportAsSvg } from '../lib/mermaid';
  import { trackMessageSent, trackDiagramGenerated, trackError, trackTemplateUsed } from '../lib/analytics';
  import { showToast } from '../stores/toastStore';
  import { processError, logError } from '../utils/errorHandler';
  import { sessionsStore, currentSession, sortedSessions } from '../stores/sessionsStore';
  import { getCurrentProjectId } from '../stores/projectStore';
  import { chatModeStore } from '../stores/chatModeStore';
  import { workspaceStore } from '../stores/workspaceStore';
  import { codeSessionsStore } from '../stores/codeSessionsStore';
  import { openModal } from '../stores/clarificationStore';
  import { phase, canProceedToPrd, canProceedToCodegen, canDownload, streamPrd, startCodeGeneration, downloadProject, reset as resetWorkflow, architecture, codegenSession } from '../stores/workflowStore';
  import { parseAssistantResponse } from '../utils/responseParser';
  import { flattenTextContent } from '../utils/contentParser';
  import { generatePlan, currentPlan } from '../stores/planStore';
  import { startSpecSession, currentSession as currentSpecSession } from '../stores/specStore';
  import PlanViewer from './PlanViewer.svelte';
  import SpecMode from './SpecMode.svelte';
  import ShipMode from './ShipMode.svelte';
  import CommandPalette from './CommandPalette.svelte';
  import LoadSessionModal from './LoadSessionModal.svelte';
  import SettingsScreen from './SettingsScreen.svelte';
  import { fetchApi } from '../lib/api.js';
  import { settingsStore } from '../stores/settingsStore';
  import type { Message, ContentBlock } from '../types';

  interface Props {
    initialMessages?: Message[];
  }

  let {
    initialMessages = $bindable(undefined)
  }: Props = $props();

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
  let chatMode: 'normal' | 'plan' | 'spec' | 'ship' | 'execute' = $state('normal');
  let planMode = $state(false); // Deprecated, kept for backward compatibility
  let currentPlanId = $state<string | null>(null);
  let currentSpecSessionId = $state<string | null>(null);
  let commandPaletteOpen = $state(false);
  let loadSessionModalOpen = $state(false);
  let isTyping = $state(false);
  let typingTimeout: ReturnType<typeof setTimeout> | null = null;
  let editingMessageIndex = $state<number | null>(null);
  let sidebarCollapsed = $state(false);
  let showSettings = $state(false);

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
      response = await fetchApi('/api/generate-diagram-stream', {
        method: 'POST',
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
    dispatch('messages-updated', messages);
  }

  async function runCodeModeStream(signal: AbortSignal) {
    const apiMessages = flattenMessagesForChatApi(messages);
    if (apiMessages.length === 0) throw new Error('No messages to send');
    let ws = workspaceInput.trim() || get(workspaceStore) || undefined;
    if (ws) workspaceStore.setWorkspace(ws);

    let response: Response;
    try {
      const body: Record<string, unknown> = {
        messages: apiMessages,
        workspaceRoot: ws || undefined,
        mode: get(chatModeStore) === 'argument' ? 'argument' : (chatMode !== 'normal' ? chatMode : (planMode ? 'plan' : 'normal')),
        planMode: planMode,
        planId: currentPlanId || undefined,
        specSessionId: currentSpecSessionId || undefined,
      };
      const s = settingsStore.getCurrent();
      if (s?.models?.defaultProvider) body.provider = s.models.defaultProvider;
      if (s?.models?.defaultModelId) body.modelId = s.models.defaultModelId;
      if (s?.guardRails?.allowedDirs?.length) body.guardRailOptions = { allowedDirs: s.guardRails.allowedDirs };
      response = await fetchApi('/api/chat/stream', {
        method: 'POST',
        body: JSON.stringify(body),
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
    dispatch('messages-updated', messages);
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

  function setupDiagramRef(el: HTMLElement, params: {index: number, blockIdx: number}) {
    setDiagramRef(el, params.index, params.blockIdx);
    return {
      update(newParams: {index: number, blockIdx: number}) {
        setDiagramRef(el, newParams.index, newParams.blockIdx);
      }
    };
  }

  function handleRefinement() {
    // Simplified refinement
    showToast('Refinement feature coming soon', 'info');
  }

  const dispatch = createEventDispatcher<{ 'messages-updated': Message[] }>();

  // Workflow handlers
  async function handleProceedToPrd() {
    for await (const _ of streamPrd()) {
      // Stream updates handled by store
    }
  }

  async function handleProceedToCodegen() {
    const session = get(currentSession);
    const projectId = session?.projectId ?? getCurrentProjectId();
    await startCodeGeneration(projectId ?? undefined);
  }

  async function handleDownload() {
    await downloadProject();
  }

  async function handlePushToGitHub(detail: { repoName: string }) {
    const session = get(codegenSession);
    const sessionId = session?.sessionId;
    if (!sessionId) {
      showToast('No code generation session to push', 'error');
      return;
    }
    try {
      const res = await fetchApi('/api/github/create-and-push', {
        method: 'POST',
        body: JSON.stringify({ sessionId, repoName: detail.repoName }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast((data as { error?: string }).error ?? 'Push to GitHub failed', 'error');
        return;
      }
      showToast(`Pushed to GitHub as ${detail.repoName}`, 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Push to GitHub failed', 'error');
    }
  }

  function handleOpenInIde(e: CustomEvent<{ ide?: string }>) {
    const ide = e?.detail?.ide ?? 'cursor';
    const isTauri = typeof window !== 'undefined' && (!!(window as any).__TAURI__ || !!(window as any).__TAURI_INTERNALS__);
    const base = isTauri
      ? 'Download the project, then open the folder in '
      : 'Download the ZIP, extract it, then open the folder in ';
    const suffix = isTauri ? ': File > Open Folder.' : ' (File > Open Folder).';
    const msg: Record<string, string> = {
      cursor: base + 'Cursor' + suffix,
      vscode: base + 'VS Code' + suffix,
      jetbrains: base + 'IntelliJ or WebStorm' + (isTauri ? ': File > Open.' : ' (File > Open).'),
    };
    showToast(msg[ide] ?? msg.cursor, 'info', 8000);
    handleDownload();
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
    codeSessionsStore.save(name, messages, ws, 'general');
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

  function loadSessionById(id: string) {
    const session = codeSessionsStore.load(id);
    if (session) {
      messages = JSON.parse(JSON.stringify(session.messages));
      workspaceInput = session.workspaceRoot ?? '';
      if (session.workspaceRoot) workspaceStore.setWorkspace(session.workspaceRoot);
      showToast(`Loaded: ${session.name}`, 'success');
      loadSessionModalOpen = false;
    }
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
    loadSessionModalOpen = true;
  }

  function handleShowShortcuts() {
    showToast('Keyboard Shortcuts:\nCtrl/Cmd+K: Command Palette\nCtrl/Cmd+/: Show Shortcuts\nEscape: Cancel\nArrow Up: Edit Last Message', 'info', 8000);
  }

  function handleNewSession() {
    sessionsStore.createSession([]);
    inputRef?.focus();
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
  <CollapsibleSidebar bind:collapsed={sidebarCollapsed} position="left" width="280px">
    {#snippet header()}
      <div class="sidebar-header-row">
        <span class="sidebar-title">History</span>
        <button type="button" class="sidebar-new-btn" onclick={handleNewSession} aria-label="New session" title="New session">New</button>
      </div>
    {/snippet}
    {#snippet children()}
      <ul class="session-list" role="list">
        {#each $sortedSessions as session (session.id)}
          <li>
            <button type="button" class="session-item" class:session-item-active={session.id === $currentSession?.id} onclick={() => sessionsStore.switchSession(session.id)} title="Switch to session {session.name}">
              <span class="session-name">{session.name}</span>
              <span class="session-meta">{new Date(session.updatedAt).toLocaleDateString()}</span>
              {#if session.id === $currentSession?.id}
                <Badge>{#snippet children()}Current{/snippet}</Badge>
              {/if}
            </button>
          </li>
        {/each}
      </ul>
    {/snippet}
    {#snippet footer()}
      <div class="sidebar-footer-actions">
        <button type="button" class="sidebar-footer-btn" onclick={() => (showSettings = true)} aria-label="Settings">Settings</button>
        <button type="button" class="sidebar-footer-btn sidebar-footer-btn-upgrade" onclick={() => showToast('Upgrade your account for more projects and features.', 'info')} aria-label="Upgrade">Upgrade</button>
      </div>
    {/snippet}
  </CollapsibleSidebar>
  <div class="layout-main">
    {#if showSettings}
      <SettingsScreen onBack={() => (showSettings = false)} />
    {:else}
    <div class="chat-column">
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

  {#if chatMode === 'spec' && $currentSpecSession}
    <div class="spec-section">
      <SpecMode />
    </div>
  {/if}

  {#if chatMode === 'ship'}
    <div class="ship-section">
      <ShipMode />
    </div>
  {/if}

  {#if chatMode === 'execute' && $currentPlan}
    <div class="plan-info">Executing: {$currentPlan.title}</div>
  {/if}

  <div class="messages-container" bind:this={messagesRef}>
    {#if messages.length <= 1 && !streaming}
      <div class="empty-state">
        <h2 class="empty-title above-blob">What are we building?</h2>
        <GRumpBlob size="lg" state="idle" animated={true} />
        {#if $chatModeStore === 'design'}
          <p class="empty-subtitle">Describe your app idea and I'll help you code it</p>
          <SuggestionChips on:select={handleTemplateSelect} />
        {:else if $chatModeStore === 'argument'}
          <p class="empty-subtitle">Describe what you want to build or change—I'll push back, suggest alternatives, and only implement when you say so.</p>
        {:else}
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
                        <button onclick={() => exportSvg(index, blockIdx)} class="action-btn" title="Export SVG">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div use:setupDiagramRef={{index, blockIdx}}>
                      <DiagramRenderer
                        code={(block as { content: string }).content}
                        architectureMetadata={$architecture?.metadata}
                        on:generate-code={(e) => handleMermaidToCode({ mermaidCode: e.detail.mermaidCode, framework: 'react', language: 'typescript', workspaceRoot: get(workspaceStore) ?? undefined })}
                      />
                    </div>
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
      on:pushToGitHub={(e) => handlePushToGitHub(e.detail)}
      on:openInIde={handleOpenInIde}
    />
  {/if}

    <div class="five-buttons-row">
      <button type="button" class="mode-icon-btn" class:active={$chatModeStore === 'design'} onclick={() => { chatModeStore.setMode('design'); chatMode = 'normal'; }} title="Design">
        <span class="mode-icon-label">Design</span>
      </button>
      <button type="button" class="mode-icon-btn" class:active={$chatModeStore === 'code' && chatMode === 'normal'} onclick={() => { chatModeStore.setMode('code'); chatMode = 'normal'; }} title="Code">
        <span class="mode-icon-label">Code</span>
      </button>
      <button type="button" class="mode-icon-btn" class:active={$chatModeStore === 'code' && chatMode === 'plan'} onclick={() => { chatModeStore.setMode('code'); chatMode = 'plan'; }} title="Plan">
        <span class="mode-icon-label">Plan</span>
      </button>
      <button type="button" class="mode-icon-btn" class:active={$chatModeStore === 'code' && chatMode === 'spec'} onclick={() => { chatModeStore.setMode('code'); chatMode = 'spec'; }} title="Spec">
        <span class="mode-icon-label">Spec</span>
      </button>
      <button type="button" class="mode-icon-btn" class:active={$chatModeStore === 'argument'} onclick={() => { chatModeStore.setMode('argument'); chatMode = 'normal'; }} title="Argument">
        <span class="mode-icon-label">Argument</span>
      </button>
    </div>

    <div class="ship-button-row">
      <button type="button" class="ship-btn" class:active={chatMode === 'ship'} onclick={() => chatMode = 'ship'} title="SHIP — design→spec→plan→argument→code">
        SHIP
      </button>
    </div>

    <p class="ai-disclaimer">Generated code and content are suggestions only. Always review and test before use. We do not guarantee correctness or fitness for any purpose.</p>

    <form onsubmit={(e) => { e.preventDefault(); sendMessage(); }} class="input-container">
      <span class="input-prompt">&gt;</span>
      <div class="input-wrapper">
        <input
          bind:value={inputText}
          oninput={handleInputChange}
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
        <button type="button" onclick={cancelGeneration} class="cancel-button">
          Stop
        </button>
      {:else}
        <button type="submit" disabled={!inputText.trim()} class="send-button" title="Send">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      {/if}
      {#if lastError && !streaming}
        <button type="button" onclick={retryLastMessage} class="retry-button">
          Retry
        </button>
      {/if}
    </form>

    {#if $chatModeStore === 'code' || $chatModeStore === 'argument'}
      <div class="workspace-row">
        <label class="workspace-label" for="workspace-input">Workspace</label>
        <input
          id="workspace-input"
          type="text"
          class="workspace-input"
          placeholder="C:\path\to\project or /home/user/project"
          bind:value={workspaceInput}
          onblur={() => { const v = workspaceInput.trim(); if (v) workspaceStore.setWorkspace(v); }}
        />
      </div>
    {/if}
  </div>
  {/if}
  </div>
  <CommandPalette bind:open={commandPaletteOpen} />
  <LoadSessionModal bind:open={loadSessionModalOpen} onLoad={loadSessionById} onClose={() => (loadSessionModalOpen = false)} />
</div>

<style>
  .chat-interface {
    display: flex;
    flex-direction: row;
    height: 100vh;
    width: 100%;
    background: #0D0D0D;
  }

  .layout-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #0D0D0D;
  }

  .chat-column {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    max-width: 56rem;
    width: 100%;
    margin: 0 auto;
    padding: 0 1.5rem;
  }

  .sidebar-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .sidebar-title {
    font-family: 'JetBrains Mono', monospace;
    font-weight: 600;
    font-size: 0.8rem;
    color: #00E5FF;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .sidebar-new-btn {
    padding: 0.35rem 0.6rem;
    border-radius: 0;
    background: transparent;
    color: #00FF41;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    cursor: pointer;
    border: 1px solid #00FF41;
    transition: all 0.1s;
    text-transform: uppercase;
  }

  .sidebar-new-btn:hover {
    background: #00FF41;
    color: #000;
  }

  .session-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .session-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.2rem;
    width: 100%;
    padding: 0.5rem 0.6rem;
    border-radius: 0;
    background: transparent;
    border: 1px solid transparent;
    cursor: pointer;
    text-align: left;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8rem;
    color: #A3A3A3;
    transition: all 0.1s;
  }

  .session-item:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: #333;
  }

  .session-item.session-item-active {
    background: rgba(0, 255, 65, 0.1);
    border-color: #00FF41;
    color: #00FF41;
  }

  .session-name {
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .session-meta {
    font-size: 0.7rem;
    color: #525252;
  }

  .sidebar-footer-actions {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .sidebar-footer-btn {
    width: 100%;
    padding: 0.4rem 0.6rem;
    border-radius: 0;
    background: transparent;
    border: 1px solid #333;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8rem;
    cursor: pointer;
    color: #A3A3A3;
    transition: all 0.1s;
    text-align: left;
  }

  .sidebar-footer-btn:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #D4D4D4;
    border-color: #444;
  }

  .sidebar-footer-btn-upgrade {
    background: transparent;
    color: #00E5FF;
    border-color: #00E5FF;
    text-align: center;
    text-transform: uppercase;
  }

  .sidebar-footer-btn-upgrade:hover {
    background: #00E5FF;
    color: #000;
  }

  .empty-title.above-blob {
    margin-bottom: 0.5rem;
  }

  .five-buttons-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 0;
    flex-wrap: wrap;
  }

  .ship-button-row {
    display: flex;
    justify-content: center;
    padding: 0 0 0.75rem;
  }

  .ai-disclaimer {
    font-size: 0.7rem;
    color: #525252;
    margin: -0.25rem 0 0.5rem;
    line-height: 1.3;
    text-align: center;
  }

  .ship-btn {
    padding: 0.5rem 1.5rem;
    border-radius: 0;
    background: transparent;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    color: #A3A3A3;
    border: 1px solid #333;
    transition: all 0.1s;
    text-transform: uppercase;
  }

  .ship-btn:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #00FF41;
    border-color: #00FF41;
  }

  .ship-btn.active {
    background: #00FF41;
    color: #000;
    border-color: #00FF41;
  }

  .mode-icon-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 0;
    flex-wrap: wrap;
  }

  .mode-icon-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 0.85rem;
    border-radius: 0;
    background: transparent;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8rem;
    cursor: pointer;
    color: #666;
    border: 1px solid #333;
    transition: all 0.1s;
    text-transform: uppercase;
  }

  .mode-icon-btn:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #00E5FF;
    border-color: #00E5FF;
  }

  .mode-icon-btn.active {
    background: rgba(0, 255, 65, 0.1);
    color: #00FF41;
    border-color: #00FF41;
  }

  .mode-icon {
    flex-shrink: 0;
  }

  .mode-icon-label {
    white-space: nowrap;
  }

  .submode-icon-row {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0 0 0.75rem;
    flex-wrap: wrap;
  }

  .submode-icon-btn {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.4rem 0.65rem;
    border-radius: 0;
    background: transparent;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    cursor: pointer;
    color: #666;
    border: 1px solid #333;
    transition: all 0.1s;
    text-transform: uppercase;
  }

  .submode-icon-btn:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #00E5FF;
    border-color: #00E5FF;
  }

  .submode-icon-btn.active {
    background: rgba(0, 229, 255, 0.1);
    color: #00E5FF;
    border-color: #00E5FF;
  }

  .submode-icon {
    flex-shrink: 0;
  }

  .plan-section, .spec-section, .ship-section {
    padding: 1rem 0;
    background: #0D0D0D;
  }

  .plan-info {
    padding: 0.5rem 0.75rem;
    background: rgba(0, 229, 255, 0.1);
    border: 1px solid #00E5FF;
    border-radius: 0;
    font-size: 0.875rem;
    color: #00E5FF;
    margin-bottom: 0.5rem;
    font-family: 'JetBrains Mono', monospace;
  }

  .workspace-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding-bottom: 1rem;
  }

  .workspace-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    color: #00E5FF;
    white-space: nowrap;
    text-transform: uppercase;
  }

  .workspace-input {
    flex: 1;
    padding: 0.4rem 0.6rem;
    border-radius: 0;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8rem;
    color: #D4D4D4;
    outline: none;
    background: #000;
    border: 1px solid #333;
  }

  .workspace-input:focus {
    border-color: #00FF41;
    box-shadow: 0 0 10px rgba(0, 255, 65, 0.1);
  }

  .workspace-input::placeholder {
    color: #444;
  }

  .agent-badge {
    margin-left: auto;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.7rem;
    color: #525252;
    padding: 0.25rem 0.5rem;
    background: #1A1A1A;
    border: 1px solid #333;
    border-radius: 0;
  }

  .input-actions {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }
  .session-action-btn {
    padding: 0.4rem 0.65rem;
    border-radius: 0;
    background: transparent;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    cursor: pointer;
    color: #A3A3A3;
    border: 1px solid #333;
    transition: all 0.1s;
  }
  .session-action-btn:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #00FF41;
    border-color: #00FF41;
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
    color: #00FF41;
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .empty-subtitle {
    font-family: 'JetBrains Mono', monospace;
    font-size: 1rem;
    color: #666;
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
    animation: fadeIn 0.2s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(5px);
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
    color: #00FF41;
    font-size: 1.25rem;
    font-weight: bold;
  }

  .message-body {
    max-width: 85%;
  }

  .text-block {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    line-height: 1.7;
    color: #D4D4D4;
    white-space: pre-wrap;
    margin: 0.5rem 0;
  }

  .user-text {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    color: #D4D4D4;
    background: #1A1A1A;
    border: 1px solid #333;
    padding: 0.75rem 1rem;
    display: inline-block;
  }

  .diagram-block {
    margin: 1.5rem 0;
    background: #1A1A1A;
    border: 1px solid #333;
    border-radius: 0;
    padding: 1.5rem;
    animation: slideIn 0.3s ease-out;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .diagram-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    border-bottom: 1px solid #333;
    padding-bottom: 0.5rem;
  }

  .diagram-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    font-weight: 600;
    color: #00E5FF;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .diagram-label::before {
    content: '⏺ ';
  }

  .diagram-actions {
    display: flex;
    gap: 0.5rem;
  }

  .action-btn {
    background: transparent;
    border: 1px solid #333;
    border-radius: 0;
    padding: 0.25rem 0.5rem;
    cursor: pointer;
    color: #666;
    transition: all 0.1s;
  }

  .action-btn:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #00E5FF;
    border-color: #00E5FF;
  }

  .streaming-message {
    opacity: 1;
    border-left: 2px solid #00FF41;
    padding-left: 1rem;
  }

  .streaming-progress {
    height: 2px;
    background: #00FF41;
    animation: progress-pulse 1.5s ease-in-out infinite;
    margin-bottom: 0.5rem;
  }

  @keyframes progress-pulse {
    0%, 100% { opacity: 0.3; transform: scaleX(0.5); }
    50% { opacity: 1; transform: scaleX(1); }
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
    color: #00E5FF;
    text-transform: uppercase;
  }

  .thinking-dots {
    display: inline-flex;
    gap: 0.1rem;
    color: #00FF41;
  }

  .thinking-dots span {
    animation: thinking-blink 1.4s infinite;
  }

  .thinking-dots span:nth-child(2) { animation-delay: 0.2s; }
  .thinking-dots span:nth-child(3) { animation-delay: 0.4s; }

  @keyframes thinking-blink {
    0%, 60%, 100% { opacity: 0.3; }
    30% { opacity: 1; }
  }

  .building-indicator {
    padding: 2rem;
    text-align: center;
    border: 1px solid #333;
    background: #121212;
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
    background: #00FF41;
    border-radius: 0;
    animation: block-pulse 1.4s infinite;
  }

  .block.b1 { animation-delay: 0s; }
  .block.b2 { animation-delay: 0.2s; }
  .block.b3 { animation-delay: 0.4s; }

  @keyframes block-pulse {
    0%, 100% { opacity: 0.3; transform: scale(0.8); }
    50% { opacity: 1; transform: scale(1); }
  }

  .building-text {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    color: #00E5FF;
    text-transform: uppercase;
  }

  .cursor {
    display: inline-block;
    background: #00FF41;
    width: 8px;
    height: 1.2em;
    margin-left: 2px;
    animation: cursor-blink 1s step-end infinite;
  }

  @keyframes cursor-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }

  .input-container {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 0;
    background: transparent;
    border-top: 1px solid #222;
  }

  .input-wrapper {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
  }

  .input-prompt {
    font-family: 'JetBrains Mono', monospace;
    color: #00FF41;
    font-size: 1.25rem;
    font-weight: bold;
  }

  .message-input {
    flex: 1;
    padding: 0.75rem 1rem;
    border-radius: 0;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    color: #D4D4D4;
    outline: none;
    background: #000;
    border: 1px solid #333;
  }

  .message-input:focus {
    border-color: #00FF41;
    box-shadow: 0 0 10px rgba(0, 255, 65, 0.1);
  }

  .message-input::placeholder {
    color: #444;
  }

  .send-button, .cancel-button, .retry-button {
    padding: 0.75rem 1rem;
    border-radius: 0;
    cursor: pointer;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    text-transform: uppercase;
    border: 1px solid;
    transition: all 0.1s;
  }

  .send-button {
    background: #00FF41;
    color: #000;
    border-color: #00FF41;
  }

  .send-button:hover:not(:disabled) {
    background: transparent;
    color: #00FF41;
  }

  .send-button:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .cancel-button {
    background: transparent;
    color: #FF3131;
    border-color: #FF3131;
  }

  .cancel-button:hover {
    background: #FF3131;
    color: #000;
  }

  .retry-button {
    background: transparent;
    color: #FFD700;
    border-color: #FFD700;
  }

  .retry-button:hover {
    background: #FFD700;
    color: #000;
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
    background: #00FF41;
    border-radius: 0;
    animation: typing-pulse 1.4s infinite;
  }

  .typing-dot:nth-child(2) {
    animation-delay: 0.2s;
  }

  .typing-dot:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes typing-pulse {
    0%, 60%, 100% {
      opacity: 0.3;
    }
    30% {
      opacity: 1;
    }
  }

  .message-timestamp {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.65rem;
    color: #444;
    margin-bottom: 0.25rem;
    opacity: 0.7;
  }

  .message.user .message-timestamp {
    text-align: right;
  }
</style>
