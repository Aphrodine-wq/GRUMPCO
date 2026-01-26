<template>
  <div class="resume-screen">
    <div class="resume-container">
      <div class="resume-header">
        <h1 class="title">Welcome Back</h1>
        <p class="subtitle">You have a previous session</p>
      </div>

      <div class="session-preview" v-if="lastSession">
        <div class="preview-header">
          <span class="preview-label">Last Session</span>
          <span class="preview-time">{{ formatTime(lastSession.timestamp) }}</span>
        </div>
        <div class="preview-content">
          <p class="preview-text">
            {{ getPreviewText() }}
          </p>
        </div>
      </div>

      <div class="resume-actions">
        <button @click="$emit('continue')" class="primary-btn">
          Continue Session
        </button>
        <button @click="$emit('new')" class="secondary-btn">
          Start Fresh
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  lastSession: {
    type: Object,
    default: null
  }
});

defineEmits(['continue', 'new']);

function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString();
}

function getPreviewText() {
  if (!props.lastSession?.messages?.length) {
    return 'No messages in session';
  }
  
  const lastUserMessage = [...props.lastSession.messages]
    .reverse()
    .find(m => m.role === 'user');
  
  if (lastUserMessage) {
    const text = lastUserMessage.content;
    return text.length > 100 ? text.slice(0, 100) + '...' : text;
  }
  
  return `${props.lastSession.messages.length} messages`;
}
</script>

<style scoped>
.resume-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #F5F5F5;
  padding: 1rem;
}

.resume-container {
  width: 100%;
  max-width: 400px;
  background: #FFFFFF;
  border: 1px solid #000000;
  padding: 2rem;
}

.resume-header {
  text-align: center;
  margin-bottom: 1.5rem;
}

.title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 1.25rem;
  font-weight: 600;
  color: #000000;
  margin: 0 0 0.5rem 0;
}

.subtitle {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
  color: #6B7280;
  margin: 0;
}

.session-preview {
  background: #F5F5F5;
  border: 1px solid #E5E5E5;
  margin-bottom: 1.5rem;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  border-bottom: 1px solid #E5E5E5;
}

.preview-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  font-weight: 600;
  color: #000000;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.preview-time {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  color: #6B7280;
}

.preview-content {
  padding: 0.75rem;
}

.preview-text {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
  color: #374151;
  margin: 0;
  line-height: 1.5;
}

.resume-actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.primary-btn {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
  font-weight: 600;
  padding: 0.75rem 1.5rem;
  background: #000000;
  color: #FFFFFF;
  border: 1px solid #000000;
  cursor: pointer;
  transition: all 0.15s;
}

.primary-btn:hover {
  background: #FFFFFF;
  color: #000000;
}

.secondary-btn {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
  padding: 0.75rem 1.5rem;
  background: transparent;
  color: #6B7280;
  border: 1px solid #E5E5E5;
  cursor: pointer;
  transition: all 0.15s;
}

.secondary-btn:hover {
  border-color: #000000;
  color: #000000;
}
</style>
