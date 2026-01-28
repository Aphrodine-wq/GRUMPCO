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
    background: #F5F5F5;
  }

  .layout-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .chat-column {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    max-width: 48rem;
    width: 100%;
    margin: 0 auto;
    padding: 0 1.5rem;
  }

  /* Sidebar sessions list (passed as snippets into CollapsibleSidebar) */
  .sidebar-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .sidebar-title {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-weight: 600;
    font-size: var(--font-size-sm, 0.8rem);
  }

  .sidebar-new-btn {
    padding: 0.35rem 0.6rem;
    border-radius: 6px;
    background: var(--color-accent-primary, #0066FF);
    color: #fff;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.75rem;
    cursor: pointer;
    border: none;
    transition: background 0.15s;
  }

  .sidebar-new-btn:hover {
    background: #0052CC;
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
    border-radius: 6px;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.8rem;
    color: var(--color-text-primary, #000);
    transition: background 0.15s;
  }

  .session-item:hover {
    background: var(--color-bg-tertiary, #EBEBEB);
  }

  .session-item.session-item-active {
    background: rgba(0, 102, 255, 0.12);
    color: var(--color-accent-primary, #0066FF);
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
    color: var(--color-text-muted, #9CA3AF);
  }

  .sidebar-footer-actions {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .sidebar-footer-btn {
    width: 100%;
    padding: 0.4rem 0.6rem;
    border-radius: 6px;
    background: transparent;
    border: 1px solid var(--color-border-default, #E5E7EB);
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.8rem;
    cursor: pointer;
    color: var(--color-text-primary, #000);
    transition: background 0.15s;
    text-align: left;
  }

  .sidebar-footer-btn:hover {
    background: var(--color-bg-tertiary, #EBEBEB);
  }

  .sidebar-footer-btn-upgrade {
    background: var(--color-accent-primary, #0066FF);
    color: #fff;
    border-color: var(--color-accent-primary, #0066FF);
    text-align: center;
  }

  .sidebar-footer-btn-upgrade:hover {
    background: #0052CC;
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
    font-size: 0.75rem;
    color: var(--color-text-muted, #6b7280);
    margin: -0.25rem 0 0.5rem;
    line-height: 1.3;
  }

  .ship-btn {
    padding: 0.5rem 1.5rem;
    border-radius: 8px;
    background: #EBEBEB;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    color: #6B7280;
    border: none;
    transition: background 0.15s, color 0.15s;
  }

  .ship-btn:hover {
    background: #E0E0E0;
    color: #0066FF;
  }

  .ship-btn.active {
    background: #0066FF;
    color: #fff;
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
    border-radius: 8px;
    background: #EBEBEB;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8rem;
    cursor: pointer;
    color: #6B7280;
    transition: background 0.15s, color 0.15s;
  }

  .mode-icon-btn:hover {
    background: #E0E0E0;
    color: #0066FF;
  }

  .mode-icon-btn.active {
    background: #0066FF;
    color: #fff;
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
    border-radius: 6px;
    background: #EBEBEB;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    cursor: pointer;
    color: #6B7280;
    transition: background 0.15s, color 0.15s;
  }

  .submode-icon-btn:hover {
    background: #E0E0E0;
    color: #0066FF;
  }

  .submode-icon-btn.active {
    background: rgba(0, 102, 255, 0.12);
    color: #0066FF;
  }

  .submode-icon {
    flex-shrink: 0;
  }

  .plan-section, .spec-section, .ship-section {
    padding: 1rem 0;
    background: #F5F5F5;
  }

  .plan-info {
    padding: 0.5rem 0.75rem;
    background: #E0F2FE;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #0C4A6E;
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
    color: #6B7280;
    white-space: nowrap;
  }

  .workspace-input {
    flex: 1;
    padding: 0.4rem 0.6rem;
    border-radius: 6px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8rem;
    color: #000;
    outline: none;
    background: #F0F0F0;
  }

  .workspace-input:focus {
    box-shadow: 0 0 0 2px rgba(0, 102, 255, 0.25);
  }

  .workspace-input::placeholder {
    color: #9CA3AF;
  }

  .agent-badge {
    margin-left: auto;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.7rem;
    color: #9CA3AF;
    padding: 0.25rem 0.5rem;
    background: #F0F0F0;
    border-radius: 4px;
  }

  .input-actions {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }
  .session-action-btn {
    padding: 0.4rem 0.65rem;
    border-radius: 6px;
    background: #EBEBEB;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    cursor: pointer;
    color: #000;
    transition: background 0.15s, color 0.15s;
  }
  .session-action-btn:hover {
    background: #E0E0E0;
    color: #0066FF;
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
    background: #FAFAFA;
    border-radius: 8px;
    padding: 1.5rem;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
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
    background: #EBEBEB;
    border-radius: 6px;
    padding: 0.25rem 0.5rem;
    cursor: pointer;
    color: #6B7280;
  }

  .action-btn:hover {
    background: #E0E0E0;
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
    padding: 1rem 0;
    background: transparent;
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
    border-radius: 6px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    color: #000;
    outline: none;
    background: #F0F0F0;
  }

  .message-input:focus {
    box-shadow: 0 0 0 2px rgba(0, 102, 255, 0.25);
  }

  .message-input::placeholder {
    color: #9CA3AF;
  }

  .send-button, .cancel-button, .retry-button {
    padding: 0.75rem 1rem;
    border-radius: 6px;
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
    background: #EBEBEB;
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
