<template>
  <div :class="['skeleton-loader', `skeleton-loader--${variant}`]">
    <template v-if="variant === 'diagram'">
      <div class="skeleton-diagram">
        <div class="skeleton skeleton-header"></div>
        <div class="skeleton-body">
          <div class="skeleton skeleton-node"></div>
          <div class="skeleton skeleton-connector"></div>
          <div class="skeleton skeleton-node"></div>
          <div class="skeleton skeleton-connector"></div>
          <div class="skeleton skeleton-node"></div>
        </div>
      </div>
    </template>
    
    <template v-else-if="variant === 'text'">
      <div class="skeleton-text" v-for="i in count" :key="i">
        <div class="skeleton skeleton-line" :style="{ width: getLineWidth(i) }"></div>
      </div>
    </template>
    
    <template v-else-if="variant === 'card'">
      <div class="skeleton-card" v-for="i in count" :key="i">
        <div class="skeleton skeleton-card-header"></div>
        <div class="skeleton skeleton-card-body"></div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
interface Props {
  variant?: 'diagram' | 'text' | 'card';
  count?: number;
}

withDefaults(defineProps<Props>(), {
  variant: 'text',
  count: 3
});

function getLineWidth(index: number): string {
  // Vary line widths for realistic appearance
  const widths = ['100%', '85%', '70%', '90%', '60%'];
  return widths[(index - 1) % widths.length];
}
</script>

<style scoped>
.skeleton-loader {
  width: 100%;
}

/* Shimmer animation */
.skeleton {
  background: linear-gradient(
    90deg,
    #2a2a2a 0%,
    #3a3a3a 50%,
    #2a2a2a 100%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s infinite linear;
  border-radius: 4px;
}

@keyframes skeleton-shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

/* Diagram skeleton */
.skeleton-diagram {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.skeleton-header {
  height: 20px;
  width: 40%;
  margin: 0 auto;
}

.skeleton-body {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.skeleton-node {
  width: 100px;
  height: 60px;
  border-radius: 8px;
}

.skeleton-connector {
  width: 40px;
  height: 4px;
}

/* Text skeleton */
.skeleton-text {
  margin-bottom: 0.75rem;
}

.skeleton-text:last-child {
  margin-bottom: 0;
}

.skeleton-line {
  height: 16px;
}

/* Card skeleton */
.skeleton-card {
  padding: 1rem;
  border: 1px solid #2a2a2a;
  border-radius: 4px;
  margin-bottom: 1rem;
}

.skeleton-card:last-child {
  margin-bottom: 0;
}

.skeleton-card-header {
  height: 20px;
  width: 60%;
  margin-bottom: 0.75rem;
}

.skeleton-card-body {
  height: 40px;
  width: 100%;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .skeleton {
    animation: none;
    background: #2a2a2a;
  }
}
</style>
