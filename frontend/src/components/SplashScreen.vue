<template>
  <div class="splash-screen">
    <div class="splash-content">
      <div class="logo-container">
        <GRumpBlob size="lg" state="thinking" :animated="true" />
      </div>
      <h1 class="title">Mermaid Generator</h1>
      <p class="subtitle">AI-powered diagram creation</p>
      <div class="loader">
        <div class="loader-bar"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import GRumpBlob from './GRumpBlob.vue';

const emit = defineEmits(['complete']);

onMounted(() => {
  setTimeout(() => {
    emit('complete');
  }, 2000);
});
</script>

<style scoped>
.splash-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #FFFFFF;
  background: radial-gradient(circle at center, #FFFFFF 0%, #F5F5F5 100%);
}

.splash-content {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.logo-container {
  margin-bottom: 1.5rem;
  animation: fade-in 0.5s ease-out;
}

@keyframes fade-in {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 1.5rem;
  font-weight: 600;
  color: #000000;
  margin: 0 0 0.5rem 0;
  letter-spacing: -0.02em;
  border-bottom: 2px solid #0066FF;
  padding-bottom: 0.25rem;
}

.subtitle {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
  color: #6B7280;
  margin: 0 0 2rem 0;
}

.loader {
  width: 200px;
  height: 2px;
  background: #E5E5E5;
  margin: 0 auto;
  overflow: hidden;
  border-radius: 1px;
}

.loader-bar {
  width: 40%;
  height: 100%;
  background: linear-gradient(90deg, #0066FF, #3385FF);
  animation: loading 1.5s ease-in-out infinite;
  box-shadow: 0 0 8px rgba(0, 102, 255, 0.4);
}

@keyframes loading {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(350%); }
}
</style>
