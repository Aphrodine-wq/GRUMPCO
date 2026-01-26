<template>
  <div class="diagram-container">
    <!-- Loading state -->
    <Transition name="scale-fade" mode="out-in">
      <div v-if="isRendering" class="loading-state" key="loading">
        <SkeletonLoader variant="diagram" />
      </div>
      
      <!-- Error state -->
      <div v-else-if="error" :class="['error-state', { 'shake': showShake }]" key="error">
        <div class="error-icon">!</div>
        <div class="error-message">{{ error }}</div>
        <button v-if="code" class="retry-btn" @click="retryRender">
          Retry
        </button>
      </div>
      
      <!-- Placeholder -->
      <div v-else-if="!code" class="placeholder" key="placeholder">
        Diagram preview
      </div>
      
      <!-- Rendered diagram -->
      <div v-else ref="diagramRef" class="diagram-output" v-html="svgContent" key="diagram"></div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { useMermaid } from '../composables/useMermaid';
import SkeletonLoader from './SkeletonLoader.vue';

const props = defineProps({
  code: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['rendered', 'error']);

const { renderDiagram, error } = useMermaid();
const svgContent = ref('');
const diagramRef = ref<HTMLElement | null>(null);
const isRendering = ref(false);
const showShake = ref(false);
let renderCount = 0;

async function performRender(code: string) {
  if (!code) {
    svgContent.value = '';
    return;
  }

  isRendering.value = true;
  showShake.value = false;

  try {
    renderCount++;
    const elementId = `mermaid-diagram-${renderCount}`;
    const svg = await renderDiagram(code, elementId);
    svgContent.value = svg;
    
    await nextTick();
    emit('rendered', diagramRef.value?.querySelector('svg'));
  } catch (err: any) {
    // Trigger shake animation on error
    showShake.value = true;
    setTimeout(() => { showShake.value = false; }, 500);
    emit('error', err.message);
  } finally {
    isRendering.value = false;
  }
}

function retryRender() {
  if (props.code) {
    performRender(props.code);
  }
}

watch(() => props.code, (newCode) => {
  performRender(newCode || '');
}, { immediate: true });

defineExpose({
  getSvgElement: () => diagramRef.value?.querySelector('svg')
});
</script>

<style scoped>
.diagram-container {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  background: #FFFFFF;
  min-height: 200px;
  position: relative;
}

.loading-state {
  width: 100%;
  padding: 1rem;
}

.placeholder {
  color: #9CA3AF;
  font-size: 0.875rem;
  font-family: 'JetBrains Mono', monospace;
}

/* Error state */
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1.5rem;
  max-width: 80%;
  text-align: center;
}

.error-state.shake {
  animation: shake 0.5s ease-in-out;
}

.error-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #FEF2F2;
  border: 2px solid #DC2626;
  color: #DC2626;
  font-weight: 600;
  font-size: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'JetBrains Mono', monospace;
}

.error-message {
  color: #DC2626;
  font-size: 0.875rem;
  font-family: 'JetBrains Mono', monospace;
  line-height: 1.5;
}

.retry-btn {
  padding: 0.5rem 1rem;
  background: transparent;
  border: 1px solid #DC2626;
  color: #DC2626;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 150ms ease;
}

.retry-btn:hover {
  background: #DC2626;
  color: #FFFFFF;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
  20%, 40%, 60%, 80% { transform: translateX(4px); }
}

.diagram-output {
  padding: 1.5rem;
  width: 100%;
}

.diagram-output :deep(svg) {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 0 auto;
}

/* Hover highlighting for diagram nodes */
.diagram-output :deep(.node) {
  transition: filter 0.15s;
}

.diagram-output :deep(.node:hover) {
  filter: drop-shadow(0 0 4px rgba(0, 0, 0, 0.3));
}

.diagram-output :deep(.node:hover rect),
.diagram-output :deep(.node:hover polygon),
.diagram-output :deep(.node:hover circle) {
  stroke-width: 2px;
}

/* Edge hover effects */
.diagram-output :deep(.edgePath:hover path) {
  stroke-width: 2px;
}

/* Transition classes */
.scale-fade-enter-active,
.scale-fade-leave-active {
  transition: all 200ms ease-out;
}

.scale-fade-enter-from,
.scale-fade-leave-to {
  opacity: 0;
  transform: scale(0.98);
}
</style>
