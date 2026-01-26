<template>
  <div class="chat-interface">
    <div class="messages-container" ref="messagesRef">
      <!-- Empty state with suggestions -->
      <Transition name="scale-fade">
        <div v-if="messages.length <= 1 && !streaming" class="empty-state">
          <GRumpBlob size="lg" state="idle" :animated="true" />
          <h2 class="empty-title">Create a diagram</h2>
          <p class="empty-subtitle">Describe what you want to visualize</p>
          <SuggestionChips @select="handleTemplateSelect" />
        </div>
      </Transition>
      
      <TransitionGroup name="message-list" tag="div" class="messages-list">
        <div 
          v-for="(msg, index) in messages" 
          :key="`msg-${index}`" 
          :class="['message', msg.role, { 'message-enter': true }]"
        >
          <div class="message-header" v-if="msg.role === 'user'">
            <span class="prompt-symbol">&gt;</span>
          </div>
          <div class="message-body">
            <template v-if="msg.role === 'assistant'">
              <div v-for="(block, blockIdx) in parseMessageContent(msg.content)" :key="blockIdx">
                <div v-if="block.type === 'text'" class="text-block">{{ block.content }}</div>
                <div v-else-if="block.type === 'mermaid'" class="diagram-block">
                  <div class="diagram-header">
                    <span class="diagram-label">mermaid</span>
                    <div class="diagram-actions">
                      <button @click="copyCode(block.content)" class="action-btn" title="Copy code">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                      </button>
                      <button @click="exportSvg(index, blockIdx)" class="action-btn" title="Export SVG">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                          <polyline points="7 10 12 15 17 10"></polyline>
                          <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                      </button>
                    </div>
                  </div>
                  <DiagramRenderer 
                    :ref="el => setDiagramRef(el, index, blockIdx)"
                    :code="block.content"
                  />
                  <FeedbackWidget :diagramId="`${index}-${blockIdx}`" />
                  <RefinementActions 
                    v-if="isLastAssistantMessage(index) && !streaming"
                    @refine="handleRefinement"
                  />
                  <CodeGenPanel 
                    v-if="isLastAssistantMessage(index) && !streaming"
                    :mermaidCode="block.content"
                  />
                </div>
              </div>
            </template>
            <template v-else>
              <span class="user-text">{{ msg.content }}</span>
            </template>
          </div>
        </div>
      </TransitionGroup>
      
      <Transition name="slide-up">
        <div v-if="streaming" class="message assistant streaming-message" key="streaming">
          <div class="streaming-progress"></div>
          <div class="streaming-header">
            <GRumpBlob size="sm" state="thinking" :animated="true" />
            <span class="streaming-label">Generating...</span>
          </div>
          <div class="message-body">
            <template v-if="!streamingContent">
              <span class="thinking-dots"><span>.</span><span>.</span><span>.</span></span>
            </template>
            <template v-else v-for="(block, blockIdx) in parseMessageContent(streamingContent)" :key="blockIdx">
              <div v-if="block.type === 'text'" class="text-block">{{ block.content }}</div>
              <div v-else-if="block.type === 'mermaid'" class="diagram-block streaming">
                <div class="diagram-header">
                  <span class="diagram-label">mermaid</span>
                </div>
                <pre class="code-preview">{{ block.content }}</pre>
              </div>
            </template>
            <span class="cursor" v-if="streaming && streamingContent">|</span>
          </div>
        </div>
      </Transition>
    </div>
    
    <form @submit.prevent="sendMessage" class="input-container">
      <span class="input-prompt">&gt;</span>
      <input 
        v-model="inputText"
        type="text"
        placeholder="Describe your system diagram..."
        :disabled="streaming"
        class="message-input"
        ref="inputRef"
      />
      <button v-if="streaming" type="button" @click="cancelGeneration" class="cancel-button">
        Stop
      </button>
      <button v-else type="submit" :disabled="!inputText.trim()" class="send-button">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
      </button>
      <button v-if="lastError && !streaming" type="button" @click="retryLastMessage" class="retry-button">
        Retry
      </button>
    </form>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, watch } from 'vue';
import DiagramRenderer from './DiagramRenderer.vue';
import SuggestionChips from './SuggestionChips.vue';
import FeedbackWidget from './FeedbackWidget.vue';
import RefinementActions from './RefinementActions.vue';
import GRumpBlob from './GRumpBlob.vue';
import CodeGenPanel from './CodeGenPanel.vue';
import { useMermaid } from '../composables/useMermaid';
import { useAnalytics } from '../composables/useAnalytics';
import { useToast } from '../composables/useToast';
import { useSessions } from '../composables/useSessions';

const props = defineProps({
  initialMessages: {
    type: Array,
    default: null
  },
  preferences: {
    type: Object,
    default: null
  },
  initialPrompt: {
    type: String,
    default: null
  },
  sessionId: {
    type: String,
    default: null
  }
});

const emit = defineEmits(['messages-updated']);

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const defaultMessage = { role: 'assistant', content: 'Describe the system or process you want to visualize. I\'ll generate a Mermaid diagram for you.' };

const messages = ref(
  props.initialMessages ? [...props.initialMessages] : [defaultMessage]
);
const inputText = ref('');
const messagesRef = ref(null);
const inputRef = ref(null);
const streaming = ref(false);
const streamingContent = ref('');
const diagramRefs = ref({});
const lastError = ref(false);
const lastUserMessage = ref('');
const activeController = ref(null);
const currentRefinementContext = ref(null);

const { copyToClipboard, exportAsSvg } = useMermaid();
const { trackMessageSent, trackDiagramGenerated, trackError, trackTemplateUsed, trackAction } = useAnalytics();
const { showToast } = useToast();
const { addDiagramVersion, getRecentMessages, getCurrentDiagram } = useSessions();

// Watch for message changes and emit
watch(messages, (newMessages) => {
  emit('messages-updated', newMessages);
}, { deep: true });

// Build conversation history for API (last 10 messages)
const buildConversationHistory = () => {
  if (!props.sessionId) return undefined;
  const recent = getRecentMessages(props.sessionId, 10);
  if (recent.length === 0) return undefined;
  return recent.map(m => ({ role: m.role, content: m.content }));
};

const setDiagramRef = (el, msgIndex, blockIndex) => {
  if (el) {
    diagramRefs.value[`${msgIndex}-${blockIndex}`] = el;
  }
};

const handleTemplateSelect = (template) => {
  inputText.value = template.prompt;
  trackTemplateUsed(template.type || 'unknown');
  inputRef.value?.focus();
};

const parseMessageContent = (content) => {
  const blocks = [];
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

  if (blocks.length === 0 && content.trim()) {
    blocks.push({ type: 'text', content: content.trim() });
  }

  return blocks;
};

const getErrorMessage = (error, type, suggestedAction) => {
  // Use suggested action from backend if available
  if (suggestedAction) {
    return { message: error, action: suggestedAction };
  }
  
  switch(type) {
    case 'auth_error': 
      return { 
        message: 'API key invalid.', 
        action: 'Check your key in the backend .env file. See API_SETUP_INSTRUCTIONS.txt for help.' 
      };
    case 'rate_limit': 
      return { 
        message: 'Rate limited.', 
        action: 'Wait a moment and try again.' 
      };
    case 'service_unavailable': 
      return { 
        message: 'Service temporarily unavailable.', 
        action: 'Try again shortly.' 
      };
    case 'network_error':
      return {
        message: 'Cannot connect to server.',
        action: 'Check if the backend is running.'
      };
    case 'extraction_failed': 
      return { 
        message: 'Could not generate diagram.', 
        action: 'Try rephrasing your request.' 
      };
    case 'timeout': 
      return { 
        message: 'Request timed out.', 
        action: 'Try a simpler request or try again.' 
      };
    default: 
      return { 
        message: error || 'Something went wrong.', 
        action: 'Please try again.' 
      };
  }
};

const sendMessage = async () => {
  const text = inputText.value.trim();
  if (!text || streaming.value) return;

  // Store for retry and reset error state
  lastUserMessage.value = text;
  lastError.value = false;
  
  // Track message sent
  trackMessageSent(text.length);

  messages.value.push({ role: 'user', content: text });
  inputText.value = '';
  streaming.value = true;
  streamingContent.value = '';
  
  await nextTick();
  scrollToBottom();

  // Create abort controller with 60 second timeout
  const controller = new AbortController();
  activeController.value = controller;
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    // Build request body with conversation context
    const requestBody = { 
      message: text,
      preferences: props.preferences,
      conversationHistory: buildConversationHistory(),
    };
    
    // Add refinement context if present
    if (currentRefinementContext.value) {
      requestBody.refinementContext = currentRefinementContext.value;
      currentRefinementContext.value = null; // Clear after use
    }

    const response = await fetch(`${API_URL}/generate-diagram-stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    // Check for HTTP errors before streaming
    if (!response.ok) {
      let errorMsg = `Server error (${response.status})`;
      try {
        const errorData = await response.json();
        errorMsg = errorData.error || errorMsg;
      } catch {
        // Use status-based message
      }
      throw new Error(errorMsg);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              streamingContent.value += parsed.text;
              await nextTick();
              scrollToBottom();
            }
            if (parsed.error) {
              const errorType = parsed.type || 'unknown';
              streamingContent.value += `\n\n**Error (${errorType}):** ${parsed.error}`;
            }
          } catch (e) {
            // Only warn on non-empty chunks that aren't the done signal
            if (data.trim() && data !== '[DONE]') {
              console.warn('SSE parse warning:', data.substring(0, 100));
            }
          }
        }
      }
    }

    messages.value.push({ role: 'assistant', content: streamingContent.value });
    
    // Track successful diagram generation and save version
    const hasDiagram = streamingContent.value.includes('```mermaid');
    if (hasDiagram) {
      trackDiagramGenerated(props.preferences?.diagramType, true);
      
      // Extract and save diagram version
      if (props.sessionId) {
        const mermaidMatch = streamingContent.value.match(/```mermaid\s*([\s\S]*?)```/);
        if (mermaidMatch) {
          const currentDiagram = getCurrentDiagram(props.sessionId);
          addDiagramVersion(
            props.sessionId, 
            mermaidMatch[1].trim(), 
            lastUserMessage.value,
            currentDiagram?.id
          );
        }
      }
    }
  } catch (error) {
    console.error('Stream error:', error);
    lastError.value = true;
    
    let errorMessage = error.message;
    let errorType = 'unknown';
    let suggestedAction = null;
    
    // Handle abort/timeout specifically
    if (error.name === 'AbortError') {
      errorType = 'timeout';
    }
    
    // Try to parse enhanced error info if available
    if (error.errorData) {
      errorType = error.errorData.type || errorType;
      suggestedAction = error.errorData.suggestedAction;
    }
    
    const errorInfo = getErrorMessage(errorMessage, errorType, suggestedAction);
    const displayMessage = `${errorInfo.message}\n\n${errorInfo.action}`;
    
    messages.value.push({ role: 'assistant', content: `Error: ${displayMessage}` });
    showToast(errorInfo.message, 'error');
    
    // Track error
    trackError(errorType, errorMessage);
    trackDiagramGenerated(props.preferences?.diagramType, false);
  } finally {
    clearTimeout(timeoutId);
    streaming.value = false;
    streamingContent.value = '';
    activeController.value = null;
    await nextTick();
    scrollToBottom();
  }
};

const scrollToBottom = () => {
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight;
  }
};

const retryLastMessage = () => {
  if (lastUserMessage.value && !streaming.value) {
    // Remove the last error message
    if (messages.value.length > 0 && messages.value[messages.value.length - 1].role === 'assistant') {
      const lastContent = messages.value[messages.value.length - 1].content;
      if (lastContent.startsWith('Error:')) {
        messages.value.pop();
      }
    }
    // Remove the last user message (will be re-added by sendMessage)
    if (messages.value.length > 0 && messages.value[messages.value.length - 1].role === 'user') {
      messages.value.pop();
    }
    inputText.value = lastUserMessage.value;
    sendMessage();
  }
};

const cancelGeneration = () => {
  if (activeController.value) {
    activeController.value.abort();
  }
};

const copyCode = async (code) => {
  try {
    await copyToClipboard(code);
    trackAction('copy_code');
    showToast('Code copied to clipboard', 'success');
  } catch (err) {
    showToast('Failed to copy code', 'error');
  }
};

const exportSvg = (msgIndex, blockIndex) => {
  const renderer = diagramRefs.value[`${msgIndex}-${blockIndex}`];
  if (renderer) {
    const svg = renderer.getSvgElement();
    if (svg) {
      exportAsSvg(svg, `diagram-${Date.now()}.svg`);
      trackAction('export_svg');
      showToast('Diagram exported as SVG', 'success');
    } else {
      showToast('Could not export diagram', 'error');
    }
  }
};

// Check if this is the last assistant message (for showing refinement actions)
const isLastAssistantMessage = (index) => {
  // Find the last assistant message index
  for (let i = messages.value.length - 1; i >= 0; i--) {
    if (messages.value[i].role === 'assistant') {
      return i === index;
    }
  }
  return false;
};

// Handle refinement actions
const handleRefinement = (type, detail) => {
  trackAction('refinement', type);
  
  // Get the current diagram for refinement context
  let baseDiagram = null;
  if (props.sessionId) {
    const currentDiagram = getCurrentDiagram(props.sessionId);
    baseDiagram = currentDiagram?.code;
  }
  
  // If no tracked diagram, try to find from messages
  if (!baseDiagram) {
    for (let i = messages.value.length - 1; i >= 0; i--) {
      const msg = messages.value[i];
      if (msg.role === 'assistant' && msg.content.includes('```mermaid')) {
        const match = msg.content.match(/```mermaid\s*([\s\S]*?)```/);
        if (match) {
          baseDiagram = match[1].trim();
          break;
        }
      }
    }
  }
  
  let refinementPrompt = '';
  let refinementType = 'modify';
  
  switch (type) {
    case 'simpler':
      refinementPrompt = 'Please make this diagram simpler. Remove less important details and focus only on the core components and relationships.';
      refinementType = 'simplify';
      break;
    case 'detailed':
      refinementPrompt = 'Please make this diagram more detailed. Add more components, labels, and relationships to provide a comprehensive view.';
      refinementType = 'expand';
      break;
    case 'style':
      const styleMap = {
        flowchart: 'flowchart',
        sequence: 'sequence diagram',
        class: 'class diagram',
        er: 'entity-relationship (ER) diagram',
        state: 'state diagram'
      };
      const styleName = styleMap[detail] || detail;
      refinementPrompt = `Please convert this diagram to a ${styleName} format, keeping the same information but changing the visualization style.`;
      refinementType = 'convert';
      break;
    case 'edit':
      refinementPrompt = `Please modify the diagram: ${detail}`;
      refinementType = 'modify';
      break;
    default:
      return;
  }
  
  // Set refinement context for the API call
  if (baseDiagram) {
    currentRefinementContext.value = {
      baseDiagram,
      refinementType,
      instruction: refinementPrompt
    };
  }
  
  inputText.value = refinementPrompt;
  sendMessage();
};

onMounted(() => {
  inputRef.value?.focus();
  
  // If there's an initial prompt from the wizard, populate and auto-send
  if (props.initialPrompt && !props.initialMessages) {
    inputText.value = props.initialPrompt;
    // Auto-send after a brief delay to let the user see the prompt
    setTimeout(() => {
      sendMessage();
    }, 500);
  }
});
</script>

<style scoped>
.chat-interface {
  display: flex;
  flex-direction: column;
  flex: 1;
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
  background: #F5F5F5;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 2rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  text-align: center;
  gap: 1rem;
}

.empty-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 1.25rem;
  font-weight: 600;
  color: #000000;
  margin: 0;
  border-bottom: 2px solid #0066FF;
  padding-bottom: 0.25rem;
}

.empty-subtitle {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
  color: #6B7280;
  margin: 0;
}

.message {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.message.user {
  padding: 0.75rem 0;
}

.message.assistant {
  padding: 0.5rem 0;
}

.message-header {
  display: flex;
  align-items: center;
}

.prompt-symbol {
  color: #000000;
  font-weight: 600;
  margin-right: 0.5rem;
}

.message-body {
  color: #000000;
  line-height: 1.6;
}

.message.user .message-body {
  padding-left: 1.25rem;
}

.user-text {
  color: #000000;
}

.text-block {
  margin-bottom: 0.75rem;
  white-space: pre-wrap;
}

.diagram-block {
  background: #FFFFFF;
  border: 1px solid #000000;
  margin: 1rem 0;
  overflow: hidden;
  transition: box-shadow 0.15s;
}

.diagram-block:hover {
  box-shadow: 4px 4px 0 #000000;
}

.diagram-block.streaming {
  border-width: 2px;
}

.diagram-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.75rem;
  background: #F5F5F5;
  border-bottom: 1px solid #E5E5E5;
}

.diagram-label {
  color: #6B7280;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
}

.diagram-actions {
  display: flex;
  gap: 0.25rem;
}

.action-btn {
  background: transparent;
  border: 1px solid transparent;
  color: #6B7280;
  cursor: pointer;
  padding: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.action-btn:hover {
  color: #000000;
  border-color: #000000;
}

.code-preview {
  padding: 1rem;
  margin: 0;
  font-size: 0.875rem;
  color: #374151;
  overflow-x: auto;
  background: #FFFFFF;
}

.cursor {
  color: #000000;
  animation: blink 1s infinite;
  font-weight: bold;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.input-container {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  border-top: 1px solid #000000;
  background: #FFFFFF;
}

.input-prompt {
  color: #0066FF;
  font-weight: 600;
  font-size: 1.1rem;
}

.message-input {
  flex: 1;
  background: transparent;
  border: none;
  color: #000000;
  font-family: inherit;
  font-size: 1rem;
  outline: none;
}

.message-input::placeholder {
  color: #9CA3AF;
}

.message-input:disabled {
  opacity: 0.5;
}

.send-button {
  background: #0066FF;
  border: 1px solid #0066FF;
  color: #FFFFFF;
  padding: 0.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.send-button:hover:not(:disabled) {
  background: #0052CC;
  border-color: #0052CC;
}

.send-button:disabled {
  background: #E5E5E5;
  border-color: #E5E5E5;
  color: #9CA3AF;
  cursor: not-allowed;
}

.cancel-button {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  background: #FFFFFF;
  border: 1px solid #000000;
  color: #000000;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  transition: all 0.15s;
}

.cancel-button:hover {
  background: #000000;
  color: #FFFFFF;
}

.retry-button {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  background: #000000;
  border: 1px solid #000000;
  color: #FFFFFF;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  transition: all 0.15s;
}

.retry-button:hover {
  background: #FFFFFF;
  color: #000000;
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
  color: #0066FF;
  font-weight: 500;
}

/* Streaming progress bar */
.streaming-message {
  position: relative;
}

.streaming-progress {
  position: absolute;
  top: 0;
  left: 0;
  height: 2px;
  width: 25%;
  background: #0066FF;
  animation: progress-indeterminate 1.5s ease-in-out infinite;
}

@keyframes progress-indeterminate {
  0% {
    left: 0;
    width: 25%;
  }
  50% {
    left: 50%;
    width: 35%;
  }
  100% {
    left: 100%;
    width: 25%;
  }
}

/* Thinking dots animation */
.thinking-dots {
  display: inline-flex;
  gap: 2px;
  color: #6B7280;
  font-size: 1.5rem;
  line-height: 1;
}

.thinking-dots span {
  animation: thinking-dot 1.4s ease-in-out infinite;
}

.thinking-dots span:nth-child(1) {
  animation-delay: 0s;
}

.thinking-dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.thinking-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes thinking-dot {
  0%, 80%, 100% {
    opacity: 0.3;
    transform: translateY(0);
  }
  40% {
    opacity: 1;
    transform: translateY(-4px);
  }
}

/* Message list transitions */
.messages-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.message-list-enter-active {
  transition: all 250ms ease-out;
}

.message-list-leave-active {
  transition: all 150ms ease-in;
}

.message-list-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.message-list-leave-to {
  opacity: 0;
}

.message-list-move {
  transition: transform 250ms ease-out;
}

/* Scale fade transition */
.scale-fade-enter-active,
.scale-fade-leave-active {
  transition: all 250ms ease-out;
}

.scale-fade-enter-from,
.scale-fade-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

/* Slide up transition */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 300ms ease-out;
}

.slide-up-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.slide-up-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* Button hover effects */
.send-button,
.cancel-button,
.retry-button {
  transition: all 150ms ease;
}

.send-button:hover:not(:disabled),
.cancel-button:hover,
.retry-button:hover {
  transform: translateY(-1px);
}

.send-button:active:not(:disabled),
.cancel-button:active,
.retry-button:active {
  transform: translateY(0);
}

/* Input focus enhancement */
.message-input:focus {
  outline: none;
}

.input-container:focus-within {
  box-shadow: 0 0 0 2px rgba(0, 102, 255, 0.2);
}
</style>
