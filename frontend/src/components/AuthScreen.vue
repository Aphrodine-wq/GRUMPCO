<template>
  <div class="auth-screen">
    <div class="auth-container">
      <div class="auth-header">
        <GRumpBlob size="md" state="idle" :animated="true" />
        <h1 class="title">API Configuration</h1>
        <p class="subtitle">Enter your Anthropic API key to continue</p>
      </div>

      <form @submit.prevent="validateKey" class="auth-form">
        <div class="input-group">
          <label for="apiKey" class="input-label">API Key</label>
          <input
            id="apiKey"
            v-model="apiKey"
            type="password"
            placeholder="sk-ant-..."
            class="input-field"
            :class="{ 'input-error': error }"
          />
          <p v-if="error" class="error-text">{{ error }}</p>
        </div>

        <button type="submit" class="submit-btn" :disabled="!apiKey.trim()">
          Continue
        </button>
      </form>

      <div class="help-section">
        <p class="help-text">
          Get your API key from
          <a href="https://console.anthropic.com/" target="_blank" rel="noopener" class="help-link">
            console.anthropic.com
          </a>
        </p>
        <p class="help-text help-note">
          Key will be validated on first diagram generation.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import GRumpBlob from './GRumpBlob.vue';

const emit = defineEmits(['validated']);

const apiKey = ref('');
const error = ref('');

async function validateKey() {
  if (!apiKey.value.trim()) return;

  error.value = '';
  
  // Validate format
  if (!apiKey.value.startsWith('sk-ant-')) {
    error.value = 'Invalid format. Key should start with sk-ant-';
    return;
  }
  
  if (apiKey.value.length < 40) {
    error.value = 'Key appears incomplete. Please check and try again.';
    return;
  }

  // Store key and proceed - actual validation happens on first API call
  localStorage.setItem('anthropic-api-key', apiKey.value.trim());
  emit('validated', true);
}
</script>

<style scoped>
.auth-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #F5F5F5;
  padding: 1rem;
}

.auth-container {
  width: 100%;
  max-width: 400px;
  background: #FFFFFF;
  border: 1px solid #000000;
  padding: 2rem;
}

.auth-header {
  text-align: center;
  margin-bottom: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
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

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.input-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  font-weight: 600;
  color: #000000;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.input-field {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
  padding: 0.75rem;
  border: 1px solid #000000;
  background: #FFFFFF;
  color: #000000;
  outline: none;
  transition: all 0.15s;
}

.input-field:focus {
  border-color: #0066FF;
  box-shadow: 0 0 0 3px rgba(0, 102, 255, 0.2);
}

.input-field::placeholder {
  color: #9CA3AF;
}

.input-field.input-error {
  border-color: #DC2626;
}

.error-text {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  color: #DC2626;
  margin: 0;
}

.submit-btn {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
  font-weight: 600;
  padding: 0.75rem 1.5rem;
  background: #0066FF;
  color: #FFFFFF;
  border: 1px solid #0066FF;
  cursor: pointer;
  transition: all 0.15s;
}

.submit-btn:hover:not(:disabled) {
  background: #0052CC;
  border-color: #0052CC;
}

.submit-btn:disabled {
  background: #9CA3AF;
  border-color: #9CA3AF;
  cursor: not-allowed;
}

.help-section {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #E5E5E5;
  text-align: center;
}

.help-text {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  color: #6B7280;
  margin: 0;
}

.help-link {
  color: #0066FF;
  text-decoration: underline;
}

.help-link:hover {
  text-decoration: none;
}

.help-note {
  margin-top: 0.5rem;
  font-style: italic;
}
</style>
