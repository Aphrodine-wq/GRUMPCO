<template>
  <div class="setup-screen">
    <div class="setup-container">
      <div class="setup-header">
        <h1 class="title">Quick Setup</h1>
        <p class="subtitle">Configure your preferences (optional)</p>
      </div>

      <div class="setup-options">
        <div class="option-group">
          <label class="option-label">Default Diagram Type</label>
          <div class="option-buttons">
            <button
              v-for="type in diagramTypes"
              :key="type.id"
              @click="selectedType = type.id"
              :class="['option-btn', { active: selectedType === type.id }]"
            >
              {{ type.label }}
            </button>
          </div>
        </div>

        <div class="option-group">
          <label class="option-label">Diagram Complexity</label>
          <div class="option-buttons">
            <button
              v-for="level in complexityLevels"
              :key="level.id"
              @click="selectedComplexity = level.id"
              :class="['option-btn', { active: selectedComplexity === level.id }]"
            >
              {{ level.label }}
            </button>
          </div>
        </div>
      </div>

      <div class="setup-actions">
        <button @click="handleComplete" class="primary-btn">
          Continue
        </button>
        <button @click="$emit('skip')" class="secondary-btn">
          Skip Setup
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const emit = defineEmits(['complete', 'skip']);

const selectedType = ref('flowchart');
const selectedComplexity = ref('medium');

const diagramTypes = [
  { id: 'flowchart', label: 'Flowchart' },
  { id: 'sequence', label: 'Sequence' },
  { id: 'erd', label: 'ERD' },
  { id: 'class', label: 'Class' }
];

const complexityLevels = [
  { id: 'simple', label: 'Simple' },
  { id: 'medium', label: 'Medium' },
  { id: 'detailed', label: 'Detailed' }
];

function handleComplete() {
  emit('complete', {
    diagramType: selectedType.value,
    complexity: selectedComplexity.value
  });
}
</script>

<style scoped>
.setup-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #F5F5F5;
  padding: 1rem;
}

.setup-container {
  width: 100%;
  max-width: 480px;
  background: #FFFFFF;
  border: 1px solid #000000;
  padding: 2rem;
}

.setup-header {
  text-align: center;
  margin-bottom: 2rem;
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

.setup-options {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.option-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.option-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  font-weight: 600;
  color: #000000;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.option-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.option-btn {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  padding: 0.5rem 1rem;
  background: #FFFFFF;
  color: #000000;
  border: 1px solid #000000;
  cursor: pointer;
  transition: all 0.15s;
}

.option-btn:hover {
  background: #F5F5F5;
}

.option-btn.active {
  background: #000000;
  color: #FFFFFF;
}

.setup-actions {
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
