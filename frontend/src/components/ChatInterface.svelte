<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import { get } from 'svelte/store';
  import { Bot, Zap, Octagon } from 'lucide-svelte';

  import DiagramRenderer from './DiagramRenderer.svelte';
  import FrownyFace from './FrownyFace.svelte';
  import ToolCallCard from './ToolCallCard.svelte';
  import ToolResultCard from './ToolResultCard.svelte';
  import ShipMode from './ShipMode.svelte';
  import SettingsScreen from './SettingsScreen.svelte';
  import { Badge, Button, Card } from '../lib/design-system';
  import { exportAsSvg, downloadFile } from '../lib/mermaid';
  import { trackMessageSent, trackDiagramGenerated, trackError } from '../lib/analytics';
  import { showToast } from '../stores/toastStore';
  import { processError, logError } from '../utils/errorHandler';
  import { sessionsStore, currentSession } from '../stores/sessionsStore';
  import { runMode as runModeStore } from '../stores/runModeStore';
  import { chatModeStore } from '../stores/chatModeStore';
  import FreeAgentLocalConfirmModal from './FreeAgentLocalConfirmModal.svelte';
  import ModelPicker from './ModelPicker.svelte';
  import GAgentPlanViewer from './GAgentPlanViewer.svelte';
  import GAgentPlanApproval from './GAgentPlanApproval.svelte';
  import GAgentLiveOutput from './GAgentLiveOutput.svelte';
  import GAgentMemoryPanel from './GAgentMemoryPanel.svelte';
  import GAgentStatusPanel from './gAgent/GAgentStatusPanel.svelte';
  import KillSwitchButton from './gAgent/KillSwitchButton.svelte';
  import {
    gAgentPlanStore,
    currentPlan as gAgentCurrentPlan,
    isExecuting as gAgentIsExecuting,
  } from '../stores/gAgentPlanStore';
  import {
    gAgentStore,
    isConnected as gAgentConnected,
    isGlobalStopActive,
  } from '../stores/gAgentStore';
  import { gAgentCompilerStore, compilerStats } from '../stores/gAgentCompilerStore';
  import { workspaceStore } from '../stores/workspaceStore';
  import { openModal } from '../stores/clarificationStore';
  import { parseAssistantResponse } from '../utils/responseParser';
  import { flattenTextContent } from '../utils/contentParser';
  import { generatePlan } from '../stores/planStore';
  import { startSpecSession } from '../stores/specStore';
  import { fetchApi } from '../lib/api.js';
  import { settingsStore } from '../stores/settingsStore';
  import { preferencesStore } from '../stores/preferencesStore';
  import { colors } from '../lib/design-system/tokens/colors';
  import { showSettings, focusChatTrigger, setCurrentView } from '../stores/uiStore';
  import type { Message, ContentBlock } from '../types';

  interface Props {
    initialMessages?: Message[];
    onmessagesUpdated?: (messages: Message[]) => void;
  }

  let { initialMessages = $bindable(undefined), onmessagesUpdated }: Props = $props();

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
  let chatMode: 'normal' | 'plan' | 'spec' | 'ship' | 'execute' | 'design' | 'argument' | 'code' =
    $state('normal');
  let currentPlanId = $state<string | null>(null);
  let currentSpecSessionId = $state<string | null>(null);
  let commandPaletteOpen = $state(false);
  let editingMessageIndex = $state<number | null>(null);
  let pendingImageDataUrl = $state<string | null>(null);
  let imageInputRef = $state<HTMLInputElement | null>(null);
  let expandedModelIndex = $state<number | null>(null);
  let currentModelKey = $state<string>('auto');
  let showFreeAgentLocalConfirm = $state(false);
  let showGAgentPlanApproval = $state(false);
  let showGAgentLiveOutput = $state(false);
  let showGAgentMemoryPanel = $state(false);
  let showGAgentStatusPanel = $state(false);
  let liveOutputRef: GAgentLiveOutput | null = $state(null);
  let memoryPanelRef: GAgentMemoryPanel | null = $state(null);

  // G-Agent session ID (derived from current session)
  let gAgentSessionId = $derived(get(currentSession)?.id ?? 'default');

  /** Session IDs that have already confirmed running Free Agent locally this page load. */
  const freeAgentLocalConfirmedSessionIds = new Set<string>();

  // Use the global showSettings store
  const showSettingsValue = $derived($showSettings);
  let isNimProvider = $state(false);

  // G-Agent plan derived state
  let hasGAgentPlan = $derived($gAgentCurrentPlan !== null);
  let isGAgentSession = $derived(
    get(currentSession)?.sessionType === 'gAgent' ||
      get(currentSession)?.sessionType === 'freeAgent'
  );
  let isGAgentExecuting = $derived($gAgentIsExecuting);

  // Subscribe to G-Agent execution events for LiveOutput
  $effect(() => {
    if (!isGAgentSession) return;

    // Connect G-Agent SSE and initialize stores
    gAgentStore.connect(gAgentSessionId);
    gAgentCompilerStore.setSessionId(gAgentSessionId);
    gAgentCompilerStore.fetchStats();

    const unsubscribe = gAgentPlanStore.onExecutionEvent((event) => {
      if (!liveOutputRef) return;

      if (event.type === 'plan_started') {
        showGAgentLiveOutput = true;
        liveOutputRef.clear();
        liveOutputRef.addEvent('plan_started', `Starting: ${event.goal}`, undefined);
      } else if (event.type === 'task_started') {
        liveOutputRef.addEvent('task_started', event.description, event.taskId);
      } else if (event.type === 'task_tool_call') {
        liveOutputRef.addToolCall({
          taskId: event.taskId,
          toolName: event.toolName,
          input: event.toolInput,
        });
      } else if (event.type === 'task_tool_result') {
        liveOutputRef.updateToolCall(event.taskId, event.toolName, event.output, event.success);
      } else if (event.type === 'task_completed') {
        liveOutputRef.addEvent(
          'task_completed',
          `Completed in ${event.durationMs}ms`,
          event.taskId
        );
      } else if (event.type === 'task_failed') {
        liveOutputRef.addEvent('task_failed', event.error, event.taskId);
      } else if (event.type === 'plan_completed') {
        liveOutputRef.addEvent(
          'plan_completed',
          `Plan ${event.status} in ${event.durationMs}ms`,
          undefined
        );
        // Notify memory panel about potential new patterns
        if (event.status === 'completed' && memoryPanelRef) {
          memoryPanelRef.notifyPatternLearned(`pattern_${Date.now()}`);
        }
        // Show celebration toast on completion
        if (event.status === 'completed') {
          showToast(
            'Plan completed successfully! G-Agent has learned from this execution.',
            'success',
            5000
          );
        }
      }
    });

    return () => unsubscribe();
  });

  // Cleanup G-Agent connection on session change
  $effect(() => {
    return () => {
      if (isGAgentSession) {
        gAgentStore.disconnect();
      }
    };
  });

  $effect(() => {
    if (chatModeStore) {
      chatMode = $chatModeStore as
        | 'normal'
        | 'plan'
        | 'spec'
        | 'ship'
        | 'execute'
        | 'design'
        | 'argument'
        | 'code';
    }
  });

  onMount(() => {
    const s = settingsStore.getCurrent();
    if (s?.models?.defaultModelId) {
      currentModelKey = `${s.models.defaultProvider ?? 'nim'}:${s.models.defaultModelId}`;
    } else {
      currentModelKey = 'auto';
    }
    const unsub = settingsStore.subscribe((settings) => {
      if (settings?.models?.defaultModelId) {
        currentModelKey = `${settings.models.defaultProvider ?? 'nim'}:${settings.models.defaultModelId}`;
      } else {
        currentModelKey = 'auto';
      }
    });
    return () => unsub();
  });

  // Keyboard shortcut: focus chat input when focusChatTrigger increments (skip initial 0)
  $effect(() => {
    const t = $focusChatTrigger;
    if (t > 0 && inputRef) inputRef.focus();
  });

  // Sync messages to parent only when our local messages change (not when parent re-renders).
  // Use a ref so we don't re-call when the same array reference comes back from the store.
  let lastSyncedMessages: Message[] | null = null;
  $effect(() => {
    if (!onmessagesUpdated || streaming) return;
    if (messages === lastSyncedMessages) return;
    lastSyncedMessages = messages;
    onmessagesUpdated(messages);
  });

  function parseMessageContent(content: string | ContentBlock[]): ContentBlock[] {
    if (Array.isArray(content)) return content;
    // Basic text content might contain mermaid code blocks
    return flattenTextContent(content) as unknown as ContentBlock[];
  }

  function flattenMessagesForChatApi(
    msgs: Message[],
    opts?: { lastUserMessageImage?: string | null; provider?: string }
  ): Array<{
    role: 'user' | 'assistant';
    content:
      | string
      | { type: 'text'; text: string }[]
      | ({ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } })[];
  }> {
    const filtered = msgs.filter((m) => m.role === 'user' || m.role === 'assistant');
    const nim = opts?.provider === 'nim';
    const img = opts?.lastUserMessageImage;
    const lastUserIdx = filtered.map((m) => m.role).lastIndexOf('user');

    return filtered
      .map((m, i) => {
        const role = m.role as 'user' | 'assistant';
        const raw = typeof m.content === 'string' ? m.content : flattenTextContent(m.content);
        const text = (raw || '').trim();
        if (role === 'assistant') return { role, content: text };
        if (nim && img && i === lastUserIdx) {
          const parts: (
            | { type: 'text'; text: string }
            | { type: 'image_url'; image_url: { url: string } }
          )[] = [];
          if (text) parts.push({ type: 'text', text });
          parts.push({ type: 'image_url', image_url: { url: img } });
          return { role, content: parts };
        }
        return { role, content: text };
      })
      .filter((m) => {
        if (typeof m.content === 'string') return m.content.length > 0;
        return (m.content as { type: string; text?: string }[]).some((p) =>
          p.type === 'text' ? (p.text ?? '').trim().length > 0 : true
        );
      });
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

  function handleGlobalKeydown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
      event.preventDefault();
      commandPaletteOpen = !commandPaletteOpen;
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'i') {
      event.preventDefault();
      inputRef?.focus();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key === ',') {
      event.preventDefault();
      showSettings.set(true);
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key === '/') {
      event.preventDefault();
      showToast(
        'Keyboard Shortcuts:\nCtrl/Cmd+K: Command Palette\nCtrl/Cmd+Shift+I: Focus input\nCtrl/Cmd+,: Settings\nCtrl/Cmd+/: Show Shortcuts\nEscape: Cancel\nArrow Up: Edit Last Message',
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

  function triggerImageUpload() {
    imageInputRef?.click();
  }

  async function onImageFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    pendingImageDataUrl = dataUrl;
    showToast('Image attached', 'success');
  }

  function handleSlashCommand(text: string): boolean {
    const t = text.trim().toLowerCase();
    if (t === '/model') {
      const s = settingsStore.getCurrent();
      const provider = s?.models?.defaultProvider ?? 'nim';
      const modelId = s?.models?.defaultModelId ?? 'moonshotai/kimi-k2.5';
      showToast(`Current model: ${provider}:${modelId}`, 'info');
      return true;
    }
    if (t.startsWith('/use ')) {
      const arg = t.slice(5).trim();
      const map: Record<string, { provider: string; modelId: string }> = {
        kimi: { provider: 'nim', modelId: 'moonshotai/kimi-k2.5' },
        'nemotron-ultra': { provider: 'nim', modelId: 'nvidia/llama-3.1-nemotron-ultra-253b-v1' },
        'nemotron-super': { provider: 'nim', modelId: 'nvidia/llama-3.3-nemotron-super-49b-v1.5' },
        auto: { provider: 'nim', modelId: '' },
      };
      const choice = map[arg];
      if (choice) {
        settingsStore
          .save({
            models: {
              defaultProvider: choice.provider as 'nim',
              defaultModelId: choice.modelId || undefined,
            },
          })
          .then(() => {
            showToast(`Switched to ${choice.modelId || 'auto'}.`, 'success');
          });
        return true;
      }
    }
    return false;
  }

  function handleSubmit() {
    const session = get(currentSession);
    const runMode = get(runModeStore);
    if (
      (session?.sessionType === 'gAgent' || session?.sessionType === 'freeAgent') &&
      runMode === 'local' &&
      !freeAgentLocalConfirmedSessionIds.has(session.id)
    ) {
      showFreeAgentLocalConfirm = true;
      return;
    }
    sendMessage();
  }

  function confirmFreeAgentLocal() {
    const session = get(currentSession);
    if (session?.id) freeAgentLocalConfirmedSessionIds.add(session.id);
    showFreeAgentLocalConfirm = false;
    sendMessage();
  }

  async function sendMessage() {
    const text = inputText.trim();
    if (text.startsWith('/')) {
      if (handleSlashCommand(text)) {
        inputText = '';
        return;
      }
    }
    const s = settingsStore.getCurrent();
    const isNim = (s?.models?.defaultProvider ?? '') === 'nim';
    const hasImage = Boolean(pendingImageDataUrl);
    const canSend = text || (isNim && hasImage);
    if (!canSend || streaming) return;
    // --- Mode Switching Logic ---
    const mode = get(chatModeStore);
    lastUserMessage = text;
    trackMessageSent(text.length);

    // Initialize controller for this request
    const controller = new AbortController();
    activeController = controller;
    streaming = true;

    if (mode === 'code' && chatMode === 'plan') {
      try {
        const ws = workspaceInput.trim() || get(workspaceStore).root || undefined;
        await generatePlan({ userRequest: text, workspaceRoot: ws });
        streaming = false;
      } catch (e: any) {
        streaming = false;
        showToast(e.message || 'Error generating plan', 'error');
      }
      return;
    }

    if (mode === 'code' && chatMode === 'spec') {
      try {
        const ws = workspaceInput.trim() || get(workspaceStore).root || undefined;
        await startSpecSession({ userRequest: text, workspaceRoot: ws });
        streaming = false;
      } catch (e: any) {
        streaming = false;
        showToast(e.message || 'Error starting spec session', 'error');
      }
      return;
    }

    if (mode === 'code') {
      if (editingMessageIndex != null && editingMessageIndex >= 0) {
        const updated = [...messages];
        updated[editingMessageIndex] = { role: 'user', content: text, timestamp: Date.now() };
        messages = updated;
        editingMessageIndex = null;
      } else {
        messages = [...messages, { role: 'user', content: text, timestamp: Date.now() }];
      }
      inputText = '';
      await tick();
      scrollToBottom();
      await runCodeModeStream(controller.signal);
      return;
    }

    if (mode === 'design') {
      await runDesignModeStream(controller.signal);
      return;
    }

    // Default / Argument / Ship mode fallback
    if (editingMessageIndex !== null && editingMessageIndex >= 0) {
      const updated = [...messages];
      updated[editingMessageIndex] = { role: 'user', content: text, timestamp: Date.now() };
      messages = updated;
      editingMessageIndex = null;
    } else {
      messages = [...messages, { role: 'user', content: text, timestamp: Date.now() }];
    }
    inputText = '';
    streaming = true;
    streamingContent = '';
    streamingBlocks = [];
    await tick();
    scrollToBottom();
    scrollToBottom();
    // activeController is already set at the top, reusing it. (At this point mode is 'argument' after early returns.)
    const timeoutMs = 120000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      await runCodeModeStream(controller.signal);
    } catch (err: any) {
      streaming = false;
      const errorContext = processError(
        err,
        async () => {
          if (lastUserMessage) {
            inputText = lastUserMessage;
            await tick();
            sendMessage();
          }
        },
        undefined,
        () => {
          showSettings.set(true);
          setCurrentView('settings');
        }
      );
      logError(errorContext, { mode: get(chatModeStore), workspaceRoot: get(workspaceStore).root });
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
        } catch (parseErr) {
          // Non-JSON SSE data or malformed event - log at debug level
          if (import.meta.env.DEV) {
            console.debug('[ChatInterface] Failed to parse SSE event:', data, parseErr);
          }
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
    let fromCacheThisStream = false;
    const s = settingsStore.getCurrent();
    const provider = s?.models?.defaultProvider ?? 'nim';
    const apiMessages = flattenMessagesForChatApi(messages, {
      lastUserMessageImage: pendingImageDataUrl,
      provider,
    });
    if (apiMessages.length === 0) throw new Error('No messages to send');
    pendingImageDataUrl = null;
    let ws = workspaceInput.trim() || get(workspaceStore).root || undefined;
    if (ws) workspaceStore.setWorkspace(ws);

    // G-Agent: Compile context before sending (100x compression)
    let compiledContextData: {
      context: string;
      stats: { compressionRatio: number; tokensSaved: number };
    } | null = null;
    const sessionTypeVal = get(currentSession)?.sessionType ?? 'chat';
    if (sessionTypeVal === 'gAgent' || sessionTypeVal === 'freeAgent') {
      try {
        // Get the last user message for context compilation
        const lastUserMsg = apiMessages.filter((m) => m.role === 'user').pop();
        const queryText =
          typeof lastUserMsg?.content === 'string'
            ? lastUserMsg.content
            : Array.isArray(lastUserMsg?.content)
              ? (lastUserMsg.content as Array<{ type: string; text?: string }>)
                  .filter((b) => b.type === 'text' && b.text)
                  .map((b) => b.text!)
                  .join(' ')
              : '';

        if (queryText) {
          const compileResult = await gAgentCompilerStore.compile(queryText, {
            context: { recentFiles: [] },
            constraints: { maxTokens: 8000 },
            speculative: true,
          });

          if (compileResult) {
            compiledContextData = {
              context: compileResult.compiledContext,
              stats: {
                compressionRatio: compileResult.stats.compressionRatio,
                tokensSaved:
                  compileResult.stats.originalTokens - compileResult.stats.compiledTokens,
              },
            };
          }
        }
      } catch (e) {
        // Compilation failed, continue without compiled context
        console.warn('[ChatInterface] Context compilation failed:', e);
      }
    }

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
      sessionType: sessionTypeVal,
      // Include compiled context if available
      compiledContext: compiledContextData?.context || undefined,
      compilationStats: compiledContextData?.stats || undefined,
    };
    if (s?.models?.defaultProvider) body.provider = s.models.defaultProvider;
    if (s?.models?.defaultModelId) body.modelId = s.models.defaultModelId;
    if (s?.models?.modelPreset) body.modelPreset = s.models.modelPreset;
    if (s?.guardRails?.autonomousMode) body.autonomous = true;
    if (s?.guardRails?.useLargeContext) body.largeContext = true;
    const prefs = preferencesStore.getCurrent();
    if (prefs?.includeRagContext) body.includeRagContext = true;
    if (sessionTypeVal === 'gAgent' || sessionTypeVal === 'freeAgent') {
      if (prefs?.gAgentModelPreference || prefs?.freeAgentModelPreference) {
        body.freeAgentModelPreference =
          prefs.gAgentModelPreference ?? prefs.freeAgentModelPreference;
      }
    }
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
          } else if (ev.type === 'context' && ev.value) {
            streamingBlocks = [
              ...streamingBlocks,
              {
                type: 'context',
                content: ev.value as { mode: string; capabilities?: string[]; toolCount?: number },
              },
            ];
            await tick();
          } else if (ev.type === 'intent' && ev.value) {
            streamingBlocks = [
              ...streamingBlocks,
              { type: 'intent', content: ev.value as Record<string, unknown> },
            ];
            await tick();
          } else if (ev.type === 'from_cache' && ev.value) {
            /* Backend served from cache; next text event will be full content – show immediately. */
            fromCacheThisStream = true;
          } else if (ev.type === 'text' && ev.text) {
            const last = streamingBlocks[streamingBlocks.length - 1];
            if (fromCacheThisStream) {
              streamingBlocks = [...streamingBlocks, { type: 'text', content: ev.text }];
              fromCacheThisStream = false;
            } else if (last?.type === 'text') {
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
        } catch (parseErr) {
          // Non-JSON SSE data or malformed event - log at debug level
          if (import.meta.env.DEV) {
            console.debug('[ChatInterface] Failed to parse code stream event:', raw, parseErr);
          }
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

  async function exportSvg(msgIndex: number, blockIndex: number) {
    const key = `${msgIndex}-${blockIndex}`;
    const svgElement = diagramRefs[key]?.querySelector('svg') as SVGElement;
    if (svgElement) {
      const svgData = await exportAsSvg(svgElement);
      downloadFile(svgData, 'diagram.svg', 'image/svg+xml');
    }
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

  onMount(() => {
    inputRef?.focus();
    const w = get(workspaceStore).root;
    if (w) workspaceInput = w;
    document.addEventListener('keydown', handleGlobalKeydown);
    const unsubSettings = settingsStore.subscribe((s) => {
      isNimProvider = (s?.models?.defaultProvider ?? '') === 'nim';
    });
    const handleOpenShipMode = () => {
      chatMode = 'ship';
    };
    window.addEventListener('open-ship-mode', handleOpenShipMode);

    const handleCloseShipMode = () => {
      chatMode = 'normal';
    };
    window.addEventListener('close-ship-mode', handleCloseShipMode);

    const handleSwitchPlanMode = () => {
      chatModeStore.setMode('code');
      chatMode = 'plan';
    };
    const handleSwitchSpecMode = () => {
      chatModeStore.setMode('code');
      chatMode = 'spec';
    };
    window.addEventListener('switch-plan-mode', handleSwitchPlanMode);
    window.addEventListener('switch-spec-mode', handleSwitchSpecMode);

    return () => {
      unsubSettings();
      document.removeEventListener('keydown', handleGlobalKeydown);
      window.removeEventListener('open-ship-mode', handleOpenShipMode);
      window.removeEventListener('close-ship-mode', handleCloseShipMode);
      window.removeEventListener('switch-plan-mode', handleSwitchPlanMode);
      window.removeEventListener('switch-spec-mode', handleSwitchSpecMode);
    };
  });
</script>

<div
  class="chat-interface"
  style:--bg-primary={colors.background.primary}
  style:--bg-secondary={colors.background.secondary}
>
  {#if showSettingsValue}
    <SettingsScreen onBack={() => showSettings.set(false)} />
  {:else}
    <div class="chat-root">
      <div class="chat-viewport">
        <!-- Simplified header: G-Agent toggle + Status (modes are now automatic) -->
        <header class="chat-mode-header">
          <button
            type="button"
            class="mode-pill g-agent-btn"
            onclick={() => setCurrentView('freeAgent')}
            title="G-Agent"
          >
            <span class="g-agent-icon"><Bot size={16} /></span> G-Agent
          </button>
          {#if isGAgentSession}
            <button
              type="button"
              class="mode-pill status-toggle"
              class:active={showGAgentStatusPanel}
              onclick={() => {
                showGAgentStatusPanel = !showGAgentStatusPanel;
              }}
              title="G-Agent Status & Controls"
            >
              <span class="status-indicator {$gAgentConnected ? 'connected' : 'disconnected'}"
              ></span>
              {#if $isGlobalStopActive}
                <Octagon size={14} />
              {:else}
                <Zap size={14} />
              {/if}
              Status
            </button>
            <button
              type="button"
              class="mode-pill memory-toggle"
              class:active={showGAgentMemoryPanel}
              onclick={() => {
                showGAgentMemoryPanel = !showGAgentMemoryPanel;
              }}
              title="G-Agent Memory"
            >
              🧠 Memory
            </button>
            <!-- Compact Kill Switch always visible for G-Agent sessions -->
            <div class="header-kill-switch">
              <KillSwitchButton size="sm" showLabel={false} />
            </div>
          {/if}
          <span class="mode-header-hint"><kbd>Ctrl</kbd>+<kbd>K</kbd> to search</span>
        </header>
        {#if chatMode === 'ship'}
          <div class="ship-mode-viewport">
            <ShipMode />
          </div>
        {:else}
          <div class="chat-main-area" class:with-sidebar={showGAgentMemoryPanel}>
            <!-- G-Agent Status Panel (floating or docked) -->
            {#if isGAgentSession && showGAgentStatusPanel}
              <div class="gagent-status-sidebar">
                <GAgentStatusPanel
                  sessionId={gAgentSessionId}
                  compact={false}
                  showCompiler={true}
                  showBudget={true}
                />
              </div>
            {/if}

            <div class="chat-content">
              <!-- G-Agent Plan Viewer (shown when there's an active plan) -->
              {#if isGAgentSession && hasGAgentPlan}
                <div class="gagent-plan-panel">
                  <GAgentPlanViewer
                    compact={false}
                    workspaceRoot={$workspaceStore.root ?? undefined}
                    onApprove={() => {
                      showGAgentPlanApproval = false;
                    }}
                    onCancel={() => {
                      gAgentPlanStore.clearPlan();
                    }}
                  />
                </div>
              {/if}

              <!-- G-Agent Live Output (shown during execution) -->
              {#if isGAgentSession && (showGAgentLiveOutput || isGAgentExecuting)}
                <div class="gagent-live-output-panel">
                  <GAgentLiveOutput
                    bind:this={liveOutputRef}
                    isExecuting={isGAgentExecuting}
                    currentTaskId={$gAgentCurrentPlan?.tasks.find((t) => t.status === 'in_progress')
                      ?.id ?? ''}
                    onClose={() => {
                      showGAgentLiveOutput = false;
                    }}
                  />
                </div>
              {/if}

              <div class="messages-scroll" bind:this={messagesRef}>
                <div class="messages-inner">
                  {#if messages.length <= 1 && !streaming}
                    <div class="empty-state">
                      <Card variant="flat" padding="lg">
                        <FrownyFace size="lg" state="idle" animated={true} />
                        <h1 class="empty-title">What are we building?</h1>
                      </Card>
                    </div>
                  {/if}

                  {#each messages as msg, index}
                    <div class="message-wrapper {msg.role}">
                      <div class="message-avatar">
                        {#if msg.role === 'user'}
                          <div class="avatar-circle user">U</div>
                        {:else}
                          <FrownyFace size="sm" state="idle" animated={false} />
                        {/if}
                      </div>
                      <div class="message-content-container">
                        <div class="message-meta">
                          <span class="message-role">{msg.role === 'user' ? 'You' : 'G-Rump'}</span>
                          {#if msg.timestamp}<span class="message-time"
                              >{formatTimestamp(msg.timestamp)}</span
                            >{/if}
                          {#if msg.role === 'assistant' && msg.model}
                            <span class="model-badge">
                              <span class="model-name">{msg.model}</span>
                              <button
                                type="button"
                                class="model-details-toggle"
                                onclick={() =>
                                  (expandedModelIndex =
                                    expandedModelIndex === index ? null : index)}
                                title="Routing details"
                              >
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  stroke-width="2"
                                >
                                  <circle cx="12" cy="12" r="10" />
                                  <path d="M12 16v-4M12 8h.01" />
                                </svg>
                              </button>
                            </span>
                          {/if}
                        </div>
                        {#if msg.role === 'assistant' && msg.routingDecision && expandedModelIndex === index}
                          <div class="model-details">
                            {#if msg.routingDecision.complexity != null}
                              <span>Complexity: {msg.routingDecision.complexity}</span>
                            {/if}
                            {#if msg.routingDecision.reason}
                              <span>Reason: {msg.routingDecision.reason}</span>
                            {/if}
                            {#if msg.routingDecision.estimatedCost != null}
                              <span>Est. cost: {msg.routingDecision.estimatedCost}</span>
                            {/if}
                          </div>
                        {/if}
                        <div class="message-bubble">
                          {#if typeof msg.content === 'string'}
                            {#each parseMessageContent(msg.content) as block, bIdx}
                              {#if block.type === 'text'}
                                <div class="text-block">{block.content}</div>
                              {:else if block.type === 'mermaid'}
                                <div
                                  class="diagram-card"
                                  use:setupDiagramRef={{ index, blockIdx: bIdx }}
                                >
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
                              {:else if block.type === 'context'}
                                <details class="context-block">
                                  <summary
                                    >Context: {block.content.mode} · {block.content.toolCount ?? 0} tools</summary
                                  >
                                  {#if block.content.capabilities?.length}
                                    <p class="context-capabilities">
                                      {block.content.capabilities.join(', ')}
                                    </p>
                                  {/if}
                                </details>
                              {:else if block.type === 'intent'}
                                <details class="intent-block">
                                  <summary>Intent</summary>
                                  <pre class="intent-content">{JSON.stringify(
                                      block.content,
                                      null,
                                      2
                                    )}</pre>
                                </details>
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
                        <FrownyFace size="sm" state="thinking" animated={true} />
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
                              {:else if block.type === 'context'}
                                <details class="context-block">
                                  <summary
                                    >Context: {block.content.mode} · {block.content.toolCount ?? 0} tools</summary
                                  >
                                  {#if block.content.capabilities?.length}
                                    <p class="context-capabilities">
                                      {block.content.capabilities.join(', ')}
                                    </p>
                                  {/if}
                                </details>
                              {:else if block.type === 'intent'}
                                <details class="intent-block">
                                  <summary>Intent</summary>
                                  <pre class="intent-content">{JSON.stringify(
                                      block.content,
                                      null,
                                      2
                                    )}</pre>
                                </details>
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
            </div>
            <!-- .chat-content -->

            <!-- G-Agent Memory Sidebar -->
            {#if isGAgentSession && showGAgentMemoryPanel}
              <div class="gagent-memory-sidebar">
                <GAgentMemoryPanel
                  bind:this={memoryPanelRef}
                  compact={true}
                  onPatternSelect={(pattern) => {
                    showToast(
                      `Pattern: ${pattern.name} (${Math.round(pattern.confidence * 100)}% confidence)`,
                      'info'
                    );
                  }}
                />
              </div>
            {/if}
          </div>
          <!-- .chat-main-area -->
        {/if}

        <div class="chat-controls">
          <!-- G-Agent Quick Stats Bar -->
          {#if isGAgentSession && $compilerStats}
            <div class="gagent-quick-stats">
              <div class="stat-item">
                <span class="stat-label">Compression</span>
                <span class="stat-value compression"
                  >{Math.round($compilerStats.compressionEfficiency * 100)}x</span
                >
              </div>
              <div class="stat-item">
                <span class="stat-label">Tokens Saved</span>
                <span class="stat-value">{($compilerStats.tokensSaved / 1000).toFixed(1)}K</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Cache Hits</span>
                <span class="stat-value"
                  >{Math.round(
                    ($compilerStats.cacheHits /
                      Math.max(1, $compilerStats.cacheHits + $compilerStats.cacheMisses)) *
                      100
                  )}%</span
                >
              </div>
              <div class="stat-item connection">
                <span class="connection-dot {$gAgentConnected ? 'connected' : 'disconnected'}"
                ></span>
                <span class="stat-label">{$gAgentConnected ? 'Connected' : 'Disconnected'}</span>
              </div>
            </div>
          {/if}

          <div class="controls-inner">
            {#if chatMode !== 'ship'}
              <div class="input-row">
                <!-- Model selector on left side -->
                <div class="model-selector-left">
                  <ModelPicker
                    value={currentModelKey}
                    compact={true}
                    showAuto={true}
                    onSelect={(provider, modelId) => {
                      currentModelKey = modelId ? `${provider}:${modelId}` : 'auto';
                      settingsStore
                        .save({
                          models: {
                            defaultProvider: provider as 'nim',
                            defaultModelId: modelId ?? undefined,
                          },
                        })
                        .then(() => {
                          showToast(
                            modelId ? `Switched to ${modelId}` : 'Auto (smart routing)',
                            'success'
                          );
                        });
                    }}
                  />
                </div>

                <form
                  class="input-container"
                  onsubmit={(e) => {
                    e.preventDefault();
                    handleSubmit();
                  }}
                >
                  <span class="input-prompt">&gt;</span>
                  <div class="input-wrapper">
                    <input
                      bind:value={inputText}
                      bind:this={inputRef}
                      placeholder="Describe what you want to build..."
                      class="message-input"
                      disabled={streaming}
                    />
                  </div>
                  {#if isNimProvider}
                    <input
                      type="file"
                      accept="image/*"
                      class="hidden-file-input"
                      bind:this={imageInputRef}
                      onchange={onImageFileChange}
                      aria-label="Attach image"
                    />
                    <button
                      type="button"
                      class="attach-image-btn"
                      title="Attach image (Kimi)"
                      aria-label="Attach image"
                      onclick={triggerImageUpload}
                      disabled={streaming}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      {#if pendingImageDataUrl}
                        <span class="attach-badge">1</span>
                      {/if}
                    </button>
                  {/if}
                  <button
                    class="send-button"
                    type="submit"
                    disabled={(!inputText.trim() && !(isNimProvider && pendingImageDataUrl)) ||
                      streaming}
                  >
                    {#if streaming}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        class="lucide lucide-x"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg
                      >
                    {:else}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        class="lucide lucide-arrow-up"
                        ><path d="m5 12 7-7 7 7" /><path d="M12 19V5" /></svg
                      >
                    {/if}
                  </button>
                </form>
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}

  <FreeAgentLocalConfirmModal
    open={showFreeAgentLocalConfirm}
    onConfirm={confirmFreeAgentLocal}
    onCancel={() => (showFreeAgentLocalConfirm = false)}
  />

  <GAgentPlanApproval
    open={showGAgentPlanApproval}
    onClose={() => (showGAgentPlanApproval = false)}
    onApproved={() => {
      showGAgentPlanApproval = false;
      gAgentPlanStore.startExecution();
    }}
    onRejected={() => {
      showGAgentPlanApproval = false;
    }}
  />
</div>

<style>
  .chat-interface {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    background-color: var(--bg-primary);
    position: relative;
    font-family: 'Inter', sans-serif;
  }

  /* Chat Reset */
  .chat-interface :global(*) {
    box-sizing: border-box;
  }

  .chat-root {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .chat-viewport {
    flex: 1;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
  }

  .ship-mode-viewport {
    flex: 1;
    overflow: auto;
    padding: 1rem;
    background-color: var(--bg-secondary);
  }

  .gagent-plan-panel {
    padding: 1rem;
    border-bottom: 1px solid var(--border-color, #e5e5e5);
    background: var(--bg-secondary, #f9fafb);
    max-height: 50vh;
    overflow-y: auto;
  }

  /* G-Agent Main Layout with Optional Sidebar */
  .chat-main-area {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .chat-main-area .chat-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transition: width 0.3s ease;
  }

  .chat-main-area.with-sidebar .chat-content {
    /* Reduce width when sidebar is open */
    flex: 1 1 auto;
  }

  /* G-Agent Live Output Panel */
  .gagent-live-output-panel {
    height: 300px;
    min-height: 200px;
    max-height: 50vh;
    border-bottom: 1px solid var(--border-color, #e5e5e5);
    background: #1a1a2e;
  }

  /* G-Agent Memory Sidebar */
  .gagent-memory-sidebar {
    width: 360px;
    min-width: 280px;
    max-width: 400px;
    border-left: 1px solid var(--border-color, #e5e5e5);
    background: linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%);
    overflow: hidden;
    animation: slideIn 0.3s ease;
  }

  /* G-Agent Status Sidebar */
  .gagent-status-sidebar {
    width: 320px;
    min-width: 280px;
    max-width: 380px;
    border-right: 1px solid var(--border-color, #e5e5e5);
    background: linear-gradient(180deg, #111827 0%, #1f2937 100%);
    overflow-y: auto;
    animation: slideInLeft 0.3s ease;
    padding: 0.5rem;
  }

  @keyframes slideInLeft {
    from {
      transform: translateX(-100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  /* Memory toggle button style */
  .chat-mode-header .mode-pill.memory-toggle {
    margin-left: auto;
    margin-right: 1rem;
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(59, 130, 246, 0.1));
    border: 1px solid rgba(139, 92, 246, 0.3);
  }

  .chat-mode-header .mode-pill.memory-toggle.active {
    background: linear-gradient(135deg, #8b5cf6, #3b82f6);
    color: white;
  }

  /* Status toggle button styling */
  .chat-mode-header .mode-pill.status-toggle {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(59, 130, 246, 0.1));
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .chat-mode-header .mode-pill.status-toggle.active {
    background: linear-gradient(135deg, #10b981, #3b82f6);
    color: white;
  }

  .status-indicator {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .status-indicator.connected {
    background: #10b981;
    box-shadow: 0 0 4px #10b981;
  }

  .status-indicator.disconnected {
    background: #ef4444;
  }

  /* Header Kill Switch */
  .header-kill-switch {
    margin-left: 0.5rem;
  }

  .messages-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 2rem 1rem 8rem; /* Bottom padding for fixed controls */
    scroll-behavior: smooth;
  }

  .messages-inner {
    max-width: 896px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    /* Left align with margin instead of center */
    align-items: flex-start;
    justify-content: flex-start; /* Move to top as requested previously */
    padding-top: 15vh; /* Visual vertical adjustment */
    padding-left: 5vw; /* Left margin to reduce "white space" but keep breathing room */
    padding-right: 5vw;

    min-height: 400px;
    height: 100%;
    text-align: left; /* Text alignment */
    gap: 1.5rem;
  }

  .empty-title {
    font-size: 2.5rem; /* Slightly larger */
    font-weight: 700;
    color: #111827;
    margin: 0;
  }

  .empty-text {
    font-size: 1.1rem;
    color: #6b7280;
    max-width: 500px;
    line-height: 1.6;
    margin: 0;
  }

  .empty-tip {
    font-size: 0.9rem;
    color: #9ca3af;
    max-width: 500px;
    line-height: 1.5;
    margin: 0;
  }

  .empty-shortcut {
    font-size: 0.85rem;
    color: #9ca3af;
    margin: 0.5rem 0 0;
  }

  .empty-actions {
    margin: 1rem 0 0;
  }

  .empty-state :global(.card) {
    width: 100%;
    max-width: 560px;
  }

  .suggestion-chips {
    margin-top: 1rem;
    display: flex;
    justify-content: flex-start; /* Left align chips */
    flex-wrap: wrap; /* efficient wrapping */
    gap: 0.5rem;
    width: 100%;
  }

  /* Message Bubbles */
  .message-wrapper {
    display: flex;
    gap: 1rem;
    padding: 1rem;
    border-radius: 0.75rem;
    transition: background-color 0.2s;
  }

  .message-wrapper:hover {
    background-color: #f9fafb;
  }

  .message-wrapper.user {
    flex-direction: row-reverse;
  }

  .message-avatar {
    flex-shrink: 0;
    margin-top: 0.25rem;
  }

  .avatar-circle {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 0.875rem;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .avatar-circle.user {
    background-color: #3b82f6;
    color: white;
  }

  .avatar-circle.assistant {
    background-color: #10b981;
    color: white;
  }

  .message-content-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-width: 85%;
  }

  .message-wrapper.user .message-content-container {
    align-items: flex-end;
  }

  .message-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    color: #9ca3af;
  }

  .model-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.125rem 0.375rem;
    background: var(--bg-secondary, rgba(59, 130, 246, 0.15));
    border-radius: 0.25rem;
    font-size: 0.7rem;
    color: var(--text-secondary, #6b7280);
  }

  .model-name {
    font-family: monospace;
    max-width: 12rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .model-details-toggle {
    padding: 0;
    background: none;
    border: none;
    cursor: pointer;
    color: inherit;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .model-details-toggle:hover {
    color: var(--text-primary, #111);
  }

  .model-details {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    font-size: 0.7rem;
    color: var(--text-secondary, #6b7280);
    margin-bottom: 0.25rem;
    padding: 0.25rem 0;
  }

  .message-role {
    font-weight: 600;
    color: #4b5563;
  }

  .thinking-indicator {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    color: #6366f1;
    font-weight: 500;
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  /* Bubble Styling */
  .message-bubble {
    font-size: 1rem;
    line-height: 1.6;
    color: #1f2937;
    white-space: pre-wrap;
    word-break: break-word;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .message-wrapper.user .message-bubble {
    background-color: #3b82f6;
    color: white;
    padding: 0.75rem 1rem;
    border-radius: 1rem;
    border-top-right-radius: 0.25rem;
  }

  .message-wrapper.assistant .message-bubble {
    background-color: transparent;
    padding: 0;
  }

  .text-block {
    margin: 0;
  }

  /* Diagram Card */
  .diagram-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.75rem;
    overflow: hidden;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    margin: 0.5rem 0;
    display: flex;
    flex-direction: column;
  }

  .diagram-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #f3f4f6;
    background-color: #f9fafb;
  }

  /* Chat Mode Header (simplified: G-Agent + Status) */
  .chat-mode-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: var(--color-bg-subtle, #f5f3ff);
    border-bottom: 1px solid var(--color-border, #e9d5ff);
    flex-shrink: 0;
  }

  .chat-mode-header .mode-pill {
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 500;
    color: var(--color-text-muted, #6d28d9);
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .chat-mode-header .mode-pill:hover {
    color: var(--color-primary, #7c3aed);
    border-color: var(--color-border-highlight, #d8b4fe);
  }

  .chat-mode-header .mode-pill.active {
    color: white;
    background: var(--color-primary, #7c3aed);
    border-color: var(--color-primary, #7c3aed);
  }

  /* G-Agent button styling */
  .chat-mode-header .mode-pill.g-agent-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background: linear-gradient(135deg, rgba(124, 58, 237, 0.1), rgba(99, 102, 241, 0.1));
    border: 1px solid rgba(124, 58, 237, 0.3);
    font-weight: 600;
  }

  .chat-mode-header .mode-pill.g-agent-btn:hover {
    background: linear-gradient(135deg, rgba(124, 58, 237, 0.2), rgba(99, 102, 241, 0.2));
    border-color: var(--color-primary, #7c3aed);
  }

  .g-agent-icon {
    font-size: 14px;
  }

  .mode-header-hint {
    margin-left: auto;
    font-size: 11px;
    color: var(--color-text-muted, #6d28d9);
  }

  .mode-header-hint kbd {
    padding: 2px 4px;
    font-size: 10px;
    background: var(--color-bg-subtle, #f5f3ff);
    border: 1px solid var(--color-border, #e9d5ff);
    border-radius: 4px;
  }

  /* Chat Controls (Fixed Bottom) */
  .chat-controls {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: white;
    padding: 1rem;
    border-top: 1px solid #e5e7eb;
    box-shadow: 0 -4px 6px -1px rgba(0, 0, 0, 0.05);
    z-index: 10;
  }

  /* G-Agent Quick Stats Bar */
  .gagent-quick-stats {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    padding: 0.5rem 1rem;
    margin-bottom: 0.75rem;
    background: linear-gradient(
      90deg,
      rgba(16, 185, 129, 0.05),
      rgba(59, 130, 246, 0.05),
      rgba(139, 92, 246, 0.05)
    );
    border-radius: 0.5rem;
    border: 1px solid rgba(16, 185, 129, 0.15);
  }

  .gagent-quick-stats .stat-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .gagent-quick-stats .stat-label {
    font-size: 0.7rem;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  .gagent-quick-stats .stat-value {
    font-size: 0.85rem;
    font-weight: 600;
    color: #111827;
  }

  .gagent-quick-stats .stat-value.compression {
    color: #10b981;
    font-size: 0.95rem;
  }

  .gagent-quick-stats .stat-item.connection {
    margin-left: auto;
  }

  .gagent-quick-stats .connection-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .gagent-quick-stats .connection-dot.connected {
    background: #10b981;
    box-shadow: 0 0 6px rgba(16, 185, 129, 0.5);
    animation: pulse 2s ease-in-out infinite;
  }

  .gagent-quick-stats .connection-dot.disconnected {
    background: #ef4444;
  }

  .controls-inner {
    max-width: 900px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  /* Input row with model picker on left */
  .input-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    width: 100%;
  }

  .model-selector-left {
    flex-shrink: 0;
  }

  .input-container {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background-color: #f3f4f6;
    border-radius: 0.75rem;
    padding: 0.75rem 1rem;
    border: 1px solid transparent;
    transition:
      border-color 0.2s,
      box-shadow 0.2s;
  }

  .input-container:focus-within {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
    background-color: white;
  }

  .input-prompt {
    font-family: 'Fira Code', monospace;
    font-weight: 700;
    color: #6b7280;
    user-select: none;
  }

  .input-wrapper {
    flex: 1;
    display: flex;
  }

  .message-input {
    width: 100%;
    border: none;
    background: transparent;
    font-size: 1rem;
    color: #111827;
    outline: none;
    padding: 0;
  }

  .message-input::placeholder {
    color: #9ca3af;
  }

  .send-button {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.5rem;
    width: 2rem;
    height: 2rem;
    cursor: pointer;
    transition: background-color 0.2s;
    padding: 0;
  }

  .send-button:hover:not(:disabled) {
    background: #2563eb;
  }

  .send-button:disabled {
    background: #d1d5db;
    cursor: not-allowed;
  }

  .hidden-file-input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
    pointer-events: none;
  }

  .attach-image-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #e5e7eb;
    color: #4b5563;
    border: none;
    border-radius: 0.5rem;
    width: 2rem;
    height: 2rem;
    cursor: pointer;
    transition: background-color 0.2s;
    padding: 0;
  }

  .attach-image-btn:hover:not(:disabled) {
    background: #d1d5db;
  }

  .attach-image-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .attach-badge {
    position: absolute;
    top: -2px;
    right: -2px;
    background: #3b82f6;
    color: white;
    font-size: 0.65rem;
    font-weight: 600;
    min-width: 1rem;
    height: 1rem;
    border-radius: 9999px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 4px;
  }

  /* Mode Selector */
  .mode-btn {
    padding: 0.5rem 1rem;
    border-radius: 9999px;
    border: 1px solid #e5e7eb;
    background: white;
    color: #4b5563;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .mode-btn:hover {
    background: #f3f4f6;
    border-color: #d1d5db;
  }

  .mode-btn.active {
    background: #3b82f6;
    color: white;
    border-color: #3b82f6;
  }

  .model-selector-wrap {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding-left: 2rem;
  }

  .model-selector-label {
    font-size: 0.75rem;
    color: var(--text-secondary, #6b7280);
  }

  .model-selector {
    font-size: 0.8rem;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    border: 1px solid var(--border, #e5e7eb);
    background: var(--bg-primary, #fff);
    color: var(--text-primary, #111);
  }

  .mode-selector {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    padding-left: 2rem; /* Align with input text visually */
  }

  .context-block,
  .intent-block {
    margin: 0.5rem 0;
    padding: 0.5rem 0.75rem;
    background: var(--bg-subtle, #f5f5f5);
    border-radius: 6px;
    font-size: 0.8125rem;
  }

  .context-block summary,
  .intent-block summary {
    cursor: pointer;
    font-weight: 500;
    color: var(--text-secondary, #6b7280);
  }

  .context-capabilities {
    margin: 0.5rem 0 0;
    font-size: 0.75rem;
    color: var(--text-muted, #9ca3af);
  }

  .intent-content {
    margin: 0.5rem 0 0;
    padding: 0.5rem;
    background: #fff;
    border-radius: 4px;
    font-size: 0.6875rem;
    overflow-x: auto;
    white-space: pre-wrap;
    max-height: 200px;
    overflow-y: auto;
  }

  @media (max-width: 640px) {
    .mode-selector {
      padding-left: 0;
      justify-content: center;
    }

    .empty-title {
      font-size: 1.5rem;
    }

    .messages-scroll {
      padding-bottom: 10rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .messages-scroll {
      scroll-behavior: auto;
    }
    .message-wrapper,
    .input-container,
    .send-button,
    .mode-btn {
      transition: none;
    }
    .streaming-dots,
    .thinking-indicator {
      animation: none;
    }
  }
</style>
