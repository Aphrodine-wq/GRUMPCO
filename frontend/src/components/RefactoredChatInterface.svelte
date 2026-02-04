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
  } from './chat';

  // Existing components
  import FrownyFace from './FrownyFace.svelte';
  import ToolCallCard from './ToolCallCard.svelte';
  import ToolResultCard from './ToolResultCard.svelte';
  import ShipMode from './ShipMode.svelte';
  import SettingsScreen from './TabbedSettingsScreen.svelte';
  import FreeAgentLocalConfirmModal from './FreeAgentLocalConfirmModal.svelte';
  import ModelPicker from './ModelPicker.svelte';
  import GAgentPlanViewer from './GAgentPlanViewer.svelte';
  import GAgentPlanApproval from './GAgentPlanApproval.svelte';
  import GAgentLiveOutput from './GAgentLiveOutput.svelte';
  import GAgentMemoryPanel from './GAgentMemoryPanel.svelte';
  import GAgentStatusPanel from './gAgent/GAgentStatusPanel.svelte';

  // Streaming service
  import { streamChat } from '../lib/chatStreaming';
  import type { ChatStreamEvent } from '../lib/chatStreaming';
  import { fetchApi } from '../lib/api';

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
  import { Mic, BookOpen, LayoutGrid, MessageCircle, Sparkles } from 'lucide-svelte';

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
  let pendingImageDataUrl = $state<string | null>(null);
  let showModelPicker = $state(false);

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
  let chatMode = $state<'normal' | 'plan' | 'spec' | 'ship' | 'execute' | 'design' | 'argument' | 'code'>('normal');
  const shipModeActive = $derived(chatMode === 'ship');

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
      chatMode = 'ship';
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

  // Keyboard shortcuts
  function handleGlobalKeydown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
      event.preventDefault();
      // Command palette - could trigger search
      return;
    }
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
    const hasImage = Boolean(pendingImageDataUrl);
    const canSend = text || (isNim && hasImage);

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
      showToast(errorContext.userMessage, 'error', 5000);
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

    // Clear pending image (TODO: pass to streaming service for vision support)
    pendingImageDataUrl = null;

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
</script>

<div class="chat-interface">
  {#if showSettingsValue}
    <SettingsScreen onBack={() => showSettings.set(false)} />
  {:else}
    <div class="chat-container">
      <!-- Header + model picker dropdown -->
      <div class="header-wrapper">
        <div class="mode-indicator" aria-label="Current mode">{modeIndicatorLabel}</div>
        <ChatHeader
          {isGAgentSession}
          isConnected={$gAgentConnected}
          showStatusPanel={showGAgentStatusPanel}
          showMemoryPanel={showGAgentMemoryPanel}
          modelName={modelDisplayName()}
          modelPickerOpen={showModelPicker}
          onGAgentClick={() => setCurrentView('freeAgent')}
          onStatusToggle={() => (showGAgentStatusPanel = !showGAgentStatusPanel)}
          onMemoryToggle={() => (showGAgentMemoryPanel = !showGAgentMemoryPanel)}
          onModelClick={() => (showModelPicker = !showModelPicker)}
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
          <!-- Status panel -->
          {#if isGAgentSession && showGAgentStatusPanel}
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
          <CenteredChatInput
            bind:value={inputText}
            bind:inputRef
            {streaming}
            {isNimProvider}
            hasPendingImage={!!pendingImageDataUrl}
            modelName={modelDisplayName()}
            hideModelSelector={true}
            onSubmit={handleSubmit}
            onCancel={cancelGeneration}
            onImageSelect={(url) => {
              pendingImageDataUrl = url;
              showToast('Image attached', 'success');
            }}
            onModelClick={() => (showModelPicker = !showModelPicker)}
          />
        {/if}

        <!-- Mode strip below chat input (Argument, Plan, Spec, Architecture, Code, Ship) -->
        <div class="mode-strip-bottom">
          <button
            type="button"
            class="mode-btn"
            class:active={$chatModeStore === 'argument'}
            onclick={setModeArgument}
            aria-pressed={$chatModeStore === 'argument'}
            title="Argument – refine ideas and constraints"
          >
            Argument
          </button>
          <button
            type="button"
            class="mode-btn"
            class:active={chatMode === 'plan'}
            onclick={setModePlan}
            aria-pressed={chatMode === 'plan'}
            title="Plan – break down into tasks"
          >
            Plan
          </button>
          <button
            type="button"
            class="mode-btn"
            class:active={chatMode === 'spec'}
            onclick={setModeSpec}
            aria-pressed={chatMode === 'spec'}
            title="Spec – write requirements"
          >
            Spec
          </button>
          <button
            type="button"
            class="mode-btn"
            class:active={$chatModeStore === 'design'}
            onclick={setModeArchitecture}
            aria-pressed={$chatModeStore === 'design'}
            title="Architecture – design system and structure"
          >
            Architecture
          </button>
          <button
            type="button"
            class="mode-btn"
            class:active={$chatModeStore === 'code' && chatMode !== 'plan' && chatMode !== 'spec'}
            onclick={setModeCode}
            aria-pressed={$chatModeStore === 'code' && chatMode !== 'plan' && chatMode !== 'spec'}
            title="Code – implement"
          >
            Code
          </button>
          <button
            type="button"
            class="mode-btn"
            class:active={shipModeActive}
            onclick={setModeShip}
            aria-pressed={shipModeActive}
            title="Ship – run full pipeline"
          >
            Ship
          </button>
        </div>
        <div class="mode-flowchart" aria-hidden="true">
          <span class="flow-label">Describe</span>
          <span class="flow-arrow" aria-hidden="true">→</span>
          <span class="flow-label">Design</span>
          <span class="flow-arrow" aria-hidden="true">→</span>
          <span class="flow-label">Spec</span>
          <span class="flow-arrow" aria-hidden="true">→</span>
          <span class="flow-label">Plan</span>
          <span class="flow-arrow" aria-hidden="true">→</span>
          <span class="flow-label">Code</span>
          <span class="flow-arrow" aria-hidden="true">→</span>
          <span class="flow-label">Ship</span>
        </div>
        <div class="shortcut-hint-bottom">
          <span class="shortcut-hint-label"><kbd>Ctrl</kbd>+<kbd>K</kbd> search</span>
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
  }

  .header-wrapper {
    position: relative;
    flex-shrink: 0;
  }

  .mode-indicator {
    position: absolute;
    top: 0.5rem;
    right: 1rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: #6b7280;
    background: #f3f4f6;
    padding: 0.25rem 0.5rem;
    border-radius: 6px;
    border: 1px solid #e5e7eb;
    z-index: 1;
    pointer-events: none;
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
    border-right: 1px solid #e5e7eb;
    background: #f9fafb;
    overflow-y: auto;
    animation: slideInLeft 0.3s ease;
  }

  .memory-sidebar {
    width: 360px;
    border-left: 1px solid var(--color-border, #e5e7eb);
    background: linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%);
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
    background: #1a1a2e;
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
    justify-content: center;
  }

  /* Empty state – pushed up, slightly smaller */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem 1.5rem;
    gap: 0.5rem;
    text-align: center;
    width: 100%;
    min-height: 120px;
  }

  .empty-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #111827;
    margin: 0;
  }

  .empty-subtitle {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0;
  }

  .mode-btn {
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: #6b7280;
    background: transparent;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    cursor: pointer;
    transition: color 0.15s, background 0.15s, border-color 0.15s;
    flex-shrink: 0;
  }

  .mode-btn:hover {
    color: #374151;
    background: #f9fafb;
    border-color: #d1d5db;
  }

  .mode-btn.active {
    color: #7c3aed;
    background: rgba(124, 58, 237, 0.08);
    border-color: rgba(124, 58, 237, 0.35);
  }

  /* Mode strip below chat input (Architecture, Code, Ship only) */
  .mode-strip-bottom {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    flex-shrink: 0;
    border-top: 1px solid #f3f4f6;
  }

  .mode-flowchart {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    padding: 0.35rem 1rem;
    flex-shrink: 0;
    font-size: 0.6875rem;
    color: var(--color-text-muted, #9ca3af);
  }

  .mode-flowchart .flow-label {
    font-weight: 500;
  }

  .mode-flowchart .flow-arrow {
    opacity: 0.7;
  }

  .shortcut-hint-bottom {
    display: flex;
    justify-content: flex-end;
    padding: 0.25rem 1rem 0.5rem;
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

  /* Streaming message */
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

  /* Input area */
  .input-area {
    padding: 1rem;
    background: white;
    border-top: 1px solid #e5e7eb;
    position: relative;
  }

  .stats-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    padding: 0.5rem;
    margin-bottom: 0.75rem;
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
