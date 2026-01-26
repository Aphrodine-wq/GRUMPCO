<template>
  <header class="minimal-header">
    <div class="header-left">
      <GRumpBlob size="sm" state="idle" :animated="true" />
      <span class="title">Mermaid</span>
    </div>
    <div class="header-center">
      <button 
        :class="['status-badge', `status-badge--${connectionStatus}`]"
        @click="handleStatusClick"
        :title="statusTooltip"
        :disabled="connectionStatus === 'checking'"
      >
        <span class="status-dot"></span>
        <span class="status-label">{{ statusLabel }}</span>
      </button>
    </div>
    <div class="header-right">
      <button @click="$emit('new-chat')" class="header-btn" title="New Chat">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        <span class="btn-label">New</span>
      </button>
    </div>
    <div class="header-accent"></div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import GRumpBlob from './GRumpBlob.vue';
import { useConnectionStatus } from '../composables/useConnectionStatus';

defineEmits(['new-chat']);

const { connectionStatus, checkConnection } = useConnectionStatus();

const statusLabel = computed(() => {
  switch (connectionStatus.value) {
    case 'connected': return 'Online';
    case 'disconnected': return 'Offline';
    case 'checking': return 'Checking';
  }
});

const statusTooltip = computed(() => {
  switch (connectionStatus.value) {
    case 'connected': return 'Connected to server';
    case 'disconnected': return 'Cannot reach server. Click to retry.';
    case 'checking': return 'Checking connection...';
  }
});

function handleStatusClick() {
  if (connectionStatus.value === 'disconnected') {
    checkConnection();
  }
}
</script>

<style scoped>
.minimal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: #FFFFFF;
  border-bottom: 1px solid #000000;
  position: relative;
}

.header-accent {
  position: absolute;
  bottom: -2px;
  left: 0;
  right: 0;
  height: 2px;
  background: #0066FF;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
  font-weight: 600;
  color: #000000;
}

.header-center {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Status Badge */
.status-badge {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.625rem;
  background: #F5F5F5;
  border: 1px solid #E5E5E5;
  border-radius: 9999px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.625rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: default;
  transition: all 150ms ease;
}

.status-badge:not(:disabled):hover {
  border-color: #000000;
}

.status-badge--disconnected {
  cursor: pointer;
}

.status-badge--disconnected:hover {
  background: #FEF2F2;
  border-color: #DC2626;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-badge--connected .status-dot {
  background: #10B981;
}

.status-badge--disconnected .status-dot {
  background: #DC2626;
}

.status-badge--checking .status-dot {
  background: #F59E0B;
  animation: status-pulse 1.5s ease-in-out infinite;
}

.status-label {
  color: #6B7280;
}

.status-badge--connected .status-label {
  color: #10B981;
}

.status-badge--disconnected .status-label {
  color: #DC2626;
}

.status-badge--checking .status-label {
  color: #F59E0B;
}

@keyframes status-pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

.header-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background: transparent;
  border: 1px solid #000000;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  color: #000000;
  cursor: pointer;
  transition: all 0.15s;
}

.header-btn:hover {
  background: #0066FF;
  border-color: #0066FF;
  color: #FFFFFF;
}

.header-btn svg {
  width: 14px;
  height: 14px;
}

.btn-label {
  display: none;
}

/* Mobile - show only dot */
@media (max-width: 480px) {
  .status-label {
    display: none;
  }
  
  .status-badge {
    padding: 0.375rem;
  }
  
  .status-dot {
    width: 8px;
    height: 8px;
  }
}

@media (min-width: 640px) {
  .btn-label {
    display: inline;
  }
}
</style>
