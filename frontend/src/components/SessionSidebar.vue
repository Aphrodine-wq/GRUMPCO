<template>
  <div :class="['session-sidebar', { collapsed: isCollapsed }]">
    <!-- Toggle button -->
    <button @click="toggleSidebar" class="toggle-btn" :title="isCollapsed ? 'Show history' : 'Hide history'">
      <svg v-if="isCollapsed" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 3h18v18H3zM9 3v18M15 9l-3 3 3 3"/>
      </svg>
      <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 3h18v18H3zM9 3v18M9 9l3 3-3 3"/>
      </svg>
    </button>

    <!-- Sidebar content -->
    <div v-if="!isCollapsed" class="sidebar-content">
      <div class="sidebar-header">
        <h3 class="sidebar-title">History</h3>
        <button @click="$emit('new-session')" class="new-btn" title="New session">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      </div>

      <div class="sessions-list">
        <div v-if="sortedSessions.length === 0" class="empty-sessions">
          <p>No sessions yet</p>
          <p class="empty-hint">Your diagram history will appear here</p>
        </div>

        <div
          v-for="session in sortedSessions"
          :key="session.id"
          :class="['session-item', { active: session.id === currentSessionId }]"
          @click="handleSessionClick(session.id)"
        >
          <div class="session-info">
            <div class="session-name-row">
              <input
                v-if="editingId === session.id"
                v-model="editingName"
                @blur="saveRename"
                @keyup.enter="saveRename"
                @keyup.escape="cancelRename"
                class="rename-input"
                ref="renameInputRef"
              />
              <span v-else class="session-name">{{ session.name }}</span>
              <span v-if="sessionHasDiagram(session)" class="has-diagram" title="Has diagram">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="3" y1="9" x2="21" y2="9"></line>
                  <line x1="9" y1="21" x2="9" y2="9"></line>
                </svg>
              </span>
            </div>
            <span class="session-time">{{ formatTime(session.updatedAt) }}</span>
          </div>

          <div class="session-actions" @click.stop>
            <button @click="startRename(session)" class="action-btn" title="Rename">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button @click="handleExport(session.id)" class="action-btn" title="Export">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </button>
            <button @click="confirmDelete(session)" class="action-btn delete" title="Delete">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue';
import { useSessions } from '../composables/useSessions';
import { useToast } from '../composables/useToast';
import type { Session } from '../types';

const emit = defineEmits<{
  (e: 'session-selected', id: string): void;
  (e: 'new-session'): void;
}>();

const {
  sortedSessions,
  currentSessionId,
  switchSession,
  deleteSession,
  renameSession,
  exportSession,
  sessionHasDiagram
} = useSessions();

const { showToast } = useToast();

const isCollapsed = ref(false);
const editingId = ref<string | null>(null);
const editingName = ref('');
const renameInputRef = ref<HTMLInputElement[] | null>(null);

function toggleSidebar(): void {
  isCollapsed.value = !isCollapsed.value;
}

function handleSessionClick(id: string): void {
  if (editingId.value) return;
  switchSession(id);
  emit('session-selected', id);
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  // Less than 1 minute
  if (diff < 60000) return 'Just now';
  
  // Less than 1 hour
  if (diff < 3600000) {
    const mins = Math.floor(diff / 60000);
    return `${mins}m ago`;
  }
  
  // Less than 24 hours
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  }
  
  // Less than 7 days
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days}d ago`;
  }
  
  // Otherwise show date
  return date.toLocaleDateString();
}

async function startRename(session: Session): Promise<void> {
  editingId.value = session.id;
  editingName.value = session.name;
  await nextTick();
  if (renameInputRef.value && renameInputRef.value[0]) {
    renameInputRef.value[0].focus();
    renameInputRef.value[0].select();
  }
}

function saveRename(): void {
  if (editingId.value && editingName.value.trim()) {
    renameSession(editingId.value, editingName.value.trim());
    showToast('Session renamed', 'success');
  }
  editingId.value = null;
  editingName.value = '';
}

function cancelRename(): void {
  editingId.value = null;
  editingName.value = '';
}

function handleExport(sessionId: string): void {
  exportSession(sessionId);
  showToast('Session exported', 'success');
}

function confirmDelete(session: Session): void {
  if (confirm(`Delete "${session.name}"? This cannot be undone.`)) {
    deleteSession(session.id);
    showToast('Session deleted', 'info');
  }
}
</script>

<style scoped>
.session-sidebar {
  position: relative;
  width: 280px;
  background: #FFFFFF;
  border-right: 1px solid #E5E5E5;
  display: flex;
  flex-direction: column;
  transition: width 200ms ease-in-out;
}

.session-sidebar.collapsed {
  width: 48px;
}

.toggle-btn {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  background: transparent;
  border: 1px solid transparent;
  color: #6B7280;
  padding: 0.35rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 150ms ease;
  z-index: 10;
}

.collapsed .toggle-btn {
  position: static;
  margin: 0.75rem auto;
}

.toggle-btn:hover {
  color: #000000;
  border-color: #E5E5E5;
  transform: translateY(-1px);
}

.toggle-btn:active {
  transform: translateY(0);
}

.sidebar-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  animation: sidebar-fade-in 200ms ease-out;
}

@keyframes sidebar-fade-in {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border-bottom: 1px solid #E5E5E5;
}

.sidebar-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #000000;
  margin: 0;
}

.new-btn {
  background: #0066FF;
  border: 1px solid #0066FF;
  color: #FFFFFF;
  padding: 0.35rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 150ms ease;
}

.new-btn:hover {
  background: #0052CC;
  border-color: #0052CC;
  transform: translateY(-1px);
}

.new-btn:active {
  transform: translateY(0);
}

.sessions-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}

.empty-sessions {
  padding: 2rem 1rem;
  text-align: center;
}

.empty-sessions p {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
  color: #6B7280;
  margin: 0;
}

.empty-hint {
  font-size: 0.75rem !important;
  color: #9CA3AF !important;
  margin-top: 0.5rem !important;
}

.session-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem;
  margin-bottom: 0.25rem;
  border: 1px solid transparent;
  border-left: 2px solid transparent;
  cursor: pointer;
  transition: all 150ms ease;
}

.session-item:hover {
  background: #F5F5F5;
  border-color: #E5E5E5;
  border-left-color: #0066FF;
  transform: translateX(2px);
}

.session-item.active {
  background: #0066FF;
  color: #FFFFFF;
  border-color: #0066FF;
  border-left-color: #0066FF;
}

.session-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.session-name-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.session-name {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8125rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rename-input {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8125rem;
  padding: 0.25rem;
  border: 1px solid #000000;
  outline: none;
  width: 100%;
  box-sizing: border-box;
  transition: box-shadow 150ms ease;
}

.rename-input:focus {
  box-shadow: 0 0 0 2px rgba(0, 102, 255, 0.3);
}

.has-diagram {
  flex-shrink: 0;
  color: #6B7280;
  transition: all 150ms ease;
}

.session-item:hover .has-diagram {
  color: #0066FF;
  animation: icon-pulse 2s ease-in-out infinite;
}

@keyframes icon-pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

.session-item.active .has-diagram {
  color: #FFFFFF;
  animation: none;
}

.session-time {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6875rem;
  color: #9CA3AF;
}

.session-item.active .session-time {
  color: #9CA3AF;
}

.session-actions {
  display: flex;
  gap: 0.25rem;
  opacity: 0;
  transform: translateX(8px);
  transition: all 150ms ease;
}

.session-item:hover .session-actions {
  opacity: 1;
  transform: translateX(0);
}

.session-item.active .session-actions {
  opacity: 1;
  transform: translateX(0);
}

.action-btn {
  background: transparent;
  border: 1px solid transparent;
  color: #6B7280;
  padding: 0.25rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 150ms ease;
}

.session-item.active .action-btn {
  color: #9CA3AF;
}

.action-btn:hover {
  color: #000000;
  border-color: #E5E5E5;
  background: #FFFFFF;
  transform: translateY(-1px);
}

.action-btn:active {
  transform: translateY(0);
}

.session-item.active .action-btn:hover {
  color: #000000;
}

.action-btn.delete:hover {
  color: #DC2626;
  border-color: #DC2626;
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .session-sidebar,
  .sidebar-content,
  .session-item,
  .session-actions,
  .toggle-btn,
  .new-btn,
  .action-btn {
    transition: none;
    animation: none;
  }
  
  .session-item:hover .has-diagram {
    animation: none;
  }
}
</style>
