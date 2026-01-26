<template>
  <div class="refinement-actions">
    <span class="refinement-label">Refine:</span>
    <div class="refinement-buttons">
      <button @click="$emit('refine', 'simpler')" class="refine-btn">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="4 14 10 14 10 20"></polyline>
          <polyline points="20 10 14 10 14 4"></polyline>
          <line x1="14" y1="10" x2="21" y2="3"></line>
          <line x1="3" y1="21" x2="10" y2="14"></line>
        </svg>
        Simpler
      </button>
      <button @click="$emit('refine', 'detailed')" class="refine-btn">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 3 21 3 21 9"></polyline>
          <polyline points="9 21 3 21 3 15"></polyline>
          <line x1="21" y1="3" x2="14" y2="10"></line>
          <line x1="3" y1="21" x2="10" y2="14"></line>
        </svg>
        More detail
      </button>
      <button @click="showStyleMenu = !showStyleMenu" class="refine-btn">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
          <polyline points="2 17 12 22 22 17"></polyline>
          <polyline points="2 12 12 17 22 12"></polyline>
        </svg>
        Style
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
      <button @click="showEditInput = !showEditInput" class="refine-btn edit-btn">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
        Edit
      </button>
    </div>
    
    <!-- Style dropdown -->
    <div v-if="showStyleMenu" class="style-menu">
      <button 
        v-for="style in diagramStyles" 
        :key="style.id"
        @click="selectStyle(style.id)"
        class="style-option"
      >
        {{ style.label }}
      </button>
    </div>
    
    <!-- Edit input -->
    <div v-if="showEditInput" class="edit-input-wrapper">
      <input
        v-model="editInstruction"
        @keyup.enter="submitEdit"
        type="text"
        placeholder="Describe what to change..."
        class="edit-input"
        ref="editInputRef"
      />
      <button @click="submitEdit" :disabled="!editInstruction.trim()" class="submit-edit-btn">
        Apply
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue';

const emit = defineEmits<{
  (e: 'refine', type: 'simpler' | 'detailed' | 'style' | 'edit', detail?: string): void;
}>();

const showStyleMenu = ref(false);
const showEditInput = ref(false);
const editInstruction = ref('');
const editInputRef = ref<HTMLInputElement | null>(null);

const diagramStyles = [
  { id: 'flowchart', label: 'Flowchart' },
  { id: 'sequence', label: 'Sequence Diagram' },
  { id: 'class', label: 'Class Diagram' },
  { id: 'er', label: 'ER Diagram' },
  { id: 'state', label: 'State Diagram' }
];

watch(showEditInput, async (show) => {
  if (show) {
    await nextTick();
    editInputRef.value?.focus();
  }
});

function selectStyle(styleId: string): void {
  showStyleMenu.value = false;
  emit('refine', 'style', styleId);
}

function submitEdit(): void {
  if (editInstruction.value.trim()) {
    emit('refine', 'edit', editInstruction.value.trim());
    editInstruction.value = '';
    showEditInput.value = false;
  }
}
</script>

<style scoped>
.refinement-actions {
  padding: 0.75rem;
  border-top: 1px solid #E5E5E5;
  background: #F9F9F9;
  position: relative;
}

.refinement-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6875rem;
  color: #6B7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: block;
  margin-bottom: 0.5rem;
}

.refinement-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.refine-btn {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.65rem;
  background: #FFFFFF;
  border: 1px solid #E5E5E5;
  color: #374151;
  cursor: pointer;
  transition: all 0.15s;
}

.refine-btn:hover {
  border-color: #000000;
  color: #000000;
}

.refine-btn.edit-btn {
  background: #000000;
  border-color: #000000;
  color: #FFFFFF;
}

.refine-btn.edit-btn:hover {
  background: #FFFFFF;
  color: #000000;
}

.style-menu {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #FFFFFF;
  border: 1px solid #000000;
  box-shadow: 4px 4px 0 rgba(0,0,0,0.1);
  z-index: 10;
  margin-top: 0.25rem;
}

.style-option {
  display: block;
  width: 100%;
  padding: 0.6rem 0.75rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  background: transparent;
  border: none;
  border-bottom: 1px solid #E5E5E5;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;
}

.style-option:last-child {
  border-bottom: none;
}

.style-option:hover {
  background: #F5F5F5;
}

.edit-input-wrapper {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.edit-input {
  flex: 1;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8125rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid #000000;
  outline: none;
}

.edit-input:focus {
  box-shadow: 2px 2px 0 #000000;
}

.submit-edit-btn {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  padding: 0.5rem 1rem;
  background: #000000;
  border: 1px solid #000000;
  color: #FFFFFF;
  cursor: pointer;
  transition: all 0.15s;
}

.submit-edit-btn:hover:not(:disabled) {
  background: #FFFFFF;
  color: #000000;
}

.submit-edit-btn:disabled {
  background: #E5E5E5;
  border-color: #E5E5E5;
  color: #9CA3AF;
  cursor: not-allowed;
}
</style>
