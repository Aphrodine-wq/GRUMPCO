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
  import { CollapsibleSidebar, Badge, Button, Input } from '../lib/design-system';
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
  import { colors } from '../lib/design-system/tokens/colors';
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

  function handleInputChange() {
    isTyping = true;
    if (typingTimeout) clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => { isTyping = false; }, 500);
  }

  function handleGlobalKeydown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
      event.preventDefault();
      commandPaletteOpen = !commandPaletteOpen;
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key === '/') {
      event.preventDefault();
      showToast('Keyboard Shortcuts:\nCtrl/Cmd+K: Command Palette\nCtrl/Cmd+/: Show Shortcuts\nEscape: Cancel\nArrow Up: Edit Last Message', 'info', 5000);
      return;
    }
    if (event.key === 'Escape' && streaming) {
      event.preventDefault();
      cancelGeneration();
      return;
    }
    if (event.key === 'ArrowUp' && document.activeElement === inputRef && !inputText.trim()) {
      event.preventDefault();
      const lastUserMessageIndex = messages.findLastIndex(m => m.role === 'user');
      if (lastUserMessageIndex >= 0) {
        const lastMsg = messages[lastUserMessageIndex];
        if (typeof lastMsg.content === 'string') {
          inputText = lastMsg.content;
          editingMessageIndex = lastUserMessageIndex;
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
    if (mode === 'code' && chatMode === 'plan') {
      try {
        const ws = workspaceInput.trim() || get(workspaceStore) || undefined;
        const plan = await generatePlan({ userRequest: text, workspaceRoot: ws });
        currentPlanId = plan.id;
        inputText = '';
        return;
      } catch (error) {
        showToast('Failed to generate plan', 'error');
        return;
      }
    }
    if (mode === 'code' && chatMode === 'spec') {
      try {
        const ws = workspaceInput.trim() || get(workspaceStore) || undefined;
        const session = await startSpecSession({ userRequest: text, workspaceRoot: ws });
        currentSpecSessionId = session.id;
        inputText = '';
        return;
      } catch (error) {
        showToast('Failed to start spec session', 'error');
        return;
      }
    }
    if (editingMessageIndex !== null && editingMessageIndex >= 0) {
      const updated = [...messages];
      updated[editingMessageIndex] = { role: 'user', content: text, timestamp: Date.now() };
      messages = updated;
      editingMessageIndex = null;
    } else {
      messages = [...messages, { role: 'user', content: text, timestamp: Date.now() }];
    }
    inputText = '';
    isTyping = false;
    if (typingTimeout) clearTimeout(typingTimeout);
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
      if (mode === 'code' || mode === 'argument') await runCodeModeStream(controller.signal);
      else await runDesignModeStream(controller.signal);
    } catch (err: any) {
      streaming = false;
      lastError = true;
      const errorContext = processError(err, async () => {
        if (lastUserMessage) { inputText = lastUserMessage; await tick(); sendMessage(); }
      });
      logError(errorContext, { mode: get(chatModeStore), workspaceRoot: get(workspaceStore) });
      trackError('api_error', errorContext.message);
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
    const response = await fetchApi('/api/generate-diagram-stream', { method: 'POST', body: JSON.stringify({ message: text }), signal });
    if (!response.ok) throw new Error(`Server error (${response.status})`);
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
        } catch { /* ignore */ }
      }
    }
    const parsed = parseAssistantResponse(streamingContent);
    if (parsed.type === 'clarification' && parsed.clarification) {
      streaming = false;
      streamingContent = '';
      await openModal(parsed.clarification);
      return;
    }
    messages = [...messages, { role: 'assistant', content: streamingContent, timestamp: Date.now() }];
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
    const body: Record<string, unknown> = {
      messages: apiMessages,
      workspaceRoot: ws || undefined,
      mode: get(chatModeStore) === 'argument' ? 'argument' : (chatMode !== 'normal' ? chatMode : 'normal'),
      planId: currentPlanId || undefined,
      specSessionId: currentSpecSessionId || undefined,
    };
    const s = settingsStore.getCurrent();
    if (s?.models?.defaultProvider) body.provider = s.models.defaultProvider;
    if (s?.models?.defaultModelId) body.modelId = s.models.defaultModelId;
    const response = await fetchApi('/api/chat/stream', { method: 'POST', body: JSON.stringify(body), signal });
    if (!response.ok) throw new Error(`Server error (${response.status})`);
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
          const ev = JSON.parse(raw);
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
            const idx = streamingBlocks.findIndex((b) => b.type === 'tool_call' && (b as any).id === ev.id);
            if (idx >= 0) {
              const blk = streamingBlocks[idx] as any;
              const updated = [...streamingBlocks];
              updated[idx] = { ...blk, status: ev.success ? 'success' : 'error' };
              streamingBlocks = updated;
            }
            streamingBlocks = [...streamingBlocks, { type: 'tool_result', id: ev.id, toolName: ev.toolName, output: ev.output ?? '', success: ev.success ?? false, executionTime: ev.executionTime ?? 0, diff: ev.diff }];
            await tick();
            scrollToBottom();
          }
        } catch (e) { /* ignore */ }
      }
    }
    messages = [...messages, { role: 'assistant', content: [...streamingBlocks], timestamp: Date.now() }];
    streaming = false;
    streamingBlocks = [];
    if ($currentSession) sessionsStore.updateSession($currentSession.id, messages);
    else sessionsStore.createSession(messages);
    dispatch('messages-updated', messages);
  }

  function cancelGeneration() {
    if (activeController) { activeController.abort(); activeController = null; }
    streaming = false;
    streamingContent = '';
    streamingBlocks = [];
  }

  function retryLastMessage() { if (lastUserMessage) { inputText = lastUserMessage; sendMessage(); } }

  function handleTemplateSelect(event: CustomEvent) {
    inputText = event.detail.prompt;
    trackTemplateUsed(event.detail.id || 'unknown');
    inputRef?.focus();
  }

  function exportSvg(msgIndex: number, blockIndex: number) {
    const key = `${msgIndex}-${blockIndex}`;
    const svgElement = diagramRefs[key]?.querySelector('svg') as SVGElement;
    if (svgElement) exportAsSvg(svgElement, 'diagram.svg');
  }

  function setupDiagramRef(el: HTMLElement, params: {index: number, blockIdx: number}) {
    diagramRefs[`${params.index}-${params.blockIdx}`] = el;
    return {
      update(newParams: {index: number, blockIdx: number}) { diagramRefs[`${newParams.index}-${newParams.blockIdx}`] = el; }
    };
  }

  const dispatch = createEventDispatcher<{ 'messages-updated': Message[] }>();

  async function handleProceedToPrd() { for await (const _ of streamPrd()) {} }
  async function handleProceedToCodegen() { await startCodeGeneration(get(currentSession)?.projectId ?? getCurrentProjectId() ?? undefined); }
  async function handleDownload() { await downloadProject(); }

  async function handlePushToGitHub(detail: { repoName: string }) {
    const sessionId = get(codegenSession)?.sessionId;
    if (!sessionId) { showToast('No code generation session to push', 'error'); return; }
    try {
      const res = await fetchApi('/api/github/create-and-push', { method: 'POST', body: JSON.stringify({ sessionId, repoName: detail.repoName }) });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast((data as any).error ?? 'Push to GitHub failed', 'error');
        return;
      }
      showToast(`Pushed to GitHub as ${detail.repoName}`, 'success');
    } catch (e) { showToast(e instanceof Error ? e.message : 'Push to GitHub failed', 'error'); }
  }

  function handleOpenInIde(e: CustomEvent<{ ide?: string }>) {
    const ide = e?.detail?.ide ?? 'cursor';
    showToast(`Opening in ${ide}...`, 'info');
    handleDownload();
  }

  function handleWorkflowReset() { resetWorkflow(); }

  async function handleMermaidToCode(detail: { mermaidCode: string; framework: string; language: string; workspaceRoot?: string; }) {
    chatModeStore.setMode('code');
    if (detail.workspaceRoot) { workspaceStore.setWorkspace(detail.workspaceRoot); workspaceInput = detail.workspaceRoot; }
    inputText = `Generate ${detail.framework} code in ${detail.language} based on this architecture diagram:\n\n\`\`\`mermaid\n${detail.mermaidCode}\n\`\`\`\n\nCreate a complete project structure with all necessary files.`;
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

  function handleClearChat() { messages = [defaultMessage]; inputText = ''; showToast('Chat cleared', 'info'); }
  function handleSaveSession() {
    const name = window.prompt('Session name', `Session ${new Date().toLocaleString()}`);
    if (name) {
      codeSessionsStore.save(name, messages, workspaceInput || null, 'general');
      showToast('Session saved', 'success');
    }
  }

  onMount(() => {
    inputRef?.focus();
    const w = get(workspaceStore);
    if (w) workspaceInput = w;
    document.addEventListener('keydown', handleGlobalKeydown);
    return () => document.removeEventListener('keydown', handleGlobalKeydown);
  });
</script>

<div class="chat-interface" style:--bg-primary={colors.background.primary} style:--bg-secondary={colors.background.secondary} style:--border-color={colors.border.default}>
  <CollapsibleSidebar bind:collapsed={sidebarCollapsed}>
    {#snippet header()}
      <div class="sidebar-header">
        <h2 class="sidebar-title">History</h2>
        <Button variant="ghost" size="sm" onclick={() => sessionsStore.createSession([])}>New</Button>
      </div>
    {/snippet}
    {#snippet children()}
      <div class="session-list">
        {#each $sortedSessions as session (session.id)}
          <button 
            class="session-item" 
            class:active={session.id === $currentSession?.id}
            onclick={() => sessionsStore.switchSession(session.id)}
          >
            <span class="session-name">{session.name}</span>
            <span class="session-date">{new Date(session.updatedAt).toLocaleDateString()}</span>
          </button>
        {/each}
      </div>
    {/snippet}
    {#snippet footer()}
      <div class="sidebar-footer">
        <Button variant="ghost" fullWidth onclick={() => (showSettings = true)}>Settings</Button>
      </div>
    {/snippet}
  </CollapsibleSidebar>

  <main class="main-content">
    {#if showSettings}
      <SettingsScreen onBack={() => (showSettings = false)} />
    {:else}
      <div class="chat-viewport">
        <div class="messages-scroll" bind:this={messagesRef}>
          <div class="messages-inner">
            {#if messages.length <= 1 && !streaming}
              <div class="empty-state">
                <GRumpBlob size="lg" state="idle" animated={true} />
                <h1 class="empty-title">What are we building?</h1>
                <p class="empty-text">Describe your idea, and I'll help you design and build it.</p>
                <SuggestionChips on:select={handleTemplateSelect} />
              </div>
            {/if}

            {#each messages as msg, index}
              <div class="message-wrapper {msg.role}">
                <div class="message-avatar">
                  {#if msg.role === 'user'}
                    <div class="avatar-circle user">U</div>
                  {:else}
                    <div class="avatar-circle assistant">AI</div>
                  {/if}
                </div>
                <div class="message-content-container">
                  <div class="message-meta">
                    <span class="message-role">{msg.role === 'user' ? 'You' : 'G-Rump'}</span>
                    {#if msg.timestamp}<span class="message-time">{formatTimestamp(msg.timestamp)}</span>{/if}
                  </div>
                  <div class="message-bubble">
                    {#if typeof msg.content === 'string'}
                      {#each parseMessageContent(msg.content) as block, bIdx}
                        {#if block.type === 'text'}
                          <div class="text-block">{block.content}</div>
                        {:else if block.type === 'mermaid'}
                          <div class="diagram-card" use:setupDiagramRef={{index, blockIdx: bIdx}}>
                            <div class="diagram-header">
                              <Badge variant="info">Architecture</Badge>
                              <Button variant="ghost" size="sm" onclick={() => exportSvg(index, bIdx)}>Export</Button>
                            </div>
                            <DiagramRenderer 
                              code={block.content} 
                              on:generate-code={(e) => handleMermaidToCode({ mermaidCode: e.detail.mermaidCode, framework: 'react', language: 'typescript' })}
                            />
                          </div>
                        {/if}
                      {/each}
                    {:else}
                      {#each msg.content as block}
                        {#if block.type === 'text'}
                          <div class="text-block">{block.content}</div>
                        {:else if block.type === 'tool_call'}
                          <ToolCallCard toolCall={block} />
                        {:else if block.type === 'tool_result'}
                          <ToolResultCard toolResult={block} />
                        {/if}
                      {/each}
                    {/if}
                  </div>
                </div>
              </div>
            {/each}

            {#if streaming}
              <div class="message-wrapper assistant streaming">
                <div class="message-avatar">
                   <div class="avatar-circle assistant">AI</div>
                </div>
                <div class="message-content-container">
                  <div class="message-meta">
                    <span class="message-role">G-Rump</span>
                    <Badge variant="primary" size="sm" dot>Thinking...</Badge>
                  </div>
                  <div class="message-bubble">
                    {#if streamingBlocks.length > 0}
                      {#each streamingBlocks as block}
                        {#if block.type === 'text'}
                          <div class="text-block">{block.content}</div>
                        {:else if block.type === 'tool_call'}
                          <ToolCallCard toolCall={block} />
                        {:else if block.type === 'tool_result'}
                          <ToolResultCard toolResult={block} />
                        {/if}
                      {/each}
                    {:else}
                      <div class="text-block">{streamingContent || '...'}</div>
                    {/if}
                  </div>
                </div>
              </div>
            {/if}
          </div>
        </div>

        <div class="chat-controls">
          <div class="controls-inner">
            <div class="mode-selector">
              <Button 
                variant={$chatModeStore === 'design' ? 'primary' : 'secondary'} 
                size="sm" 
                onclick={() => chatModeStore.setMode('design')}
              >Design</Button>
              <Button 
                variant={$chatModeStore === 'code' && chatMode === 'normal' ? 'primary' : 'secondary'} 
                size="sm" 
                onclick={() => { chatModeStore.setMode('code'); chatMode = 'normal'; }}
              >Code</Button>
              <Button 
                variant={$chatModeStore === 'code' && chatMode === 'plan' ? 'primary' : 'secondary'} 
                size="sm" 
                onclick={() => { chatModeStore.setMode('code'); chatMode = 'plan'; }}
              >Plan</Button>
              <Button 
                variant={$chatModeStore === 'code' && chatMode === 'spec' ? 'primary' : 'secondary'} 
                size="sm" 
                onclick={() => { chatModeStore.setMode('code'); chatMode = 'spec'; }}
              >Spec</Button>
              <Button 
                variant={$chatModeStore === 'argument' ? 'primary' : 'secondary'} 
                size="sm" 
                onclick={() => chatModeStore.setMode('argument')}
              >Argument</Button>
            </div>

            <form class="input-area" onsubmit={(e) => { e.preventDefault(); sendMessage(); }}>
              <div class="input-field-wrapper">
                <input 
                  bind:value={inputText}
                  bind:this={inputRef}
                  oninput={handleInputChange}
                  placeholder="Ask G-Rump anything..."
                  class="custom-input"
                  disabled={streaming}
                />
                <div class="input-actions">
                  {#if streaming}
                    <Button variant="danger" size="sm" onclick={cancelGeneration}>Stop</Button>
                  {:else}
                    <Button variant="primary" size="sm" type="submit" disabled={!inputText.trim()}>Send</Button>
                  {/if}
                </div>
              </div>
            </form>

            {#if $chatModeStore === 'code' || $chatModeStore === 'argument'}
              <div class="workspace-bar">
                <span class="ws-label">Workspace:</span>
                <input 
                  bind:value={workspaceInput} 
                  class="ws-input" 
                  placeholder="Path to project..."
                  onblur={() => { if (workspaceInput.trim()) workspaceStore.setWorkspace(workspaceInput.trim()); }}
                />
              </div>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  </main>
</div>

<style>
  .chat-interface {
    display: flex;
    height: 100vh;
    width: 100%;
    background-color: var(--bg-primary);
    color: #18181b;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  .sidebar-title {
    font-size: 14px;
    font-weight: 600;
    color: #71717a;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .session-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .session-item {
    display: flex;
    flex-direction: column;
    padding: 8px 12px;
    border-radius: 6px;
    border: none;
    background: transparent;
    text-align: left;
    cursor: pointer;
    transition: background 150ms;
  }

  .session-item:hover {
    background-color: #f4f4f5;
  }

  .session-item.active {
    background-color: #eff6ff;
  }

  .session-name {
    font-size: 14px;
    font-weight: 500;
    color: #18181b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .session-date {
    font-size: 12px;
    color: #a1a1aa;
  }

  .sidebar-footer {
    padding-top: 16px;
  }

  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    position: relative;
  }

  .chat-viewport {
    flex: 1;
    display: flex;
    flex-direction: column;
    height: 100%;
    max-width: 900px;
    margin: 0 auto;
    width: 100%;
  }

  .messages-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 24px 16px;
    display: flex;
    flex-direction: column;
  }

  .messages-inner {
    display: flex;
    flex-direction: column;
    gap: 32px;
    width: 100%;
    max-width: 760px;
    margin: 0 auto;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 64px 0;
    text-align: center;
    gap: 16px;
  }

  .empty-title {
    font-size: 24px;
    font-weight: 700;
    color: #18181b;
  }

  .empty-text {
    font-size: 16px;
    color: #71717a;
    max-width: 400px;
  }

  .message-wrapper {
    display: flex;
    gap: 16px;
    width: 100%;
  }

  .message-avatar {
    flex-shrink: 0;
  }

  .avatar-circle {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
  }

  .avatar-circle.user {
    background-color: #f4f4f5;
    color: #71717a;
  }

  .avatar-circle.assistant {
    background-color: #2563eb;
    color: white;
  }

  .message-content-container {
    flex: 1;
    min-width: 0;
  }

  .message-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  .message-role {
    font-size: 13px;
    font-weight: 600;
    color: #18181b;
  }

  .message-time {
    font-size: 12px;
    color: #a1a1aa;
  }

  .message-bubble {
    font-size: 15px;
    line-height: 1.6;
    color: #3f3f46;
    word-break: break-word;
  }

  .text-block {
    white-space: pre-wrap;
    margin-bottom: 8px;
  }

  .diagram-card {
    background: white;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 16px;
    margin: 16px 0;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  .diagram-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .chat-controls {
    background-color: white;
    border-top: 1px solid var(--border-color);
    padding: 16px;
  }

  .controls-inner {
    max-width: 760px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .mode-selector {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .input-area {
    width: 100%;
  }

  .input-field-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
    background-color: #f9fafb;
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 8px 12px;
    transition: all 150ms;
  }

  .input-field-wrapper:focus-within {
    border-color: #2563eb;
    background-color: white;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }

  .custom-input {
    flex: 1;
    border: none;
    background: transparent;
    padding: 8px 4px;
    font-size: 15px;
    outline: none;
    color: #18181b;
  }

  .workspace-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    background-color: #f4f4f5;
    border-radius: 6px;
  }

  .ws-label {
    font-size: 12px;
    font-weight: 600;
    color: #71717a;
  }

  .ws-input {
    flex: 1;
    border: none;
    background: transparent;
    font-size: 12px;
    color: #3f3f46;
    outline: none;
  }

  /* Custom Scrollbar */
  .messages-scroll::-webkit-scrollbar {
    width: 6px;
  }
  .messages-scroll::-webkit-scrollbar-track {
    background: transparent;
  }
  .messages-scroll::-webkit-scrollbar-thumb {
    background: #e4e4e7;
    border-radius: 10px;
  }
  .messages-scroll::-webkit-scrollbar-thumb:hover {
    background: #d4d4d8;
  }
</style>
