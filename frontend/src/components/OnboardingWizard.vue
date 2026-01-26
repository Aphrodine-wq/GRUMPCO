<template>
  <div class="wizard-screen">
    <div class="wizard-container">
      <!-- Progress indicator -->
      <div class="progress-bar">
        <div 
          v-for="step in 3" 
          :key="step"
          :class="['progress-step', { active: currentStep >= step, current: currentStep === step }]"
        >
          {{ step }}
        </div>
      </div>

      <!-- Step 1: What are you documenting? -->
      <div v-if="currentStep === 1" class="wizard-step">
        <h1 class="step-title">What are you documenting?</h1>
        <p class="step-subtitle">Select the type of diagram you need</p>
        
        <div class="diagram-type-grid">
          <button
            v-for="type in diagramTypes"
            :key="type.id"
            @click="selectDiagramType(type)"
            :class="['type-card', { selected: selectedType?.id === type.id }]"
          >
            <span class="type-icon">{{ type.icon }}</span>
            <span class="type-name">{{ type.label }}</span>
            <span class="type-desc">{{ type.description }}</span>
          </button>
        </div>
      </div>

      <!-- Step 2: Describe it -->
      <div v-else-if="currentStep === 2" class="wizard-step">
        <h1 class="step-title">Describe what you're building</h1>
        <p class="step-subtitle">A brief description helps generate better diagrams</p>
        
        <div class="description-input-wrapper">
          <textarea
            v-model="description"
            class="description-input"
            placeholder="e.g., A user authentication system with login, signup, and password reset flows"
            rows="4"
            maxlength="500"
            ref="descriptionRef"
          ></textarea>
          <span class="char-count">{{ description.length }}/500</span>
        </div>

        <div class="examples">
          <p class="examples-label">Examples:</p>
          <button 
            v-for="example in getExamples()" 
            :key="example"
            @click="description = example"
            class="example-chip"
          >
            {{ example }}
          </button>
        </div>
      </div>

      <!-- Step 3: Review generated prompt -->
      <div v-else-if="currentStep === 3" class="wizard-step">
        <h1 class="step-title">Review your prompt</h1>
        <p class="step-subtitle">Edit if needed, then generate your diagram</p>
        
        <div class="prompt-preview">
          <textarea
            v-model="generatedPrompt"
            class="prompt-input"
            rows="6"
          ></textarea>
        </div>

        <div class="preview-info">
          <div class="preview-item">
            <span class="preview-label">Type:</span>
            <span class="preview-value">{{ selectedType?.label }}</span>
          </div>
          <div class="preview-item">
            <span class="preview-label">Complexity:</span>
            <div class="complexity-selector">
              <button
                v-for="level in complexityLevels"
                :key="level.id"
                @click="selectedComplexity = level.id"
                :class="['complexity-btn', { active: selectedComplexity === level.id }]"
              >
                {{ level.label }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Navigation buttons -->
      <div class="wizard-actions">
        <button 
          v-if="currentStep > 1" 
          @click="prevStep" 
          class="secondary-btn"
        >
          Back
        </button>
        <div class="spacer"></div>
        <button 
          v-if="currentStep < 3" 
          @click="nextStep" 
          :disabled="!canProceed"
          class="primary-btn"
        >
          Continue
        </button>
        <button 
          v-else 
          @click="complete" 
          class="primary-btn generate-btn"
        >
          Generate Diagram
        </button>
      </div>

      <button @click="$emit('skip')" class="skip-link">
        Skip setup and explore
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';

interface DiagramType {
  id: string;
  label: string;
  icon: string;
  description: string;
  mermaidType: 'flowchart' | 'sequence' | 'erd' | 'class';
}

const emit = defineEmits<{
  (e: 'complete', data: { 
    preferences: { diagramType: 'flowchart' | 'sequence' | 'erd' | 'class'; complexity: 'simple' | 'medium' | 'detailed' };
    initialPrompt: string;
  }): void;
  (e: 'skip'): void;
}>();

const currentStep = ref(1);
const selectedType = ref<DiagramType | null>(null);
const description = ref('');
const generatedPrompt = ref('');
const selectedComplexity = ref<'simple' | 'medium' | 'detailed'>('medium');
const descriptionRef = ref<HTMLTextAreaElement | null>(null);

const diagramTypes: DiagramType[] = [
  { 
    id: 'system', 
    label: 'System Architecture', 
    icon: '🏗️',
    description: 'Components, services, and how they connect',
    mermaidType: 'flowchart'
  },
  { 
    id: 'userflow', 
    label: 'User Flow', 
    icon: '👤',
    description: 'User journey through your product',
    mermaidType: 'flowchart'
  },
  { 
    id: 'datamodel', 
    label: 'Data Model', 
    icon: '🗄️',
    description: 'Database tables and relationships',
    mermaidType: 'erd'
  },
  { 
    id: 'api', 
    label: 'API / Sequence', 
    icon: '🔄',
    description: 'Request flows between services',
    mermaidType: 'sequence'
  }
];

const complexityLevels = [
  { id: 'simple' as const, label: 'Simple' },
  { id: 'medium' as const, label: 'Medium' },
  { id: 'detailed' as const, label: 'Detailed' }
];

const canProceed = computed(() => {
  if (currentStep.value === 1) return selectedType.value !== null;
  if (currentStep.value === 2) return description.value.trim().length >= 10;
  return true;
});

function getExamples(): string[] {
  if (!selectedType.value) return [];
  
  const examples: Record<string, string[]> = {
    system: [
      'A microservices e-commerce platform',
      'Real-time chat application with WebSockets',
      'CI/CD pipeline with testing stages'
    ],
    userflow: [
      'User registration and onboarding flow',
      'Checkout process with payment',
      'Password reset workflow'
    ],
    datamodel: [
      'Blog platform with users, posts, and comments',
      'E-commerce with products, orders, and inventory',
      'Social network with profiles and connections'
    ],
    api: [
      'OAuth 2.0 authentication flow',
      'Payment processing with webhook callbacks',
      'File upload with progress tracking'
    ]
  };
  
  return examples[selectedType.value.id] || [];
}

function selectDiagramType(type: DiagramType): void {
  selectedType.value = type;
}

function generatePrompt(): void {
  if (!selectedType.value || !description.value) return;
  
  const typeContext: Record<string, string> = {
    system: 'Create a system architecture diagram showing',
    userflow: 'Create a user flow diagram showing',
    datamodel: 'Create an entity-relationship diagram showing',
    api: 'Create a sequence diagram showing'
  };
  
  const complexityHint: Record<string, string> = {
    simple: 'Keep it minimal with only the essential components.',
    medium: 'Include the main components and their key interactions.',
    detailed: 'Include all components, relationships, and detailed labels.'
  };
  
  const base = typeContext[selectedType.value.id] || 'Create a diagram showing';
  generatedPrompt.value = `${base} ${description.value.trim()}. ${complexityHint[selectedComplexity.value]}`;
}

async function nextStep(): Promise<void> {
  if (!canProceed.value) return;
  
  if (currentStep.value === 2) {
    generatePrompt();
  }
  
  currentStep.value++;
  
  if (currentStep.value === 2) {
    await nextTick();
    descriptionRef.value?.focus();
  }
}

function prevStep(): void {
  if (currentStep.value > 1) {
    currentStep.value--;
  }
}

function complete(): void {
  if (!selectedType.value) return;
  
  emit('complete', {
    preferences: {
      diagramType: selectedType.value.mermaidType,
      complexity: selectedComplexity.value
    },
    initialPrompt: generatedPrompt.value
  });
}
</script>

<style scoped>
.wizard-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #F5F5F5;
  padding: 1rem;
}

.wizard-container {
  width: 100%;
  max-width: 560px;
  background: #FFFFFF;
  border: 1px solid #000000;
  padding: 2rem;
}

.progress-bar {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 2rem;
}

.progress-step {
  width: 32px;
  height: 32px;
  border: 1px solid #E5E5E5;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
  color: #9CA3AF;
  transition: all 0.15s;
}

.progress-step.active {
  border-color: #0066FF;
  color: #0066FF;
}

.progress-step.current {
  background: #0066FF;
  border-color: #0066FF;
  color: #FFFFFF;
}

.wizard-step {
  min-height: 320px;
}

.step-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 1.25rem;
  font-weight: 600;
  color: #000000;
  margin: 0 0 0.5rem 0;
  text-align: center;
}

.step-subtitle {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
  color: #6B7280;
  margin: 0 0 1.5rem 0;
  text-align: center;
}

.diagram-type-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.type-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 1rem;
  background: #FFFFFF;
  border: 1px solid #E5E5E5;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
}

.type-card:hover {
  border-color: #0066FF;
}

.type-card.selected {
  border-color: #0066FF;
  background: #0066FF;
  color: #FFFFFF;
}

.type-icon {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
}

.type-name {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.type-desc {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  color: #6B7280;
}

.type-card.selected .type-desc {
  color: #9CA3AF;
}

.description-input-wrapper {
  position: relative;
  margin-bottom: 1rem;
}

.description-input {
  width: 100%;
  padding: 1rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
  border: 1px solid #000000;
  resize: none;
  outline: none;
  box-sizing: border-box;
}

.description-input:focus {
  border-color: #0066FF;
  box-shadow: 0 0 0 3px rgba(0, 102, 255, 0.2);
}

.char-count {
  position: absolute;
  bottom: 0.5rem;
  right: 0.75rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.625rem;
  color: #9CA3AF;
}

.examples {
  margin-top: 1rem;
}

.examples-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  color: #6B7280;
  margin: 0 0 0.5rem 0;
}

.example-chip {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: #F5F5F5;
  border: 1px solid #E5E5E5;
  margin: 0 0.5rem 0.5rem 0;
  cursor: pointer;
  transition: all 0.15s;
}

.example-chip:hover {
  border-color: #000000;
  background: #FFFFFF;
}

.prompt-preview {
  margin-bottom: 1rem;
}

.prompt-input {
  width: 100%;
  padding: 1rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
  border: 1px solid #000000;
  resize: none;
  outline: none;
  box-sizing: border-box;
}

.prompt-input:focus {
  border-color: #0066FF;
  box-shadow: 0 0 0 3px rgba(0, 102, 255, 0.2);
}

.preview-info {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  background: #F5F5F5;
  border: 1px solid #E5E5E5;
}

.preview-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.preview-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  color: #6B7280;
  min-width: 80px;
}

.preview-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
  font-weight: 600;
  color: #000000;
}

.complexity-selector {
  display: flex;
  gap: 0.5rem;
}

.complexity-btn {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  padding: 0.35rem 0.75rem;
  background: #FFFFFF;
  border: 1px solid #E5E5E5;
  cursor: pointer;
  transition: all 0.15s;
}

.complexity-btn:hover {
  border-color: #0066FF;
  color: #0066FF;
}

.complexity-btn.active {
  background: #0066FF;
  border-color: #0066FF;
  color: #FFFFFF;
}

.wizard-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid #E5E5E5;
}

.spacer {
  flex: 1;
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

.primary-btn:hover:not(:disabled) {
  background: #FFFFFF;
  color: #000000;
}

.primary-btn:disabled {
  background: #E5E5E5;
  border-color: #E5E5E5;
  color: #9CA3AF;
  cursor: not-allowed;
}

.generate-btn {
  background: #0066FF;
  border-color: #0066FF;
}

.generate-btn:hover:not(:disabled) {
  background: #0052CC;
  border-color: #0052CC;
  color: #FFFFFF;
}

.secondary-btn {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
  padding: 0.75rem 1.5rem;
  background: transparent;
  color: #000000;
  border: 1px solid #000000;
  cursor: pointer;
  transition: all 0.15s;
}

.secondary-btn:hover {
  background: #000000;
  color: #FFFFFF;
}

.skip-link {
  display: block;
  width: 100%;
  margin-top: 1rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  color: #6B7280;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: center;
  transition: color 0.15s;
}

.skip-link:hover {
  color: #000000;
}
</style>
