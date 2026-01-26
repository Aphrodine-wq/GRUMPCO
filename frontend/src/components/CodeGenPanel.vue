<template>
  <div class="codegen-panel">
    <div class="panel-header">
      <span class="panel-title">Generate Code</span>
    </div>
    
    <div class="panel-body">
      <div class="form-row">
        <label class="form-label">Tech Stack</label>
        <div class="stack-options">
          <button 
            v-for="stack in stacks" 
            :key="stack.value"
            :class="['stack-btn', { active: selectedStack === stack.value }]"
            @click="selectedStack = stack.value"
          >
            <span class="stack-icon">{{ stack.icon }}</span>
            <span class="stack-name">{{ stack.label }}</span>
          </button>
        </div>
      </div>

      <div class="form-row">
        <label for="projectName" class="form-label">Project Name (optional)</label>
        <input
          id="projectName"
          v-model="projectName"
          type="text"
          placeholder="my-project"
          class="project-input"
        />
      </div>

      <div v-if="error" class="error-message">
        {{ error }}
      </div>

      <button 
        @click="handleGenerate" 
        :disabled="generating"
        class="generate-btn"
      >
        <template v-if="generating">
          <span class="spinner"></span>
          Generating...
        </template>
        <template v-else>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Generate & Download
        </template>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useCodeGeneration, type TechStack, type DiagramType } from '../composables/useCodeGeneration';

const props = defineProps<{
  mermaidCode: string;
  diagramType?: DiagramType;
}>();

const stacks = [
  { value: 'react-express-prisma' as TechStack, label: 'React + Express', icon: 'R' },
  { value: 'fastapi-sqlalchemy' as TechStack, label: 'FastAPI', icon: 'P' },
  { value: 'nextjs-prisma' as TechStack, label: 'Next.js', icon: 'N' },
];

const selectedStack = ref<TechStack>('react-express-prisma');
const projectName = ref('');

const { generating, error, generateCode, detectDiagramType } = useCodeGeneration();

async function handleGenerate() {
  const type = props.diagramType || detectDiagramType(props.mermaidCode);
  
  await generateCode({
    diagramType: type,
    mermaidCode: props.mermaidCode,
    techStack: selectedStack.value,
    projectName: projectName.value || 'generated-project',
  });
}
</script>

<style scoped>
.codegen-panel {
  background: #FFFFFF;
  border: 1px solid #000000;
  margin-top: 0.75rem;
}

.panel-header {
  padding: 0.5rem 0.75rem;
  background: #F5F5F5;
  border-bottom: 1px solid #E5E5E5;
}

.panel-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #000000;
}

.panel-body {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  font-weight: 600;
  color: #6B7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stack-options {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.stack-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: #FFFFFF;
  border: 1px solid #E5E5E5;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  color: #6B7280;
  cursor: pointer;
  transition: all 0.15s;
}

.stack-btn:hover {
  border-color: #0066FF;
  color: #0066FF;
}

.stack-btn.active {
  background: #0066FF;
  border-color: #0066FF;
  color: #FFFFFF;
}

.stack-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.875rem;
}

.stack-name {
  white-space: nowrap;
}

.project-input {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid #E5E5E5;
  background: #FFFFFF;
  color: #000000;
  outline: none;
  transition: all 0.15s;
}

.project-input:focus {
  border-color: #0066FF;
  box-shadow: 0 0 0 3px rgba(0, 102, 255, 0.2);
}

.project-input::placeholder {
  color: #9CA3AF;
}

.error-message {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  color: #DC2626;
  padding: 0.5rem;
  background: #FEF2F2;
  border: 1px solid #DC2626;
}

.generate-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: #0066FF;
  border: 1px solid #0066FF;
  color: #FFFFFF;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.generate-btn:hover:not(:disabled) {
  background: #0052CC;
  border-color: #0052CC;
}

.generate-btn:disabled {
  background: #9CA3AF;
  border-color: #9CA3AF;
  cursor: not-allowed;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #FFFFFF;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
