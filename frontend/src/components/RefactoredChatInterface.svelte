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
   * - Agent integration with status/memory panels
   */
  import { onMount, tick } from 'svelte';
  import { get } from 'svelte/store';

  /** Refs for stream lifecycle: cleanup aborts on unmount and skips onEvent after unmount. */
  const streamMountedRef = { current: true };
  const activeControllerRef = { current: null as AbortController | null };

  // Chat components
  import {
    CenteredChatInput,
    ChatHeader,
    MessageBubble,
    ScrollNavigation,
    StreamingIndicator,
    PhaseProgressBar,
  } from './chat';

  // Import from new modular components
  import ChatStreamingStatus from './chat/ChatStreamingStatus.svelte';
  import { detectNumberedQuestions, type ParsedQuestion } from './chat/ChatQuestionDetector.svelte';
  import {
    extractActiveFiles,
    type ActiveFile,
    type FileAction,
  } from '../lib/chat/FileActivityTracker';
  import { createStreamEventHandler } from '../lib/chat/ChatStreamEventHandler';
  import {
    setModeArchitecture,
    setModeCode,
    setModeShip,
    setModeArgument,
    setModePlan,
    setModeSpec,
    type ModeHandlerDeps,
  } from '../lib/chat/ChatModeHandlers';
  import {
    loadAttachments,
    addAttachments,
    removeAttachment,
  } from '../lib/chat/ChatAttachmentManager';

  // Existing components
  import FrownyFace from './FrownyFace.svelte';
  import ToolCallCard from './ToolCallCard.svelte';
  import ToolResultCard from './ToolResultCard.svelte';
  import SettingsScreen from './TabbedSettingsScreen.svelte';
  import ConfirmModal from './ConfirmModal.svelte';
  import ArchitectureApprovalModal from './ArchitectureApprovalModal.svelte';
  import SectionPickerModal from './SectionPickerModal.svelte';
  import ChatQuestionModal from './ChatQuestionModal.svelte';
  import ModelPicker from './ModelPicker.svelte';

  // Streaming service
  import { streamChat, flattenMessageContent } from '../lib/chatStreaming';
  import type { ChatStreamEvent } from '../lib/chatStreaming';
  import {
    fetchApi,
    listSessionAttachments,
    addSessionAttachments,
    removeSessionAttachment,
    type SessionAttachment,
  } from '../lib/api';
  import { listMemories } from '../lib/integrationsApi';

  // Verdict integration
  import { verdictMiddleware } from '../lib/chatMiddleware';

  // Stores
  import { showToast } from '../stores/toastStore';
  import { sessionsStore, currentSession } from '../stores/sessionsStore';
  import { runMode as runModeStore } from '../stores/runModeStore';
  import { chatModeStore } from '../stores/chatModeStore';
  import { chatPhaseStore } from '../stores/chatPhaseStore';
  import { settingsStore } from '../stores/settingsStore';
  import { workspaceStore } from '../stores/workspaceStore';

  import {
    showSettings,
    focusChatTrigger,
    setCurrentView,
    currentView as _currentView,
    chatStreaming,
  } from '../stores/uiStore';
  import type { ViewType } from '../stores/uiStore';
  import { addSavedPrompt } from '../stores/savedPromptsStore';

  // Utilities
  import { processError, logError } from '../utils/errorHandler';
  import { trackMessageSent, trackError } from '../lib/analytics';
  import { Mic, BookOpen, LayoutGrid, MessageCircle, Sparkles, FolderOpen, X } from 'lucide-svelte';

  import type { Message, ContentBlock } from '../types';

  /** Views that can be opened from the chat mode bar (secondary row). Agent is accessed from sidebar/session, not this strip. */
  const _CHAT_VIEW_MODES: { id: ViewType; label: string; icon: typeof Mic }[] = [
    { id: 'voiceCode', label: 'Voice', icon: Mic },
    { id: 'askDocs', label: 'Ask Docs', icon: BookOpen },
    { id: 'canvas', label: 'Canvas', icon: LayoutGrid },
    { id: 'talkMode', label: 'Talk', icon: MessageCircle },
    { id: 'memory', label: 'Skills', icon: Sparkles },
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
  let streamingStatus = $state('Thinking...');
  let streamingBlocks = $state<ContentBlock[]>([]);
  /** Accumulated extended-thinking content from the model (emitted as thinking events). */
  let streamingThinking = $state('');
  /** Tool names currently in progress, for status summary (e.g. "Running: file_write, read_file"). */
  let streamingToolNames = $state<string[]>([]);
  /** When set, stream ended with an error; show status and optional retry CTA. */
  let streamError = $state<string | null>(null);

  // ── Claude Code-style file activity tracking (delegated to FileActivityTracker) ──
  const streamingActiveFiles = $derived.by(() => extractActiveFiles(streamingBlocks));
  let activeController: AbortController | null = $state(null);
  let lastUserMessage = $state('');
  let expandedModelIndex = $state<number | null>(null);
  let currentModelKey = $state<string>('auto');
  const MAX_PENDING_IMAGES = 3;
  const MAX_PENDING_DOCUMENTS = 3;
  const MAX_VISIBLE_MESSAGES = 60; // Only render last N messages to prevent DOM bloat
  let pendingImages = $state<string[]>([]);
  let pendingDocuments = $state<File[]>([]);
  let showModelPicker = $state(false);
  let addToProjectBannerDismissed = $state(false);
  let sessionAttachments = $state<SessionAttachment[]>([]);
  let _sessionAttachmentsLoading = $state(false);
  let sessionAttachmentInputEl = $state<HTMLInputElement | null>(null);
  let showAllMessages = $state(false);

  // Cancel stream on unmount and prevent onEvent from updating state after unmount
  $effect(() => {
    return () => {
      streamMountedRef.current = false;
      if (activeControllerRef.current) {
        activeControllerRef.current.abort();
        activeControllerRef.current = null;
      }
    };
  });

  // Only render limited messages to prevent lag on long conversations
  const visibleMessages = $derived.by(() => {
    if (showAllMessages || messages.length <= MAX_VISIBLE_MESSAGES) return messages;
    return messages.slice(-MAX_VISIBLE_MESSAGES);
  });
  const hiddenMessageCount = $derived(messages.length - visibleMessages.length);

  const showAddToProjectBanner = $derived.by(() => {
    if (addToProjectBannerDismissed) return false;
    const userMessages = messages.filter((m) => m.role === 'user').length;
    return userMessages >= 3;
  });

  // Architecture Approval + Section Picker modals
  let showApprovalModal = $state(false);
  let showSectionPicker = $state(false);
  let lastMermaidCode = $state('');

  // Chat Question Modal -- auto-detect numbered questions from AI
  let showChatQuestionModal = $state(false);
  let chatQuestionsParsed = $state<ParsedQuestion[]>([]);
  let chatQuestionsIntro = $state('');
  let chatQuestionsOutro = $state('');

  // Chat mode (includes 'ship' for local Ship view; store has design | code | argument)
  let chatMode = $state<
    'normal' | 'plan' | 'spec' | 'ship' | 'execute' | 'design' | 'argument' | 'code'
  >('normal');
  const shipModeActive = $derived(chatMode === 'ship');
  /** Show AI question modal before opening SHIP (user confirms first) */
  let showShipConfirmModal = $state(false);

  /** Label for top-right mode indicator (Chat view only) */
  const _modeIndicatorLabel = $derived(
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
  const _modeFlowchartLabels = $derived.by(() => {
    if (shipModeActive) return ['Code', 'Ship', 'Deploy'];
    if (chatMode === 'plan') return ['Plan', 'Tasks', 'Code', 'Ship'];
    if (chatMode === 'spec') return ['Requirements', 'Spec', 'Plan', 'Code', 'Ship'];
    if ($chatModeStore === 'argument') return ['Idea', 'Argument', 'Constraints'];
    if ($chatModeStore === 'code') return ['Implement', 'Review', 'Ship'];
    if ($chatModeStore === 'design') return ['Describe', 'Design', 'Spec', 'Plan', 'Code', 'Ship'];
    return ['Describe', 'Design', 'Spec', 'Plan', 'Code', 'Ship'];
  });

  // Derived state
  const showSettingsValue = $derived($showSettings);
  let _isNimProvider = $state(false);

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
  const headerProjectName = $derived.by(() => {
    const sess = $currentSession;
    if (!sess) return '';
    // Don't show default/auto-generated names
    if (!sess.name || sess.name === 'New Chat' || sess.name.startsWith('Session ')) return '';
    return sess.name;
  });

  // Event dispatcher removed — using callback props (Svelte 5 pattern)
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

  // Mode button handlers – delegated to ChatModeHandlers.ts
  const _modeDeps: ModeHandlerDeps = {
    chatModeStore,
    chatPhaseStore,
    currentSession,
    setChatMode: (m) => {
      chatMode = m;
    },
    getChatMode: () => chatMode,
  };
  function _setModeArchitecture() {
    setModeArchitecture(_modeDeps);
  }
  function _setModeCode() {
    setModeCode(_modeDeps);
  }
  function _setModeShip() {
    setModeShip(_modeDeps);
  }
  function _setModeArgument() {
    setModeArgument(_modeDeps);
  }
  function _setModePlan() {
    setModePlan(_modeDeps);
  }
  function _setModeSpec() {
    setModeSpec(_modeDeps);
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
      _isNimProvider = (settings?.models?.defaultProvider ?? '') === 'nim';
    });

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
    window.addEventListener('switch-plan-mode', onSwitchPlanMode);
    window.addEventListener('switch-spec-mode', onSwitchSpecMode);
    window.addEventListener('insert-saved-prompt', onInsertSavedPrompt as EventListener);
    window.addEventListener('save-current-prompt', onSaveCurrentPrompt);

    document.addEventListener('keydown', handleGlobalKeydown);
    inputRef?.focus();

    return () => {
      unsub();
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

  // Attachment management – delegated to ChatAttachmentManager.ts
  async function loadSessionAttachments() {
    _sessionAttachmentsLoading = true;
    sessionAttachments = await loadAttachments($currentSession?.id);
    _sessionAttachmentsLoading = false;
  }

  $effect(() => {
    const sid = $currentSession?.id;
    if (sid) loadSessionAttachments();
    else sessionAttachments = [];
  });

  async function _handleAddSessionAttachments(files: FileList | null) {
    sessionAttachments = await addAttachments($currentSession?.id, files, sessionAttachments);
    if (sessionAttachmentInputEl) sessionAttachmentInputEl.value = '';
  }

  async function _handleRemoveSessionAttachment(attachmentId: string) {
    sessionAttachments = await removeAttachment(
      $currentSession?.id,
      attachmentId,
      sessionAttachments
    );
  }

  // Scroll helpers
  function scrollToBottom() {
    if (messagesRef) {
      messagesRef.scrollTop = messagesRef.scrollHeight;
    }
  }

  // Submit handling
  function handleSubmit() {
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
    activeControllerRef.current = controller;
    streamMountedRef.current = true;
    streamError = null;
    streaming = true;
    chatStreaming.set(true);
    streamingBlocks = [];
    streamingThinking = '';
    streamingToolNames = [];

    await tick();
    scrollToBottom();

    try {
      await runStreamingChat(controller.signal);
    } catch (err: unknown) {
      streamError = err instanceof Error ? err.message : 'Stream failed';
      streamingStatus = 'Error';

      const isRetryable =
        streamError.toLowerCase().includes('rate limit') ||
        streamError.toLowerCase().includes('timeout') ||
        streamError.toLowerCase().includes('overloaded');

      const errorContext = processError(err as Error, async () => {
        if (lastUserMessage) {
          inputText = lastUserMessage;
          await tick();
          sendMessage();
        }
      });

      logError(errorContext, { mode: get(chatModeStore) });
      trackError('api_error', errorContext.message);

      const message = errorContext.userMessage?.trim() || 'Something went wrong.';
      showToast(message, isRetryable ? 'info' : 'error', 5000);
    } finally {
      streaming = false;
      chatStreaming.set(false);
      activeController = null;
      activeControllerRef.current = null;
    }
  }

  // ── Unified streaming core ────────────────────────────────────────────
  type StreamMode =
    | 'normal'
    | 'plan'
    | 'spec'
    | 'ship'
    | 'execute'
    | 'design'
    | 'argument'
    | 'code';

  /**
   * Core streaming function used by both normal chat and section-code-gen.
   * @param signal        - AbortSignal for cancellation
   * @param apiMessages   - messages to send to the backend (may differ from display messages)
   * @param modeOverride  - force a specific mode
   * @param imageForReq   - optional base64 image for vision
   * @param detectModals  - whether to auto-detect mermaid / numbered questions
   */
  async function runStreamingChatCore(
    signal: AbortSignal,
    apiMessages: Message[],
    opts: {
      modeOverride?: StreamMode;
      imageForReq?: string;
      detectModals?: boolean;
    } = {}
  ) {
    const s = settingsStore.getCurrent();
    const provider = s?.models?.defaultProvider ?? 'nim';
    const sessionTypeVal = get(currentSession)?.sessionType ?? 'chat';
    const ws = get(workspaceStore).root || undefined;

    // Resolve stream mode
    let mode: StreamMode =
      opts.modeOverride ??
      (get(chatModeStore) === 'argument'
        ? 'argument'
        : chatMode !== 'normal'
          ? (chatMode as StreamMode)
          : 'normal');

    // Auto-detect code context when in normal mode
    if (mode === 'normal' && messages.length >= 2) {
      const recentTexts = messages
        .slice(-4)
        .map((m) => (typeof m.content === 'string' ? m.content : ''))
        .join(' ')
        .toLowerCase();
      const codeCtxKw = [
        'file_write',
        'file_edit',
        'bash_execute',
        'list_directory',
        'exploring the workspace',
        'build the',
        'creating file',
        'section now',
        'template engine',
        'implement',
        'architecture approved',
        'let me pull up the sections',
        'start by exploring',
        'create files',
      ];
      if (codeCtxKw.some((kw) => recentTexts.includes(kw))) mode = 'code';
    }

    // Scroll helper
    let scrollQueued = false;
    function queueScroll() {
      if (!scrollQueued) {
        scrollQueued = true;
        requestAnimationFrame(() => {
          scrollToBottom();
          scrollQueued = false;
        });
      }
    }

    // Unified event handler via ChatStreamEventHandler
    const MAX_STREAMING_BLOCKS = 100; // Prevent DOM bloat during long agentic runs
    const handleEvent = createStreamEventHandler({
      onBlocksUpdate: (blocks) => {
        streamingBlocks =
          blocks.length > MAX_STREAMING_BLOCKS ? blocks.slice(-MAX_STREAMING_BLOCKS) : blocks;
      },
      onStatusUpdate: (status) => {
        streamingStatus = status;
      },
      onThinkingUpdate: (thinking) => {
        streamingThinking = thinking === '' ? '' : (streamingThinking || '') + thinking;
      },
      onToolNamesUpdate: (names) => {
        streamingToolNames = names;
      },
      onError: (error) => {
        streamError = error;
        showToast(error, 'error', 5000);
      },
      isMounted: () => streamMountedRef.current,
      queueScroll,
    });

    const enabledSkillIds = s?.skills?.enabledIds ?? [];

    // Fetch user memories (non-blocking with 2s timeout)
    let memoryContext: string[] = [];
    try {
      const mems = await Promise.race([
        listMemories(undefined, 20),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Memory timeout')), 2000)
        ),
      ]);
      if (mems.length > 0) {
        memoryContext = mems.map((m) => `[${m.type.toUpperCase()}] ${m.content}`);
      }
    } catch {
      /* continue without memory */
    }

    const blocks = await streamChat(apiMessages, {
      mode,
      sessionType: sessionTypeVal,
      workspaceRoot: ws,
      provider,
      modelId: s?.models?.defaultModelId,
      signal,
      onEvent: handleEvent,
      lastUserMessageImage: opts.imageForReq,
      enabledSkillIds,
      memoryContext,
    });

    // Finalize
    const finalContent = flattenMessageContent(blocks);
    const displayContent = finalContent.trim()
      ? finalContent
      : '*(No response received. The model may have timed out or returned an empty response. Try again or switch models.)*';
    messages = [...messages, { role: 'assistant', content: displayContent, timestamp: Date.now() }];
    streamingBlocks = [];
    streamingThinking = '';
    streamingToolNames = [];

    // Save session
    if ($currentSession) {
      sessionsStore.updateSession($currentSession.id, messages);
    } else {
      sessionsStore.createSession(messages);
    }

    // Auto-detect modals (only for normal chat, not code-gen section builds)
    if (opts.detectModals !== false) {
      const hasMermaid = /```mermaid[\s\S]*?```/.test(finalContent);
      if (hasMermaid) {
        const mermaidMatch = finalContent.match(/```mermaid\s*([\s\S]*?)```/);
        if (mermaidMatch && mermaidMatch[1]) {
          lastMermaidCode = mermaidMatch[1].trim();
          setTimeout(() => {
            showApprovalModal = true;
          }, 300);
        }
      }
      if (!hasMermaid) {
        const detected = detectNumberedQuestions(finalContent);
        if (detected) {
          chatQuestionsParsed = detected.questions;
          chatQuestionsIntro = detected.intro;
          chatQuestionsOutro = detected.outro;
          setTimeout(() => {
            showChatQuestionModal = true;
          }, 100);
        }
      }
    }
  }

  /** Convenience: run streaming chat with the display messages (normal chat flow). */
  async function runStreamingChat(signal: AbortSignal) {
    const imageForReq = pendingImages[0] ?? undefined;
    pendingImages = [];
    pendingDocuments = [];
    await runStreamingChatCore(signal, messages, { imageForReq, detectModals: true });
  }

  /** Run streaming chat with custom API messages and optional mode override (e.g. section build). */
  async function runStreamingChatWithMessages(
    signal: AbortSignal,
    apiMessages: Message[],
    modeOverride?: StreamMode
  ) {
    await runStreamingChatCore(signal, apiMessages, { modeOverride, detectModals: false });
  }

  function cancelGeneration() {
    if (activeController) {
      activeController.abort();
      activeController = null;
      activeControllerRef.current = null;
    }
    streaming = false;
    streamError = null;
    streamingBlocks = [];
    streamingThinking = '';
    streamingToolNames = [];
    streamingStatus = 'Thinking...';
  }

  async function handleRetryAfterError() {
    if (!lastUserMessage) return;
    streamError = null;
    inputText = lastUserMessage;
    await tick();
    sendMessage();
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

  // Architecture Approval: user approves the diagram
  function handleArchitectureApproved(e: CustomEvent<{ mermaidCode: string }>) {
    lastMermaidCode = e.detail.mermaidCode;
    showApprovalModal = false;
    // Add AI feedback so user knows work is resuming
    messages = [
      ...messages,
      {
        role: 'assistant',
        content:
          'Architecture approved! Let me pull up the sections so you can pick which one to build first.',
        timestamp: Date.now(),
      },
    ];
    if ($currentSession) {
      sessionsStore.updateSession($currentSession.id, messages);
    }
    // Show the section picker
    setTimeout(() => {
      showSectionPicker = true;
      tick().then(scrollToBottom);
    }, 50);
  }

  // Architecture Approval: user requests changes
  function handleArchitectureChanges(e: CustomEvent<{ mermaidCode: string; feedback: string }>) {
    showApprovalModal = false;
    // Inject the user's feedback as a new message & re-stream
    const feedback = e.detail.feedback;
    inputText = `Please update the architecture diagram based on this feedback: ${feedback}`;
    sendMessage();
  }

  // Section Picker: user selects a section to code
  // CRITICAL: Forces 'code' mode so the AI uses file_write tools to create actual files
  function handleSectionSelected(
    e: CustomEvent<{
      sectionId: string;
      sectionLabel: string;
      mermaidCode: string;
      allSections: Array<{ id: string; label: string }>;
    }>
  ) {
    showSectionPicker = false;
    const { sectionLabel, allSections } = e.detail;
    const sectionList = allSections.map((s) => s.label).join(', ');
    let ws: { root: string | null } = { root: null };
    const unsub = workspaceStore.subscribe((v) => (ws = v));
    unsub();
    const wsRoot = ws.root || '';

    // Build a directive system prompt that forces tool usage
    const systemPrompt = [
      `Build the "${sectionLabel}" section now.`,
      `Architecture sections: ${sectionList}.`,
      '',
      'RULES:',
      `1. Use file_write to create EVERY file under: ${wsRoot || '/workspace'}`,
      '2. Create complete, production-ready code with proper imports/exports.',
      '3. Include types, error handling, and structure.',
      '4. After creating files, verify with list_directory.',
      '5. Prefer file_write for every file. If file_write fails or is unavailable, output the code in markdown code blocks.',
      '6. Use bash_execute to install dependencies if needed.',
      '',
      'Start by listing the current workspace structure, then create files.',
    ].join('\n');

    // Short user-visible message
    messages = [
      ...messages,
      { role: 'user', content: `Build the "${sectionLabel}" section`, timestamp: Date.now() },
    ];
    inputText = '';
    lastUserMessage = systemPrompt;

    const controller = new AbortController();
    streamError = null;
    activeController = controller;
    activeControllerRef.current = controller;
    streamMountedRef.current = true;
    streaming = true;
    chatStreaming.set(true);
    streamingStatus = 'Generating Code';
    streamingBlocks = [];
    streamingThinking = '';
    streamingToolNames = [];

    tick().then(scrollToBottom);

    // Build API messages with the detailed system prompt
    const apiMessages = [...messages];
    apiMessages[apiMessages.length - 1] = {
      ...apiMessages[apiMessages.length - 1],
      content: systemPrompt,
    };

    // FORCE 'code' mode so the backend uses the code prompt with tool support
    runStreamingChatWithMessages(controller.signal, apiMessages, 'code')
      .then(() => {
        // Display messages stored with short label by runStreamingChatWithMessages
      })
      .catch((err: unknown) => {
        const errorContext = processError(err as Error, async () => {});
        logError(errorContext, { mode: get(chatModeStore) });
        trackError('api_error', errorContext.message);
        showToast(errorContext.userMessage?.trim() || 'Something went wrong.', 'error', 5000);
      })
      .finally(() => {
        streaming = false;
        chatStreaming.set(false);
        activeController = null;
        activeControllerRef.current = null;
      });
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
          modelName={modelDisplayName()}
          modelPickerOpen={showModelPicker}
          onModelClick={() => (showModelPicker = !showModelPicker)}
        />
        {#if showModelPicker}
          <div class="model-picker-dropdown">
            <ModelPicker
              value={currentModelKey}
              compact={false}
              showAuto={true}
              embedded={true}
              onSelect={handleModelSelect}
            />
          </div>
        {/if}
      </div>

      <div class="chat-main">
        <div class="chat-main-center">
          <div class="chat-content">
            <!-- Design Workflow Progress Bar -->
            {#if $chatPhaseStore.isActive}
              <PhaseProgressBar />
            {/if}
            <ScrollNavigation scrollContainer={messagesRef} />
          </div>
          <!-- Messages: sibling of chat-content so gradient/messages extend to edge -->
          <div class="messages-container" bind:this={messagesRef}>
            <div class="messages-inner" class:is-empty={messages.length <= 1 && !streaming}>
              {#if messages.length <= 1 && !streaming}
                <div class="empty-state">
                  <FrownyFace size="lg" state="idle" animated={false} />
                  <h1 class="empty-title">What are we building?</h1>
                  <p class="empty-subtitle">
                    Describe your project and I'll help design the architecture
                  </p>
                </div>
              {:else}
                {#if hiddenMessageCount > 0}
                  <button class="load-more-btn" onclick={() => (showAllMessages = true)}>
                    Show {hiddenMessageCount} earlier messages
                  </button>
                {/if}
                {#each visibleMessages as msg, vIdx}
                  {@const index = hiddenMessageCount + vIdx}
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

                {#if !streaming && streamError && lastUserMessage}
                  <div class="stream-error-bar">
                    <span class="stream-error-status">Error</span>
                    <span class="stream-error-message" title={streamError}
                      >{streamError.length > 80
                        ? streamError.slice(0, 77) + '…'
                        : streamError}</span
                    >
                    <button type="button" class="stream-retry-btn" onclick={handleRetryAfterError}
                      >Try again</button
                    >
                  </div>
                {/if}
                <ChatStreamingStatus
                  {streaming}
                  status={streamingStatus}
                  toolNames={streamingToolNames}
                  activeFiles={streamingActiveFiles}
                />

                <!-- Inline architecture approval (inside chat flow) -->
                {#if showApprovalModal}
                  <div class="inline-card-wrapper">
                    <ArchitectureApprovalModal
                      bind:open={showApprovalModal}
                      mermaidCode={lastMermaidCode}
                      on:approve={handleArchitectureApproved}
                      on:request-changes={handleArchitectureChanges}
                    />
                  </div>
                {/if}

                <!-- Inline section picker (inside chat flow) -->
                {#if showSectionPicker}
                  <div class="inline-card-wrapper">
                    <SectionPickerModal
                      bind:open={showSectionPicker}
                      mermaidCode={lastMermaidCode}
                      on:select-section={handleSectionSelected}
                    />
                  </div>
                {/if}
                {#if !streaming && messages.length >= 2 && messages[messages.length - 1]?.role === 'assistant'}
                  <!-- Mode suggestions removed -->
                {/if}
              {/if}
            </div>
          </div>
        </div>
      </div>

      <!-- Input area -->
      <div class="input-area">
        {#if chatMode !== 'ship'}
          <div class="input-row">
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
      </div>
    </div>
  {/if}

  <!-- Modals -->
  <ConfirmModal
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

  <!-- Chat Question Modal: appears when AI asks numbered questions -->
  <ChatQuestionModal
    bind:open={showChatQuestionModal}
    questions={chatQuestionsParsed}
    contextIntro={chatQuestionsIntro}
    contextOutro={chatQuestionsOutro}
    onSubmit={(composedAnswer) => {
      showChatQuestionModal = false;
      inputText = composedAnswer;
      tick().then(() => sendMessage());
    }}
    onClose={() => (showChatQuestionModal = false)}
  />

  <!-- Architecture & Section modals are now inline in the chat flow above -->
</div>

<style>
  .chat-interface {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    background: var(--color-bg-app);
    color: var(--color-text);
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
    background: var(--color-bg-subtle);
  }

  /* Main area */
  .chat-main {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .chat-main-center {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
  }

  .chat-content {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
  }

  /* Messages */
  .messages-container {
    flex: 1;
    overflow-y: auto;
    padding: 2rem 1rem;
    scrollbar-gutter: stable;
    /* Removed scroll-behavior: smooth — causes jank on rapid updates */
    display: flex;
    flex-direction: column;
    contain: layout style;
  }

  .load-more-btn {
    align-self: center;
    padding: 0.375rem 1rem;
    margin-bottom: 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--color-primary, #7c3aed);
    background: rgba(124, 58, 237, 0.08);
    border: 1px solid rgba(124, 58, 237, 0.15);
    border-radius: 1rem;
    cursor: pointer;
  }
  .load-more-btn:hover {
    background: rgba(124, 58, 237, 0.14);
  }

  .messages-inner {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
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
    background: var(--color-bg-subtle);
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 0.25rem;
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

  .stream-error-bar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    margin: 0.5rem 1rem;
    background: var(--color-error-subtle, rgba(239, 68, 68, 0.08));
    border: 1px solid var(--color-error-border, rgba(239, 68, 68, 0.2));
    border-radius: 8px;
    font-size: 0.85rem;
  }

  .stream-error-status {
    font-weight: 600;
    color: var(--color-error, #ef4444);
    flex-shrink: 0;
  }

  .stream-error-message {
    flex: 1;
    min-width: 0;
    color: var(--color-text-secondary, #64748b);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .stream-retry-btn {
    flex-shrink: 0;
    padding: 0.35rem 0.75rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-primary, #7c3aed);
    background: transparent;
    border: 1px solid var(--color-primary, #7c3aed);
    border-radius: 6px;
    cursor: pointer;
  }

  .stream-retry-btn:hover {
    background: var(--color-primary-subtle, rgba(124, 58, 237, 0.1));
  }

  /* Input area - compact height, pulled down from bottom edge */
  .input-area {
    padding: 0.3rem 1rem 0.75rem 1rem;
    margin-bottom: 0.5rem;
    background: var(--color-bg-app);
    position: relative;
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

  .model-picker-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 0.25rem;
    min-width: 360px;
    max-width: 420px;
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
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

  /* Inline card wrappers for architecture approval / section picker */
  .inline-card-wrapper {
    padding: 0.375rem 0;
    width: 100%;
    animation: card-in 0.2s ease-out;
  }

  @media (max-width: 920px) {
    .inline-card-wrapper {
      padding: 0.25rem 0;
    }
  }

  @keyframes card-in {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .messages-container {
      scroll-behavior: auto;
    }

    .inline-card-wrapper {
      animation: none;
    }
  }
</style>
