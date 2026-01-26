<template>
  <Teleport to="body">
    <div class="toast-container" aria-live="polite">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="['toast', `toast--${toast.type}`]"
          role="alert"
        >
          <div class="toast-icon">
            <span v-if="toast.type === 'success'">&#10003;</span>
            <span v-else-if="toast.type === 'error'">&#10005;</span>
            <span v-else>&#8505;</span>
          </div>
          <span class="toast-message">{{ toast.message }}</span>
          <button 
            class="toast-dismiss" 
            @click="dismissToast(toast.id)"
            aria-label="Dismiss notification"
          >
            &#10005;
          </button>
          <div 
            v-if="toast.duration > 0"
            class="toast-progress"
            :style="{ animationDuration: `${toast.duration}ms` }"
          ></div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useToast } from '../composables/useToast';

const { toasts, dismissToast } = useToast();
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: 360px;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  background: #1a1a1a;
  border: 1px solid #404040;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
  color: #E5E5E5;
  pointer-events: auto;
  position: relative;
  overflow: hidden;
}

.toast--success {
  border-color: #0066FF;
}

.toast--success .toast-icon {
  color: #0066FF;
}

.toast--error {
  border-color: #DC2626;
}

.toast--error .toast-icon {
  color: #DC2626;
}

.toast--info {
  border-color: #6B7280;
}

.toast--info .toast-icon {
  color: #9CA3AF;
}

.toast-icon {
  flex-shrink: 0;
  font-size: 1rem;
  font-weight: 600;
}

.toast-message {
  flex: 1;
  line-height: 1.4;
}

.toast-dismiss {
  flex-shrink: 0;
  background: none;
  border: none;
  color: #6B7280;
  cursor: pointer;
  padding: 0.25rem;
  font-size: 0.75rem;
  line-height: 1;
  transition: color 150ms ease;
}

.toast-dismiss:hover {
  color: #E5E5E5;
}

.toast-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 2px;
  background: currentColor;
  transform-origin: left;
  animation: toast-progress linear forwards;
}

.toast--success .toast-progress {
  background: #0066FF;
}

.toast--error .toast-progress {
  background: #DC2626;
}

.toast--info .toast-progress {
  background: #6B7280;
}

/* Transition animations */
.toast-enter-active {
  animation: toast-slide-in 250ms ease-out forwards;
}

.toast-leave-active {
  animation: toast-slide-out 200ms ease-in forwards;
}

.toast-move {
  transition: transform 250ms ease-out;
}

@keyframes toast-slide-in {
  from {
    opacity: 0;
    transform: translateX(100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes toast-slide-out {
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(100%);
  }
}

@keyframes toast-progress {
  from {
    transform: scaleX(1);
  }
  to {
    transform: scaleX(0);
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active {
    animation: none;
    transition: opacity 150ms ease;
  }
  
  .toast-enter-from,
  .toast-leave-to {
    opacity: 0;
  }
  
  .toast-progress {
    animation: none;
    display: none;
  }
}

/* Mobile responsiveness */
@media (max-width: 480px) {
  .toast-container {
    left: 1rem;
    right: 1rem;
    max-width: none;
  }
}
</style>
