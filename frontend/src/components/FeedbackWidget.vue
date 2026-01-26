<template>
  <div class="feedback-widget" v-if="!submitted">
    <span class="feedback-question">Was this helpful?</span>
    <div class="feedback-buttons">
      <button 
        @click="submitFeedback(true)" 
        class="feedback-btn"
        :class="{ selected: selection === true }"
        title="Yes, helpful"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
        </svg>
      </button>
      <button 
        @click="submitFeedback(false)" 
        class="feedback-btn"
        :class="{ selected: selection === false }"
        title="Not helpful"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path>
        </svg>
      </button>
    </div>
  </div>
  <div class="feedback-thanks" v-else>
    <span>Thanks for the feedback!</span>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useAnalytics } from '../composables/useAnalytics';

const props = defineProps<{
  diagramId: string;
}>();

const { trackFeedback } = useAnalytics();

const submitted = ref(false);
const selection = ref<boolean | null>(null);

function submitFeedback(helpful: boolean): void {
  selection.value = helpful;
  trackFeedback(props.diagramId, helpful);
  
  // Show thanks message after a brief delay
  setTimeout(() => {
    submitted.value = true;
  }, 150);
}
</script>

<style scoped>
.feedback-widget {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0;
  margin-top: 0.5rem;
}

.feedback-question {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  color: #6B7280;
}

.feedback-buttons {
  display: flex;
  gap: 0.25rem;
}

.feedback-btn {
  background: transparent;
  border: 1px solid #E5E5E5;
  color: #6B7280;
  padding: 0.35rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.feedback-btn:hover {
  border-color: #000000;
  color: #000000;
}

.feedback-btn.selected {
  background: #000000;
  border-color: #000000;
  color: #FFFFFF;
}

.feedback-thanks {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  color: #6B7280;
  padding: 0.5rem 0;
  margin-top: 0.5rem;
}
</style>
