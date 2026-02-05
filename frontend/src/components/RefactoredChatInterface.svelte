<script lang="ts">
  /**
   * RefactoredChatInterface Component
   *
   * Orchestrates the chat interface using modular components.
   * Features:
   * - ChatGPT-inspired minimal design
   * - Modular message bubbles with actions
   * - Centered input with model selector
   * - Scroll navigation for long threads
   * - G-Agent integration with status/memory panels
   */
  import { onMount, tick } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import { get } from 'svelte/store';

  // Chat components
  import {
    CenteredChatInput,
    ChatHeader,
    MessageBubble,
    ScrollNavigation,
    StreamingIndicator,
    SuggestedModesCard,
  } from './chat';

  // Existing components
  import FrownyFace from './FrownyFace.svelte';
  import ToolCallCard from './ToolCallCard.svelte';
  import ToolResultCard from './ToolResultCard.svelte';
  import ShipMode from './ShipMode.svelte';
  import SettingsScreen from './TabbedSettingsScreen.svelte';
  import FreeAgentLocalConfirmModal from './FreeAgentLocalConfirmModal.svelte';
  import AIQuestionModal from './AIQuestionModal.svelte';
  import ModelPicker from './ModelPicker.svelte';
  import GAgentPlanViewer from './GAgentPlanViewer.svelte';
  import GAgentPlanApproval from './GAgentPlanApproval.svelte';
  import GAgentLiveOutput from './GAgentLiveOutput.svelte';
  import GAgentMemoryPanel from './GAgentMemoryPanel.svelte';
  import GAgentStatusPanel from './gAgent/GAgentStatusPanel.svelte';

  // Streaming service
  import { streamChat } from '../lib/chatStreaming';
  import type { ChatStreamEvent } from '../lib/chatStreaming';
  import {
    fetchApi,
    listSessionAttachments,
    addSessionAttachments,
    removeSessionAttachment,
    type SessionAttachment,
  } from '../lib/api';

  // Verdict integration
  import { verdictMiddleware } from '../lib/chatMiddleware';

  // Stores
  import { showToast } from '../stores/toastStore';
  import { sessionsStore, currentSession } from '../stores/sessionsStore';
  import { runMode as runModeStore } from '../stores/runModeStore';
  import { chatModeStore } from '../stores/chatModeStore';
  import { settingsStore } from '../stores/settingsStore';
  import { workspaceStore } from '../stores/workspaceStore';
  import { showSettings, focusChatTrigger, setCurrentView, currentView } from '../stores/uiStore';
  import type { ViewType } from '../stores/uiStore';
  import { addSavedPrompt } from '../stores/savedPromptsStore';
  import {
    gAgentPlanStore,
    currentPlan as gAgentCurrentPlan,
    isExecuting as gAgentIsExecuting,
  } from '../stores/gAgentPlanStore';
  import { gAgentStore, isConnected as gAgentConnected } from '../stores/gAgentStore';
  import { gAgentCompilerStore, compilerStats } from '../stores/gAgentCompilerStore';

  // Utilities
  import { processError, logError } from '../utils/errorHandler';
  import { trackMessageSent, trackError } from '../lib/analytics';
  import { Mic, BookOpen, LayoutGrid, MessageCircle, Sparkles, FolderOpen, X, Bot } from 'lucide-svelte';

  import type { Message, ContentBlock } from '../types';

  /** Views that can be opened from the chat mode bar (secondary row). G-Agent is accessed from sidebar/session, not this strip. */
  const CHAT_VIEW_MODES: { id: ViewType; label: string; icon: typeof Mic }[] = [
    { id: 'voiceCode', label: 'Voice', icon: Mic },
    { id: 'askDocs', label: 'Ask Docs', icon: BookOpen },
    { id: 'canvas', label: 'Canvas', icon: LayoutGrid },
    { id: 'talkMode', label: 'Talk', icon: MessageCircle },
    { id: 'skills', label: 'Skills', icon: Sparkles },
  ];

  // Props
  interface Props {
    initialMessages?: Message[];
    onmessagesUpdated?: (messages: Message[]) => void;
  }

  let { initialMessages = $bindable(undefined), onmessagesUpdated }: Props = $props();

  // Default welcome message
  const defaultMessage: Message = {
    role: 'assistant',
    content:
      "Tell me what you want to build. I'll design the architecture and help you code it section by section.",
  };

  // State
  let messages = $state<Message[]>(initialMessages || [defaultMessage]);
  let inputText = $state('');
  let messagesRef: HTMLElement | null = $state(null);
  let inputRef: HTMLTextAreaElement | null = $state(null);
  let streaming = $state(false);
  let streamingBlocks = $state<ContentBlock[]>([]);
  let activeController: AbortController | null = $state(null);
  let lastUserMessage = $state('');
  let expandedModelIndex = $state<number | null>(null);
  let currentModelKey = $state<string>('auto');
  const MAX_PENDING_IMAGES = 3;
  const MAX_PENDING_DOCUMENTS = 3;
  let pendingImages = $state<string[]>([]);
  let pendingDocuments = $state<File[]>([]);
  let showModelPicker = $state(false);
  let addToProjectBannerDismissed = $state(false);
  let sessionAttachments = $state<SessionAttachment[]>([]);
  let sessionAttachmentsLoading = $state(false);
  let sessionAttachmentInputEl = $state<HTMLInputElement | null>(null);

  const showAddToProjectBanner = $derived.by(() => {
    if (addToProjectBannerDismissed) return false;
    const userMessages = messages.filter((m) => m.role === 'user').length;
    return userMessages >= 3;
  });

  // G-Agent state
  let showFreeAgentLocalConfirm = $state(false);
  let showGAgentPlanApproval = $state(false);
  let showGAgentLiveOutput = $state(false);
  let showGAgentMemoryPanel = $state(false);
  let showGAgentStatusPanel = $state(false);
  let liveOutputRef: GAgentLiveOutput | null = $state(null);
  /** Ref used only by bind:this in template (TS 6133: never read in script) */
  // @ts-ignore
  let memoryPanelRef: GAgentMemoryPanel | null = $state(null);

  // Chat mode (includes 'ship' for local Ship view; store has design | code | argument)
  let chatMode = $state<
    'normal' | 'plan' | 'spec' | 'ship' | 'execute' | 'design' | 'argument' | 'code'
  >('normal');
  const shipModeActive = $derived(chatMode === 'ship');
  /** Show AI question modal before opening SHIP (user confirms first) */
  let showShipConfirmModal = $state(false);

  /** Label for top-right mode indicator (Chat view only) */
  const modeIndicatorLabel = $derived(
    shipModeActive
      ? 'Ship'
      : chatMode === 'plan'
        ? 'Plan'
        : chatMode === 'spec'
          ? 'Spec'
          : $chatModeStore === 'design'
            ? 'Architecture'
            : $chatModeStore === 'code'
              ? 'Code'
              : 'Chat'
  );

  /** Flowchart labels under the input – change when mode changes */
  const modeFlowchartLabels = $derived.by(() => {
    if (shipModeActive) return ['Code', 'Ship', 'Deploy'];
    if (chatMode === 'plan') return ['Plan', 'Tasks', 'Code', 'Ship'];
    if (chatMode === 'spec') return ['Requirements', 'Spec', 'Plan', 'Code', 'Ship'];
    if ($chatModeStore === 'argument') return ['Idea', 'Argument', 'Constraints'];
    if ($chatModeStore === 'code') return ['Implement', 'Review', 'Ship'];
    if ($chatModeStore === 'design') return ['Describe', 'Design', 'Spec', 'Plan', 'Code', 'Ship'];
    return ['Describe', 'Design', 'Spec', 'Plan', 'Code', 'Ship'];
  });

  // Confirmed Free Agent sessions
  const freeAgentLocalConfirmedSessionIds = new Set<string>();

  // Derived state
  const showSettingsValue = $derived($showSettings);
  let isNimProvider = $state(false);
  let gAgentSessionId = $derived(get(currentSession)?.id ?? 'default');
  let hasGAgentPlan = $derived($gAgentCurrentPlan !== null);
  let isGAgentSession = $derived(
    get(currentSession)?.sessionType === 'gAgent' ||
      get(currentSession)?.sessionType === 'freeAgent'
  );
  let isGAgentExecuting = $derived($gAgentIsExecuting);

  // Model display name
  const modelDisplayName = $derived(() => {
    if (currentModelKey === 'auto') return 'Auto';
    const parts = currentModelKey.split(':');
    if (parts.length > 1) {
      const modelId = parts[1];
      // Shorten model names
      if (modelId.includes('/')) {
        return modelId.split('/').pop() || modelId;
      }
      return modelId;
    }
    return currentModelKey;
  });

  // Project/session name for header (show when user has entered a named project; nothing for new chats)
  const headerProjectName = $derived(
    $currentSession?.name && $currentSession.name !== 'New Chat' ? $currentSession.name : ''
  );

  // Event dispatcher
  const dispatch = createEventDispatcher<{ 'messages-updated': Message[] }>();

  // Sync messages to parent
  let lastSyncedMessages: Message[] | null = null;
  $effect(() => {
    if (!onmessagesUpdated || streaming) return;
    if (messages === lastSyncedMessages) return;
    lastSyncedMessages = messages;
    onmessagesUpdated(messages);
  });

  // Subscribe to chat mode store (when store is 'code', preserve plan/spec so they don't flip to Code)
  $effect(() => {
    if (!chatModeStore) return;
    const storeVal = $chatModeStore;
    if (storeVal === 'design' || storeVal === 'argument' || storeVal === 'none') {
      chatMode = storeVal as typeof chatMode;
    }
    // When store is 'code', leave chatMode unchanged so Plan/Spec stay selected
  });

  // Focus input when triggered
  $effect(() => {
    const t = $focusChatTrigger;
    if (t > 0 && inputRef) inputRef.focus();
  });

  // G-Agent connection & events
  $effect(() => {
    if (!isGAgentSession) return;

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
      } else if (event.type === 'task_completed') {
        liveOutputRef.addEvent(
          'task_completed',
          `Completed in ${event.durationMs}ms`,
          event.taskId
        );
      } else if (event.type === 'plan_completed') {
        liveOutputRef.addEvent(
          'plan_completed',
          `Plan ${event.status} in ${event.durationMs}ms`,
          undefined
        );
        if (event.status === 'completed') {
          showToast('Plan completed successfully!', 'success', 5000);
        }
      }
    });

    return () => {
      unsubscribe();
      gAgentStore.disconnect();
    };
  });

  // Mode button handlers (Architecture, Code, Ship) – toggle off when clicking active mode
  function setModeArchitecture() {
    if ($chatModeStore === 'design') {
      chatModeStore.clearMode();
      chatMode = 'normal';
    } else {
      chatModeStore.setMode('design');
      chatMode = 'design';
    }
  }
  function setModeCode() {
    if ($chatModeStore === 'code') {
      chatModeStore.clearMode();
      chatMode = 'normal';
    } else {
      chatModeStore.setMode('code');
      chatMode = 'code';
    }
  }
  function setModeShip() {
    if (chatMode === 'ship') {
      const storeMode = get(chatModeStore);
      chatMode = storeMode === 'design' ? 'design' : storeMode === 'code' ? 'code' : 'normal';
    } else {
      chatMode = 'ship';
    }
  }

  function setModeArgument() {
    if ($chatModeStore === 'argument') {
      chatModeStore.clearMode();
      chatMode = 'normal';
    } else {
      chatModeStore.setMode('argument');
      chatMode = 'argument';
    }
  }

  function setModePlan() {
    if (chatMode === 'plan') {
      chatModeStore.clearMode();
      chatMode = 'normal';
    } else {
      chatModeStore.setMode('code');
      chatMode = 'plan';
      window.dispatchEvent(new CustomEvent('switch-plan-mode'));
    }
  }

  function setModeSpec() {
    if (chatMode === 'spec') {
      chatModeStore.clearMode();
      chatMode = 'normal';
    } else {
      chatModeStore.setMode('code');
      chatMode = 'spec';
      window.dispatchEvent(new CustomEvent('switch-spec-mode'));
    }
  }

  // Initialize settings
  onMount(() => {
    const s = settingsStore.getCurrent();
    if (s?.models?.defaultModelId) {
      currentModelKey = `${s.models.defaultProvider ?? 'nim'}:${s.models.defaultModelId}`;
    }

    const unsub = settingsStore.subscribe((settings) => {
      if (settings?.models?.defaultModelId) {
        currentModelKey = `${settings.models.defaultProvider ?? 'nim'}:${settings.models.defaultModelId}`;
      }
      isNimProvider = (settings?.models?.defaultProvider ?? '') === 'nim';
    });

    const onOpenShipMode = () => {
      showShipConfirmModal = true;
    };
    const onCloseShipMode = () => {
      const storeMode = get(chatModeStore);
      chatMode = storeMode === 'design' ? 'design' : storeMode === 'code' ? 'code' : 'normal';
    };
    const onSwitchPlanMode = () => {
      chatModeStore.setMode('code');
      chatMode = 'plan';
    };
    const onSwitchSpecMode = () => {
      chatModeStore.setMode('code');
      chatMode = 'spec';
    };
    const onInsertSavedPrompt = (e: CustomEvent<{ text: string }>) => {
      if (e.detail?.text != null) {
        inputText = e.detail.text;
        tick().then(() => inputRef?.focus());
      }
    };
    const onSaveCurrentPrompt = () => {
      const text = inputText?.trim();
      if (!text) {
        showToast('Nothing to save – type a prompt first', 'info');
        return;
      }
      try {
        addSavedPrompt(text);
        showToast('Prompt saved. Use Ctrl+K and search "Insert" to use it.', 'success');
      } catch (err) {
        showToast('Failed to save prompt', 'error');
      }
    };
    window.addEventListener('open-ship-mode', onOpenShipMode);
    window.addEventListener('close-ship-mode', onCloseShipMode);
    window.addEventListener('switch-plan-mode', onSwitchPlanMode);
    window.addEventListener('switch-spec-mode', onSwitchSpecMode);
    window.addEventListener('insert-saved-prompt', onInsertSavedPrompt as EventListener);
    window.addEventListener('save-current-prompt', onSaveCurrentPrompt);

    document.addEventListener('keydown', handleGlobalKeydown);
    inputRef?.focus();

    return () => {
      unsub();
      window.removeEventListener('open-ship-mode', onOpenShipMode);
      window.removeEventListener('close-ship-mode', onCloseShipMode);
      window.removeEventListener('switch-plan-mode', onSwitchPlanMode);
      window.removeEventListener('switch-spec-mode', onSwitchSpecMode);
      window.removeEventListener('insert-saved-prompt', onInsertSavedPrompt as EventListener);
      window.removeEventListener('save-current-prompt', onSaveCurrentPrompt);
      document.removeEventListener('keydown', handleGlobalKeydown);
    };
  });

  // Keyboard shortcuts (Ctrl+K is handled in App.svelte to avoid double-toggle)
  function handleGlobalKeydown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key === ',') {
      event.preventDefault();
      showSettings.set(true);
      return;
    }
    if (event.key === 'Escape' && streaming) {
      event.preventDefault();
      cancelGeneration();
      return;
    }
  }

  async function loadSessionAttachments() {
    const sid = $currentSession?.id;
    if (!sid) {
      sessionAttachments = [];
      return;
    }
    sessionAttachmentsLoading = true;
    try {
      sessionAttachments = await listSessionAttachments(sid);
    } catch {
      sessionAttachments = [];
    } finally {
      sessionAttachmentsLoading = false;
    }
  }

  $effect(() => {
    const sid = $currentSession?.id;
    if (sid) loadSessionAttachments();
    else sessionAttachments = [];
  });

  async function handleAddSessionAttachments(files: FileList | null) {
    const sid = $currentSession?.id;
    if (!sid || !files?.length) return;
    const items: Array<{ name: string; mimeType: string; size: number; dataBase64?: string }> = [];
    const maxSize = 500 * 1024;
    for (const file of Array.from(files)) {
      if (file.size > maxSize) continue;
      const dataBase64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => {
          const s = r.result as string;
          resolve(s.includes(',') ? (s.split(',')[1] ?? '') : s);
        };
        r.onerror = () => reject(r.error);
        r.readAsDataURL(file);
      });
      items.push({
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        dataBase64,
      });
    }
    if (items.length === 0) return;
    try {
      const added = await addSessionAttachments(sid, items);
      sessionAttachments = [...sessionAttachments, ...added];
      showToast('Attachments added', 'success');
    } catch {
      showToast('Failed to add attachments', 'error');
    }
    if (sessionAttachmentInputEl) sessionAttachmentInputEl.value = '';
  }

  async function handleRemoveSessionAttachment(attachmentId: string) {
    const sid = $currentSession?.id;
    if (!sid) return;
    try {
      await removeSessionAttachment(sid, attachmentId);
      sessionAttachments = sessionAttachments.filter((a) => a.id !== attachmentId);
      showToast('Attachment removed', 'success');
    } catch {
      showToast('Failed to remove attachment', 'error');
    }
  }

  // Scroll helpers
  function scrollToBottom() {
    if (messagesRef) {
      messagesRef.scrollTop = messagesRef.scrollHeight;
    }
  }

  // Submit handling
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
    const s = settingsStore.getCurrent();
    const isNim = (s?.models?.defaultProvider ?? '') === 'nim';
    const hasImage = pendingImages.length > 0;
    const hasDocs = pendingDocuments.length > 0;
    const canSend = text || (isNim && hasImage) || hasDocs;

    if (!canSend || streaming) return;

    lastUserMessage = text;
    trackMessageSent(text.length);

    // Add user message
    messages = [...messages, { role: 'user', content: text, timestamp: Date.now() }];
    inputText = '';

    // Check for verdict command first
    let isVerdictCommand = false;
    try {
      isVerdictCommand = await verdictMiddleware(text, (blocks: ContentBlock[]) => {
        // Inject verdict response into messages
        messages = [...messages, { role: 'assistant', content: blocks, timestamp: Date.now() }];
        if ($currentSession) {
          sessionsStore.updateSession($currentSession.id, messages);
        } else {
          sessionsStore.createSession(messages);
        }
        dispatch('messages-updated', messages);
      });
    } catch (err: unknown) {
      console.warn('Verdict middleware error:', err);
      // Fall through to normal chat if verdict processing fails
    }

    // If it was a verdict command, we're done
    if (isVerdictCommand) {
      return;
    }

    // Start streaming for normal chat
    const controller = new AbortController();
    activeController = controller;
    streaming = true;
    streamingBlocks = [];

    await tick();
    scrollToBottom();

    try {
      await runStreamingChat(controller.signal);
    } catch (err: unknown) {
      const errorContext = processError(err as Error, async () => {
        if (lastUserMessage) {
          inputText = lastUserMessage;
          await tick();
          sendMessage();
        }
      });
      logError(errorContext, { mode: get(chatModeStore) });
      trackError('api_error', errorContext.message);
      const message =
        errorContext.userMessage?.trim() ||
        'Something went wrong. Check your connection and try again.';
      showToast(message, 'error', 5000);
    } finally {
      streaming = false;
      activeController = null;
    }
  }

  async function runStreamingChat(signal: AbortSignal) {
    const s = settingsStore.getCurrent();
    const provider = s?.models?.defaultProvider ?? 'nim';
    const sessionTypeVal = get(currentSession)?.sessionType ?? 'chat';
    const ws = get(workspaceStore).root || undefined;
    const mode =
      get(chatModeStore) === 'argument' ? 'argument' : chatMode !== 'normal' ? chatMode : 'normal';

    // Capture first image for vision (backend may support multiple later)
    const imageForRequest = pendingImages[0] ?? undefined;
    pendingImages = [];
    pendingDocuments = [];

    // Handle stream events
    const handleEvent = async (event: ChatStreamEvent) => {
      if (event.type === 'text' || event.type === 'tool_call' || event.type === 'tool_result') {
        streamingBlocks = [...event.blocks];
        await tick();
        scrollToBottom();
      } else if (event.type === 'error') {
        showToast(event.error || 'Stream error', 'error', 5000);
      }
    };

    // Use the streaming service
    const blocks = await streamChat(messages, {
      mode,
      sessionType: sessionTypeVal,
      workspaceRoot: ws,
      provider,
      modelId: s?.models?.defaultModelId,
      signal,
      onEvent: handleEvent,
      lastUserMessageImage: imageForRequest,
    });

    // Finalize message
    messages = [...messages, { role: 'assistant', content: blocks, timestamp: Date.now() }];
    streamingBlocks = [];

    // Save session
    if ($currentSession) {
      sessionsStore.updateSession($currentSession.id, messages);
    } else {
      sessionsStore.createSession(messages);
    }
    dispatch('messages-updated', messages);
  }

  function cancelGeneration() {
    if (activeController) {
      activeController.abort();
      activeController = null;
    }
    streaming = false;
    streamingBlocks = [];
  }

  // Message actions
  function handleCopyMessage(_content: string) {
    // Already handled by MessageBubble
  }

  function handleEditMessage(_index: number, content: string) {
    inputText = content;
    inputRef?.focus();
  }

  function handleRegenerateMessage() {
    if (messages.length < 2) return;
    // Remove last assistant message and resend
    messages = messages.slice(0, -1);
    inputText = lastUserMessage;
    sendMessage();
  }

  // Model selection
  function handleModelSelect(provider: string, modelId?: string) {
    currentModelKey = modelId ? `${provider}:${modelId}` : 'auto';
    settingsStore.save({
      models: {
        defaultProvider: provider as 'nim',
        defaultModelId: modelId,
      },
    });
    showModelPicker = false;
  }

  // G-Agent: activate in this chat without swapping tabs; create session if needed
  function handleUseGAgent() {
    const session = get(currentSession);
    if (session?.id) {
      sessionsStore.setSessionType(session.id, 'gAgent');
      showGAgentStatusPanel = true;
      showToast(
        'G-Agent mode on. Use Status and Memory in the header, or open G-Agent from the sidebar for settings.',
        'info',
        5000
      );
    } else {
      sessionsStore.createSession([], undefined, 'gAgent');
      showGAgentStatusPanel = true;
      showToast('G-Agent mode on. Start a conversation or open G-Agent from the sidebar.', 'info', 5000);
    }
  }

  // G-Agent: leave mode and stay in chat
  function handleLeaveGAgent() {
    const session = get(currentSession);
    if (session?.id && isGAgentSession) {
      sessionsStore.setSessionType(session.id, 'chat');
      showGAgentStatusPanel = false;
      showGAgentMemoryPanel = false;
      showToast('Left G-Agent mode. This chat is now normal.', 'info', 3000);
    }
  }
</script>

<div class="chat-interface">
  {#if showSettingsValue}
    <SettingsScreen onBack={() => showSettings.set(false)} />
  {:else}
    <div class="chat-container">
      <!-- Header + model picker dropdown -->
      <div class="header-wrapper">
        <ChatHeader
          projectName={headerProjectName}
          {isGAgentSession}
          isConnected={$gAgentConnected}
          showStatusPanel={showGAgentStatusPanel}
          showMemoryPanel={showGAgentMemoryPanel}
          modelName={modelDisplayName()}
          modelPickerOpen={showModelPicker}
          onGAgentClick={() => handleUseGAgent()}
          onStatusToggle={() => (showGAgentStatusPanel = !showGAgentStatusPanel)}
          onMemoryToggle={() => (showGAgentMemoryPanel = !showGAgentMemoryPanel)}
          onModelClick={() => (showModelPicker = !showModelPicker)}
          onLeaveGAgent={() => handleLeaveGAgent()}
        />
        {#if showModelPicker}
          <div class="model-picker-dropdown">
            <ModelPicker
              value={currentModelKey}
              compact={false}
              showAuto={true}
              onSelect={handleModelSelect}
            />
          </div>
        {/if}
      </div>

      <!-- Main content area -->
      {#if chatMode === 'ship'}
        <div class="ship-mode-container">
          <ShipMode />
        </div>
      {:else}
        <div class="chat-main" class:with-sidebar={showGAgentMemoryPanel}>
          <!-- Status panel: only mount when G-Agent is in use (panel open, plan, or executing) to avoid backend connect on every load -->
          {#if isGAgentSession && (showGAgentStatusPanel || hasGAgentPlan || isGAgentExecuting)}
            <aside class="status-sidebar">
              <GAgentStatusPanel
                sessionId={gAgentSessionId}
                compact={false}
                showCompiler={true}
                showBudget={true}
              />
            </aside>
          {/if}

          <!-- Chat content -->
          <div class="chat-content">
            <!-- G-Agent Plan Viewer -->
            {#if isGAgentSession && hasGAgentPlan}
              <div class="plan-panel">
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

            <!-- Live Output -->
            {#if isGAgentSession && (showGAgentLiveOutput || isGAgentExecuting)}
              <div class="live-output-panel">
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

            <!-- Messages -->
            <div class="messages-container" bind:this={messagesRef}>
              <div class="messages-inner" class:is-empty={messages.length <= 1 && !streaming}>
                {#if messages.length <= 1 && !streaming}
                  <div class="empty-state">
                    <FrownyFace size="lg" state="idle" animated={true} />
                    <h1 class="empty-title">What are we building?</h1>
                    <p class="empty-subtitle">
                      Describe your project and I'll help design the architecture
                    </p>
                  </div>
                {:else}
                  {#each messages as msg, index}
                    <MessageBubble
                      message={msg}
                      {index}
                      isLastAssistant={index === messages.length - 1 && msg.role === 'assistant'}
                      isModelExpanded={expandedModelIndex === index}
                      {streaming}
                      onToggleModelDetails={() =>
                        (expandedModelIndex = expandedModelIndex === index ? null : index)}
                      onEdit={handleEditMessage}
                      onRegenerate={handleRegenerateMessage}
                      onCopy={handleCopyMessage}
                      onFeedback={$currentSession
                        ? (idx, rating) => {
                            fetchApi('/api/gagent/feedback', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                messageId: `${$currentSession.id}-${idx}`,
                                rating,
                              }),
                            }).catch(() => {});
                          }
                        : undefined}
                    />
                  {/each}

                  {#if showAddToProjectBanner}
                    <div class="add-to-project-banner">
                      <span class="banner-icon"><FolderOpen size={18} strokeWidth={2} /></span>
                      <span class="banner-text">Add this conversation to a project?</span>
                      <button
                        type="button"
                        class="banner-btn"
                        onclick={() => setCurrentView('projects')}
                      >
                        View Projects
                      </button>
                      <button
                        type="button"
                        class="banner-dismiss"
                        onclick={() => (addToProjectBannerDismissed = true)}
                        aria-label="Dismiss"
                      >
                        <X size={14} strokeWidth={2} />
                      </button>
                    </div>
                  {/if}

                  {#if streaming}
                    <div class="streaming-message">
                      <StreamingIndicator streaming={true} />
                      {#if streamingBlocks.length > 0}
                        <div class="streaming-content">
                          {#each streamingBlocks as block}
                            {#if block.type === 'text'}
                              <div class="text-block">{block.content}</div>
                            {:else if block.type === 'tool_call'}
                              <ToolCallCard toolCall={block} />
                            {:else if block.type === 'tool_result'}
                              <ToolResultCard toolResult={block} />
                            {/if}
                          {/each}
                        </div>
                      {/if}
                    </div>
                  {:else if messages.length >= 2 && messages[messages.length - 1]?.role === 'assistant'}
                    <SuggestedModesCard
                      onSelectMode={(view) => {
                        if (view === 'chat') return;
                        setCurrentView(view);
                      }}
                    />
                  {/if}
                {/if}
              </div>
            </div>

            <!-- Scroll navigation -->
            <ScrollNavigation scrollContainer={messagesRef} />
          </div>

          <!-- Memory sidebar -->
          {#if isGAgentSession && showGAgentMemoryPanel}
            <aside class="memory-sidebar">
              <!-- svelte-ignore state_referenced_locally -->
              <GAgentMemoryPanel
                bind:this={memoryPanelRef}
                compact={true}
                onPatternSelect={(pattern) => {
                  showToast(`Pattern: ${pattern.name}`, 'info');
                }}
              />
            </aside>
          {/if}
        </div>
      {/if}

      <!-- Input area -->
      <div class="input-area">
        {#if isGAgentSession && $compilerStats}
          <div class="stats-bar">
            <span class="stat">
              <span class="stat-label">Compression</span>
              <span class="stat-value"
                >{Math.round($compilerStats.compressionEfficiency * 100)}x</span
              >
            </span>
            <span class="stat">
              <span class="stat-label">Saved</span>
              <span class="stat-value">{($compilerStats.tokensSaved / 1000).toFixed(1)}K</span>
            </span>
            <span class="stat connection">
              <span class="conn-dot" class:connected={$gAgentConnected}></span>
              {$gAgentConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        {/if}

        {#if chatMode !== 'ship'}
          {#if $currentSession?.id}
            <details class="session-attachments-details">
              <summary class="session-attachments-summary">
                Attachments ({sessionAttachments.length})
              </summary>
              <div class="session-attachments-body">
                {#if sessionAttachmentsLoading}
                  <p class="session-attachments-hint">Loading…</p>
                {:else}
                  <input
                    type="file"
                    bind:this={sessionAttachmentInputEl}
                    multiple
                    accept="image/*,.pdf,.txt,.md,.doc,.docx"
                    class="session-attachment-input"
                    onchange={(e) =>
                      handleAddSessionAttachments((e.target as HTMLInputElement)?.files ?? null)}
                    aria-label="Attach file to session"
                  />
                  <button
                    type="button"
                    class="session-attach-btn"
                    onclick={() => sessionAttachmentInputEl?.click()}
                  >
                    Attach file
                  </button>
                  {#if sessionAttachments.length > 0}
                    <ul class="session-attachments-list">
                      {#each sessionAttachments as att (att.id)}
                        <li class="session-attachment-item">
                          <span class="session-attachment-name" title={att.name}>{att.name}</span>
                          <span class="session-attachment-size"
                            >({(att.size / 1024).toFixed(1)} KB)</span
                          >
                          <button
                            type="button"
                            class="session-attachment-remove"
                            onclick={() => handleRemoveSessionAttachment(att.id)}
                            aria-label="Remove {att.name}"
                          >
                            <X size={12} strokeWidth={2} />
                          </button>
                        </li>
                      {/each}
                    </ul>
                  {/if}
                {/if}
              </div>
            </details>
          {/if}
          <div class="input-row">
            <button
              type="button"
              class="talk-mode-btn"
              onclick={() => setCurrentView('talkMode')}
              title="Talk Mode – live talking chat with the AI"
            >
              <MessageCircle size={18} strokeWidth={2} />
              <span>Talk</span>
            </button>
            <div class="input-main">
              <CenteredChatInput
                bind:value={inputText}
                bind:inputRef
                {streaming}
                isNimProvider={true}
                hasPendingImage={pendingImages.length > 0}
                hasPendingDocuments={pendingDocuments.length > 0}
                pendingImageCount={pendingImages.length}
                pendingDocumentCount={pendingDocuments.length}
                modelName={modelDisplayName()}
                hideModelSelector={true}
                onSubmit={handleSubmit}
                onCancel={cancelGeneration}
                onImageSelect={(url) => {
                  if (pendingImages.length < MAX_PENDING_IMAGES) {
                    pendingImages = [...pendingImages, url];
                    showToast('Image attached', 'success');
                  }
                }}
                onDocumentSelect={(file) => {
                  if (pendingDocuments.length >= MAX_PENDING_DOCUMENTS) return;
                  pendingDocuments = [...pendingDocuments, file];
                  showToast(`Document "${file.name}" attached`, 'success');
                }}
                onModelClick={() => (showModelPicker = !showModelPicker)}
              />
            </div>
          </div>
        {/if}

        <!-- Shortcut hint only – mode buttons removed; AI offers modes after responding -->
        <div class="mode-bottom-row">
          <div class="shortcut-hint-bottom">
            <span class="shortcut-hint-label"><kbd>Ctrl</kbd>+<kbd>K</kbd> for commands</span>
          </div>
        </div>

        <!-- G-Agent floating button: bottom-right of chat interface -->
        <div class="g-agent-floating-wrap">
          {#if isGAgentSession}
            <button
              type="button"
              class="g-agent-floating-btn g-agent-floating-leave"
              onclick={() => handleLeaveGAgent()}
              title="Leave G-Agent mode and return to normal chat"
            >
              Leave G-Agent
            </button>
          {:else}
            <button
              type="button"
              class="g-agent-floating-btn g-agent-floating-primary"
              onclick={() => handleUseGAgent()}
              title="Turn on G-Agent mode in this chat"
            >
              <span class="g-agent-floating-icon"><Bot size={18} /></span>
              Use G-Agent
            </button>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <!-- Modals -->
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
    onRejected={() => (showGAgentPlanApproval = false)}
  />

  <AIQuestionModal
    bind:open={showShipConfirmModal}
    title="Run SHIP?"
    message="Do you want to run SHIP (Design → Spec → Plan → Code) for this project? You'll be taken to the SHIP workflow to describe your app and generate architecture, spec, plan, and code."
    confirmLabel="Start SHIP"
    cancelLabel="Cancel"
    onConfirm={() => {
      showShipConfirmModal = false;
      chatMode = 'ship';
      setCurrentView('chat');
    }}
    onClose={() => (showShipConfirmModal = false)}
  />
</div>

<style>
  .chat-interface {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    background: var(--color-bg, #ffffff);
    font-family:
      'Inter',
      -apple-system,
      BlinkMacSystemFont,
      sans-serif;
  }

  .chat-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
  }

  .header-wrapper {
    position: relative;
    flex-shrink: 0;
  }

  /* Bottom row: shortcut hint only (mode buttons removed) */
  .mode-bottom-row {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem 1rem 0.5rem;
    flex-shrink: 0;
    border-top: 1px solid var(--color-border, #f3f4f6);
    background: var(--color-bg-subtle, #fafafa);
  }

  /* Main area */
  .chat-main {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .chat-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
  }

  /* Ship mode */
  .ship-mode-container {
    flex: 1;
    overflow: auto;
    padding: 1rem;
    background: var(--color-bg-secondary, #f9fafb);
  }

  /* Sidebars */
  .status-sidebar {
    width: 320px;
    border-right: 1px solid var(--color-border, #e5e7eb);
    background: var(--color-bg-subtle, #f9fafb);
    overflow-y: auto;
    animation: slideInLeft 0.3s ease;
  }

  .memory-sidebar {
    width: 360px;
    border-left: 1px solid var(--color-border, #e5e7eb);
    background: var(--color-bg-inset, #1e1e3f);
    overflow: hidden;
    animation: slideInRight 0.3s ease;
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

  @keyframes slideInRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  /* Plan and live output panels */
  .plan-panel {
    padding: 1rem;
    border-bottom: 1px solid var(--color-border, #e5e7eb);
    background: var(--color-bg-secondary, #f9fafb);
    max-height: 50vh;
    overflow-y: auto;
  }

  .live-output-panel {
    height: 280px;
    border-bottom: 1px solid var(--color-border, #e5e7eb);
    background: var(--color-bg-inset, #1a1a2e);
  }

  /* Messages */
  .messages-container {
    flex: 1;
    overflow-y: auto;
    padding: 2rem 1rem;
    scroll-behavior: smooth;
    display: flex;
    flex-direction: column;
  }

  .messages-inner {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
  }

  .messages-inner.is-empty {
    flex: 1;
    justify-content: flex-start;
    padding-top: 2rem;
  }

  /* Empty state – positioned higher on screen */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 2rem 1.5rem;
    gap: 0.5rem;
    text-align: center;
    width: 100%;
    min-height: 120px;
  }

  .empty-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-text, #111827);
    margin: 0;
  }

  .empty-subtitle {
    font-size: 0.875rem;
    color: var(--color-text-muted, #6b7280);
    margin: 0;
  }

  .shortcut-hint-bottom {
    flex-shrink: 0;
  }

  .shortcut-hint-label {
    font-size: 0.6875rem;
    color: var(--color-text-muted, #9ca3af);
  }

  .shortcut-hint-label kbd {
    padding: 0.125rem 0.25rem;
    font-size: 0.625rem;
    background: rgba(255, 255, 255, 0.5);
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 0.25rem;
  }

  /* G-Agent floating button: bottom-right of chat */
  .g-agent-floating-wrap {
    position: absolute;
    bottom: 1rem;
    right: 1rem;
    z-index: 20;
    pointer-events: auto;
  }

  .g-agent-floating-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    font-size: 0.8125rem;
    font-weight: 600;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: var(--shadow-md, 0 4px 12px rgba(0, 0, 0, 0.06));
    border: 1px solid transparent;
  }

  .g-agent-floating-primary {
    background: var(--color-primary, #7c3aed);
    color: white;
    border-color: var(--color-primary, #7c3aed);
  }

  .g-agent-floating-primary:hover {
    background: var(--color-primary-hover, #6d28d9);
    border-color: var(--color-primary-hover, #6d28d9);
    box-shadow: var(--shadow-glow, 0 6px 26px rgba(124, 58, 237, 0.35));
  }

  .g-agent-floating-leave {
    background: var(--color-bg-card, #fff);
    color: var(--color-text-muted, #6b7280);
    border-color: var(--color-border, #e5e7eb);
  }

  .g-agent-floating-leave:hover {
    background: var(--color-error-subtle, rgba(239, 68, 68, 0.1));
    border-color: var(--color-error-border, rgba(239, 68, 68, 0.3));
    color: var(--color-error, #ef4444);
  }

  .g-agent-floating-icon {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Streaming message */
  .add-to-project-banner {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    margin: 0 0 1rem;
    background: linear-gradient(135deg, rgba(124, 58, 237, 0.08), rgba(124, 58, 237, 0.04));
    border: 1px solid rgba(124, 58, 237, 0.2);
    border-radius: 10px;
    max-width: 600px;
  }

  .banner-icon {
    flex-shrink: 0;
    color: var(--color-primary, #7c3aed);
  }

  .banner-text {
    flex: 1;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text, #111827);
  }

  .banner-btn {
    flex-shrink: 0;
    padding: 0.35rem 0.75rem;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-primary, #7c3aed);
    background: rgba(124, 58, 237, 0.12);
    border: 1px solid rgba(124, 58, 237, 0.3);
    border-radius: 8px;
    cursor: pointer;
    transition:
      background 0.15s,
      border-color 0.15s;
  }

  .banner-btn:hover {
    background: rgba(124, 58, 237, 0.18);
    border-color: rgba(124, 58, 237, 0.5);
  }

  .banner-dismiss {
    flex-shrink: 0;
    padding: 0.25rem;
    color: var(--color-text-muted, #6b7280);
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition:
      color 0.15s,
      background 0.15s;
  }

  .banner-dismiss:hover {
    color: var(--color-text, #111827);
    background: rgba(0, 0, 0, 0.05);
  }

  .streaming-message {
    padding: 1rem 1.5rem;
  }

  .streaming-content {
    margin-top: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .text-block {
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.6;
    color: #1f2937;
  }

  /* Input area - compact height, pulled down from bottom edge */
  .input-area {
    padding: 0.3rem 1rem 0.75rem 0.35rem;
    margin-bottom: 0.5rem;
    background: var(--color-bg, #ffffff);
    border-top: 1px solid var(--color-border, #e5e7eb);
    position: relative;
  }

  .session-attachments-details {
    width: 100%;
    margin-bottom: 0.5rem;
    font-size: 0.8125rem;
  }

  .session-attachments-summary {
    cursor: pointer;
    color: var(--color-text-muted, #71717a);
    padding: 0.25rem 0;
    list-style: none;
  }

  .session-attachments-summary::-webkit-details-marker {
    display: none;
  }

  .session-attachments-body {
    padding: 0.5rem 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .session-attachment-input {
    position: absolute;
    width: 0;
    height: 0;
    opacity: 0;
    pointer-events: none;
  }

  .session-attach-btn {
    align-self: flex-start;
    padding: 0.35rem 0.75rem;
    font-size: 0.8125rem;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 6px;
    background: var(--color-bg-card, #fff);
    color: var(--color-text, #18181b);
    cursor: pointer;
  }

  .session-attach-btn:hover {
    background: var(--color-bg-card-hover, #f3f4f6);
  }

  .session-attachments-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .session-attachment-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0.5rem;
    background: var(--color-bg-subtle, #f4f4f5);
    border-radius: 6px;
    font-size: 0.8125rem;
  }

  .session-attachment-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .session-attachment-size {
    color: var(--color-text-muted, #71717a);
    flex-shrink: 0;
  }

  .session-attachment-remove {
    flex-shrink: 0;
    padding: 0.2rem;
    border: none;
    background: transparent;
    color: var(--color-text-muted, #71717a);
    cursor: pointer;
    border-radius: 4px;
  }

  .session-attachment-remove:hover {
    background: rgba(220, 38, 38, 0.1);
    color: #dc2626;
  }

  .session-attachments-hint {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--color-text-muted, #71717a);
  }

  .input-row {
    display: flex;
    align-items: flex-end;
    gap: 0.5rem;
    width: 100%;
  }

  .input-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .talk-mode-btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.75rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-text-muted, #6b7280);
    background: var(--color-bg-card, #fff);
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 0.5rem;
    cursor: pointer;
    flex-shrink: 0;
    transition:
      background 0.15s,
      border-color 0.15s,
      color 0.15s;
  }

  .talk-mode-btn:hover {
    background: var(--color-primary-subtle, rgba(124, 58, 237, 0.08));
    border-color: var(--color-primary, #7c3aed);
    color: var(--color-primary, #7c3aed);
  }

  .stats-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1.25rem;
    padding: 0.25rem 0.5rem;
    margin-bottom: 0.35rem;
    background: linear-gradient(90deg, rgba(16, 185, 129, 0.05), rgba(124, 58, 237, 0.05));
    border-radius: 0.5rem;
    font-size: 0.75rem;
  }

  .stat {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .stat-label {
    color: #6b7280;
  }

  .stat-value {
    font-weight: 600;
    color: #10b981;
  }

  .stat.connection {
    margin-left: auto;
    color: #6b7280;
  }

  .conn-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #ef4444;
  }

  .conn-dot.connected {
    background: #10b981;
  }

  .model-picker-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 0.25rem;
    min-width: 360px;
    max-width: 420px;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.75rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
    z-index: 100;
    padding: 0.5rem;
  }

  .model-picker-dropdown :global(.model-picker-trigger) {
    min-width: 100%;
  }

  .model-picker-dropdown :global(.model-picker-dropdown) {
    min-width: 100%;
    max-height: 420px;
  }

  @media (prefers-reduced-motion: reduce) {
    .status-sidebar,
    .memory-sidebar {
      animation: none;
    }

    .messages-container {
      scroll-behavior: auto;
    }
  }
</style>
