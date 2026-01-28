<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import { get } from 'svelte/store';

  import DiagramRenderer from './DiagramRenderer.svelte';
  import SuggestionChips from './SuggestionChips.svelte';
  import GRumpBlob from './GRumpBlob.svelte';
  import ToolCallCard from './ToolCallCard.svelte';
  import ToolResultCard from './ToolResultCard.svelte';
  import ShipMode from './ShipMode.svelte';
  import SettingsScreen from './SettingsScreen.svelte';
  import { Badge, Button } from '../lib/design-system';
  import { exportAsSvg } from '../lib/mermaid';
  import {
    trackMessageSent,
    trackDiagramGenerated,
    trackError,
    trackTemplateUsed,
  } from '../lib/analytics';
  import { showToast } from '../stores/toastStore';
  import { processError, logError } from '../utils/errorHandler';
  import { sessionsStore, currentSession } from '../stores/sessionsStore';
  import { getCurrentProjectId } from '../stores/projectStore';
  import { chatModeStore } from '../stores/chatModeStore';
  import { workspaceStore } from '../stores/workspaceStore';
  import { codeSessionsStore } from '../stores/codeSessionsStore';
  import { openModal } from '../stores/clarificationStore';
  import {
    streamPrd,
    startCodeGeneration,
    downloadProject,
    reset as resetWorkflow,
    codegenSession,
  } from '../stores/workflowStore';
  import { parseAssistantResponse } from '../utils/responseParser';
  import { flattenTextContent } from '../utils/contentParser';
  import { generatePlan } from '../stores/planStore';
  import { startSpecSession } from '../stores/specStore';
  import { fetchApi } from '../lib/api.js';
  import { settingsStore } from '../stores/settingsStore';
  import { colors } from '../lib/design-system/tokens/colors';
  import type { Message, ContentBlock } from '../types';

  interface Props {
    initialMessages?: Message[];
  }

  let { initialMessages = $bindable(undefined) }: Props = $props();

  const defaultMessage: Message = {
    role: 'assistant',
    content:
      "Tell me what you want to build. I'll design the architecture and help you code it section by section.",
  };

  let messages = $state<Message[]>(initialMessages || [defaultMessage]);
  let inputText = $state('');
  let messagesRef: HTMLElement | null = $state(null);
  let inputRef: HTMLInputElement | null = $state(null);
  let streaming = $state(false);
  let streamingContent = $state('');
  let streamingBlocks = $state<ContentBlock[]>([]);
  let diagramRefs: Record<string, HTMLElement> = $state({});
  let lastUserMessage = $state('');
  let activeController: AbortController | null = $state(null);
  let workspaceInput = $state('');
  let chatMode: 'normal' | 'plan' | 'spec' | 'ship' | 'execute' = $state('normal');
  let currentPlanId = $state<string | null>(null);
  let currentSpecSessionId = $state<string | null>(null);
  let commandPaletteOpen = $state(false);
  let typingTimeout: ReturnType<typeof setTimeout> | null = null;
  let editingMessageIndex = $state<number | null>(null);
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

  function flattenMessagesForChatApi(
    msgs: Message[]
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
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
    typingTimeout = setTimeout(() => {
      isTyping = false;
    }, 500);
  }

  function handleGlobalKeydown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
      event.preventDefault();
      commandPaletteOpen = !commandPaletteOpen;
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key === '/') {
      event.preventDefault();
      showToast(
        'Keyboard Shortcuts:\nCtrl/Cmd+K: Command Palette\nCtrl/Cmd+/: Show Shortcuts\nEscape: Cancel\nArrow Up: Edit Last Message',
        'info',
        5000
      );
      return;
    }
    if (event.key === 'Escape' && streaming) {
      event.preventDefault();
      cancelGeneration();
      return;
    }
    if (event.key === 'ArrowUp' && document.activeElement === inputRef && !inputText.trim()) {
      event.preventDefault();
      const lastUserMessageIndex = messages.findLastIndex((m) => m.role === 'user');
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
    const timeoutMs = mode === 'code' || mode === 'argument' ? 120000 : 60000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      if (mode === 'code' || mode === 'argument') await runCodeModeStream(controller.signal);
      else await runDesignModeStream(controller.signal);
    } catch (err: any) {
      streaming = false;
      lastError = true;
      const errorContext = processError(err, async () => {
        if (lastUserMessage) {
          inputText = lastUserMessage;
          await tick();
          sendMessage();
        }
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
    const response = await fetchApi('/api/generate-diagram-stream', {
      method: 'POST',
      body: JSON.stringify({ message: text }),
      signal,
    });
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
        } catch {
          /* ignore */
        }
      }
    }
    const parsed = parseAssistantResponse(streamingContent);
    if (parsed.type === 'clarification' && parsed.clarification) {
      streaming = false;
      streamingContent = '';
      await openModal(parsed.clarification);
      return;
    }
    messages = [
      ...messages,
      { role: 'assistant', content: streamingContent, timestamp: Date.now() },
    ];
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
      mode:
        get(chatModeStore) === 'argument'
          ? 'argument'
          : chatMode !== 'normal'
            ? chatMode
            : 'normal',
      planId: currentPlanId || undefined,
      specSessionId: currentSpecSessionId || undefined,
    };
    const s = settingsStore.getCurrent();
    if (s?.models?.defaultProvider) body.provider = s.models.defaultProvider;
    if (s?.models?.defaultModelId) body.modelId = s.models.defaultModelId;
    if (s?.guardRails?.autonomousMode) body.autonomous = true;
    if (s?.guardRails?.useLargeContext) body.largeContext = true;
    const response = await fetchApi('/api/chat/stream', {
      method: 'POST',
      body: JSON.stringify(body),
      signal,
    });
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
          if (ev.type === 'autonomous' && ev.value) {
            /* Yolo mode: backend signaled autonomous; confirmations are skipped by backend. */
          } else if (ev.type === 'text' && ev.text) {
            const last = streamingBlocks[streamingBlocks.length - 1];
            if (last?.type === 'text') {
              streamingBlocks = [
                ...streamingBlocks.slice(0, -1),
                { type: 'text', content: last.content + ev.text },
              ];
            } else {
              streamingBlocks = [...streamingBlocks, { type: 'text', content: ev.text }];
            }
            await tick();
            scrollToBottom();
          } else if (ev.type === 'tool_call' && ev.id && ev.name) {
            streamingBlocks = [
              ...streamingBlocks,
              {
                type: 'tool_call',
                id: ev.id,
                name: ev.name,
                input: ev.input ?? {},
                status: 'executing',
              },
            ];
            await tick();
            scrollToBottom();
          } else if (ev.type === 'tool_result' && ev.id && ev.toolName) {
            const idx = streamingBlocks.findIndex(
              (b) => b.type === 'tool_call' && (b as any).id === ev.id
            );
            if (idx >= 0) {
              const blk = streamingBlocks[idx] as any;
              const updated = [...streamingBlocks];
              updated[idx] = { ...blk, status: ev.success ? 'success' : 'error' };
              streamingBlocks = updated;
            }
            streamingBlocks = [
              ...streamingBlocks,
              {
                type: 'tool_result',
                id: ev.id,
                toolName: ev.toolName,
                output: ev.output ?? '',
                success: ev.success ?? false,
                executionTime: ev.executionTime ?? 0,
                diff: ev.diff,
              },
            ];
            await tick();
            scrollToBottom();
          }
        } catch (e) {
          /* ignore */
        }
      }
    }
    messages = [
      ...messages,
      { role: 'assistant', content: [...streamingBlocks], timestamp: Date.now() },
    ];
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
    if (event.detail.id === 'ship-mode') {
      chatMode = 'ship';
      trackTemplateUsed('ship-mode');
      return;
    }
    inputText = event.detail.prompt;
    trackTemplateUsed(event.detail.id || 'unknown');
    inputRef?.focus();
  }

  function exportSvg(msgIndex: number, blockIndex: number) {
    const key = `${msgIndex}-${blockIndex}`;
    const svgElement = diagramRefs[key]?.querySelector('svg') as SVGElement;
    if (svgElement) exportAsSvg(svgElement, 'diagram.svg');
  }

  function setupDiagramRef(el: HTMLElement, params: { index: number; blockIdx: number }) {
    diagramRefs[`${params.index}-${params.blockIdx}`] = el;
    return {
      update(newParams: { index: number; blockIdx: number }) {
        diagramRefs[`${newParams.index}-${newParams.blockIdx}`] = el;
      },
    };
  }

  const dispatch = createEventDispatcher<{ 'messages-updated': Message[] }>();

  async function handleProceedToPrd() {
    for await (const _ of streamPrd()) {
    }
  }
  async function handleProceedToCodegen() {
    await startCodeGeneration(get(currentSession)?.projectId ?? getCurrentProjectId() ?? undefined);
  }
  async function handleDownload() {
    await downloadProject();
  }

  async function handlePushToGitHub(detail: { repoName: string }) {
    const sessionId = get(codegenSession)?.sessionId;
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
        showToast((data as any).error ?? 'Push to GitHub failed', 'error');
        return;
      }
      showToast(`Pushed to GitHub as ${detail.repoName}`, 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Push to GitHub failed', 'error');
    }
  }

  function handleOpenInIde(e: CustomEvent<{ ide?: string }>) {
    const ide = e?.detail?.ide ?? 'cursor';
    showToast(`Opening in ${ide}...`, 'info');
    handleDownload();
  }

  function handleWorkflowReset() {
    resetWorkflow();
  }

  async function handleMermaidToCode(detail: {
    mermaidCode: string;
    framework: string;
    language: string;
    workspaceRoot?: string;
  }) {
    chatModeStore.setMode('code');
    if (detail.workspaceRoot) {
      workspaceStore.setWorkspace(detail.workspaceRoot);
      workspaceInput = detail.workspaceRoot;
    }
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

  function handleClearChat() {
    messages = [defaultMessage];
    inputText = '';
    showToast('Chat cleared', 'info');
  }
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
    const handleOpenShipMode = () => { chatMode = 'ship'; };
    window.addEventListener('open-ship-mode', handleOpenShipMode);
    return () => {
      document.removeEventListener('keydown', handleGlobalKeydown);
      window.removeEventListener('open-ship-mode', handleOpenShipMode);
    };
  });
</script>

<div
  class="chat-interface"
  style:--bg-primary={colors.background.primary}
  style:--bg-secondary={colors.background.secondary}
>
  {#if showSettings}
    <SettingsScreen onBack={() => (showSettings = false)} />
  {:else}
    <div class="chat-root">
      <div class="chat-viewport">
        {#if chatMode === 'ship'}
          <div class="ship-mode-viewport">
            <ShipMode />
          </div>
        {:else}
        <div class="messages-scroll" bind:this={messagesRef}>
          <div class="messages-inner">
            {#if messages.length <= 1 && !streaming}
                <div class="empty-state">
                  <GRumpBlob size="lg" state="idle" animated={true} />
                  <h1 class="empty-title">What are we building?</h1>
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
                    {#if msg.timestamp}<span class="message-time"
                        >{formatTimestamp(msg.timestamp)}</span
                      >{/if}
                  </div>
                  <div class="message-bubble">
                    {#if typeof msg.content === 'string'}
                      {#each parseMessageContent(msg.content) as block, bIdx}
                        {#if block.type === 'text'}
                          <div class="text-block">{block.content}</div>
                        {:else if block.type === 'mermaid'}
                          <div class="diagram-card" use:setupDiagramRef={{ index, blockIdx: bIdx }}>
                            <div class="diagram-header">
                              <Badge variant="info">Architecture</Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                onclick={() => exportSvg(index, bIdx)}>Export</Button
                              >
                            </div>
                            <DiagramRenderer
                              code={block.content}
                              on:generate-code={(e) =>
                                handleMermaidToCode({
                                  mermaidCode: e.detail.mermaidCode,
                                  framework: 'react',
                                  language: 'typescript',
                                })}
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
                    <span class="thinking-indicator">Thinking...</span>
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
        {/if}

        <div class="chat-controls">
          <div class="controls-inner">
            {#if chatMode !== 'ship'}
            <form
              class="input-container"
              onsubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
            >
              <span class="input-prompt">&gt;</span>
              <div class="input-wrapper">
                <input
                  bind:value={inputText}
                  bind:this={inputRef}
                  oninput={handleInputChange}
                  placeholder="Describe what you want to build..."
                  class="message-input"
                  disabled={streaming}
                />
              </div>
              <button class="send-button" type="submit" disabled={!inputText.trim() || streaming}>
                {#if streaming}
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                {:else}
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-send"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                {/if}
              </button>
            </form>
            {/if}

            <div class="mode-selector">
              <Button
                variant={$chatModeStore === 'code' && chatMode === 'normal'
                  ? 'primary'
                  : 'secondary'}
                size="sm"
                onclick={() => {
                  chatModeStore.setMode('code');
                  chatMode = 'normal';
                }}>Code</Button
              >
              <Button
                variant={$chatModeStore === 'code' && chatMode === 'plan' ? 'primary' : 'secondary'}
                size="sm"
                onclick={() => {
                  chatModeStore.setMode('code');
                  chatMode = 'plan';
                }}>Plan</Button
              >
              <Button
                variant={$chatModeStore === 'code' && chatMode === 'spec' ? 'primary' : 'secondary'}
                size="sm"
                onclick={() => {
                  chatModeStore.setMode('code');
                  chatMode = 'spec';
                }}>Spec</Button
              >
              <Button
                variant={$chatModeStore === 'design' ? 'primary' : 'secondary'}
                size="sm"
                onclick={() => chatModeStore.setMode('design')}>Design</Button
              >
              <Button
                variant={$chatModeStore === 'argument' ? 'primary' : 'secondary'}
                size="sm"
                onclick={() => chatModeStore.setMode('argument')}>Argument</Button
              >
              <Button
                variant={chatMode === 'ship' ? 'primary' : 'secondary'}
                size="sm"
                onclick={() => { chatMode = 'ship'; }}>SHIP</Button
              >
            </div>

            {#if $chatModeStore === 'code' || $chatModeStore === 'argument'}
              <div class="workspace-bar">
                <span class="ws-label">Workspace:</span>
                <input
                  bind:value={workspaceInput}
                  class="ws-input"
                  placeholder="Path to project..."
                  onblur={() => {
                    if (workspaceInput.trim()) workspaceStore.setWorkspace(workspaceInput.trim());
                  }}
                />
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .chat-interface {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100%;
    background-color: var(--bg-primary);
    color: #18181b;
    font-family: var(
      --font-sans,
      -apple-system,
      BlinkMacSystemFont,
      'Segoe UI',
      Roboto,
      Helvetica,
      Arial,
      sans-serif
    );
  }

  .chat-root {
    flex: 1;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
  }

  .chat-viewport {
    flex: 1;
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
  }

  .ship-mode-viewport {
    flex: 1;
    overflow: auto;
    width: 100%;
    min-height: 0;
  }

  .messages-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 24px 16px;
    display: flex;
    flex-direction: column;
    padding-bottom: 140px;
  }

  .messages-inner {
    display: flex;
    flex-direction: column;
    gap: 24px;
    width: 100%;
    max-width: 768px;
    margin: 0 auto;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 64px 24px;
    text-align: center;
    gap: 24px;
    min-height: 50vh;
    background: linear-gradient(135deg, rgba(14, 165, 233, 0.03) 0%, rgba(59, 130, 246, 0.03) 100%);
    border-radius: 20px;
    margin: 20px;
  }

  .empty-title {
    font-size: 32px;
    font-weight: 700;
    color: #18181b;
    font-family: var(--font-serif, Georgia, serif);
    letter-spacing: -0.5px;
  }

  .empty-text {
    font-size: 15px;
    color: #3f3f46;
    max-width: 400px;
    line-height: 1.5;
  }

  .message-wrapper {
    display: flex;
    gap: 16px;
    width: 100%;
    padding: 0;
  }

  .message-wrapper.assistant {
    margin-right: 0;
  }

  .message-wrapper.user {
    margin-right: 0;
  }

  .message-avatar {
    flex-shrink: 0;
    display: flex;
    align-items: flex-start;
    padding-top: 4px;
  }

  .avatar-circle {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 600;
  }

  .avatar-circle.user {
    background-color: #f5f5f5;
    color: #71717a;
  }

  .avatar-circle.assistant {
    background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
    color: white;
    box-shadow: 0 4px 12px rgba(14, 165, 233, 0.3);
  }

  .message-content-container {
    flex: 1;
    min-width: 0;
  }

  .message-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  .message-role {
    font-size: 13px;
    font-weight: 600;
    color: #18181b;
  }

  .message-time {
    font-size: 11px;
    color: #71717a;
  }

  .thinking-indicator {
    font-size: 11px;
    color: #0ea5e9;
    font-weight: 500;
    animation: pulse-indicator 2s ease-in-out infinite;
  }

  @keyframes pulse-indicator {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.6;
    }
  }

  .message-bubble {
    font-size: 14px;
    line-height: 1.6;
    color: #18181b;
    word-break: break-word;
    background: white;
    border-radius: 12px;
    padding: 14px 18px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    border: 1px solid #e5e7eb;
  }

  .message-wrapper.assistant .message-bubble {
    border-left: 4px solid #0ea5e9;
    padding-left: 14px;
    background: linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%);
  }

  .text-block {
    white-space: pre-wrap;
    margin-bottom: 8px;
  }

  .text-block:last-child {
    margin-bottom: 0;
  }

  .diagram-card {
    background: white;
    border-radius: 8px;
    padding: 16px;
    margin: 8px 0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  }

  .diagram-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .chat-controls {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background-color: var(--bg-primary);
    padding: 16px 24px 24px;
    z-index: 10;
    pointer-events: none;
  }

  .controls-inner {
    max-width: 768px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
    pointer-events: auto;
  }

  .input-container {
    display: flex;
    align-items: center;
    gap: 12px;
    background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
    border: 1.5px solid #e2e8f0;
    border-radius: 20px;
    padding: 16px 22px;
    transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);
    width: 100%;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08), inset 0 1px 2px rgba(255, 255, 255, 0.5);
  }

  .input-container:focus-within {
    box-shadow: 0 12px 24px rgba(14, 165, 233, 0.15), inset 0 1px 2px rgba(255, 255, 255, 0.8);
    border-color: #0ea5e9;
    transform: translateY(-2px);
    background: linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%);
  }

  .input-prompt {
    font-size: 16px;
    font-weight: 600;
    color: #0ea5e9;
    user-select: none;
    flex-shrink: 0;
  }

  .input-wrapper {
    flex: 1;
    display: flex;
    align-items: center;
  }

  .message-input {
    width: 100%;
    border: none;
    background: transparent;
    font-size: 14px;
    color: #18181b;
    outline: none;
    font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
    resize: none;
    line-height: 1.5;
  }

  .message-input::placeholder {
    color: #71717a;
  }

  .send-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 12px;
    border: none;
    background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
    color: white;
    cursor: pointer;
    transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
    flex-shrink: 0;
    box-shadow: 0 4px 12px rgba(14, 165, 233, 0.3);
  }

  .send-button:hover:not(:disabled) {
    background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(14, 165, 233, 0.4);
  }

  .send-button:disabled {
    background: #e5e7eb;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  .stop-icon {
    width: 12px;
    height: 12px;
    background-color: white;
    border-radius: 2px;
  }

  .mode-selector {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    background: linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(59, 130, 246, 0.05) 100%);
    padding: 8px;
    border-radius: 14px;
    border: 1.5px solid rgba(14, 165, 233, 0.2);
    box-shadow: 0 2px 8px rgba(14, 165, 233, 0.05);
  }

  .mode-group {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .workspace-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background-color: #f5f5f5;
    border-radius: 6px;
  }

  .ws-label {
    font-size: 11px;
    font-weight: 600;
    color: #71717a;
    white-space: nowrap;
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
    background: #d4d4d8;
    border-radius: 3px;
  }
  .messages-scroll::-webkit-scrollbar-thumb:hover {
    background: #a1a1aa;
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .messages-inner {
      max-width: 100%;
    }

    .messages-scroll {
      padding: 12px 8px;
      padding-bottom: 160px;
    }

    .message-wrapper {
      gap: 10px;
    }

    .avatar-circle {
      width: 28px;
      height: 28px;
      font-size: 11px;
    }

    .chat-controls {
      padding: 12px 12px 16px;
      left: 0;
      right: 0;
    }

    .controls-inner {
      max-width: 100%;
      padding: 0 4px;
    }

    .input-container {
      padding: 14px 16px;
      border-radius: 18px;
      gap: 10px;
    }

    .message-bubble {
      font-size: 13px;
      padding: 12px 14px;
      border-radius: 10px;
    }

    .message-wrapper.assistant .message-bubble {
      padding-left: 12px;
      border-left-width: 3px;
    }

    /* Empty state mobile adjustments */
    .empty-state {
      padding: 40px 16px;
      gap: 20px;
      min-height: auto;
      margin: 16px;
    }

    .empty-title {
      font-size: 26px;
    }

    .empty-text {
      font-size: 14px;
      max-width: 100%;
      padding: 0 8px;
    }

    .mode-selector {
      gap: 6px;
      padding: 6px;
    }

    .send-button {
      width: 36px;
      height: 36px;
    }

    .input-prompt {
      font-size: 14px;
    }
  }

  @media (max-width: 480px) {
    .messages-scroll {
      padding: 8px 4px;
      padding-bottom: 140px;
    }

    .message-wrapper {
      gap: 8px;
    }

    .avatar-circle {
      width: 24px;
      height: 24px;
      font-size: 10px;
    }

    .chat-controls {
      padding: 10px 8px 12px;
    }

    .input-container {
      padding: 12px 14px;
      border-radius: 16px;
    }

    .message-bubble {
      font-size: 12px;
      padding: 10px 12px;
    }

    .empty-state {
      padding: 32px 12px;
      gap: 16px;
    }

    .empty-title {
      font-size: 22px;
    }

    .mode-selector {
      gap: 4px;
      padding: 4px;
    }
  }
</style>
