import { mount } from 'svelte'
import App from './App.svelte'
// import App from './TestApp.svelte'
import './style.css'

const app = mount(App, {
  target: document.getElementById('app')!,
})

// Global error handler to show errors on screen
window.addEventListener('error', (event) => {
  const errorDiv = document.createElement('div');
  errorDiv.style.position = 'fixed';
  errorDiv.style.top = '0';
  errorDiv.style.left = '0';
  errorDiv.style.width = '100%';
  errorDiv.style.padding = '20px';
  errorDiv.style.backgroundColor = '#fee2e2';
  errorDiv.style.color = '#991b1b';
  errorDiv.style.zIndex = '9999';
  errorDiv.style.fontFamily = 'monospace';
  errorDiv.style.whiteSpace = 'pre-wrap';
  errorDiv.textContent = `Global Error:\n${event.message}\n\nStack:\n${event.error?.stack || 'No stack'}`;
  document.body.appendChild(errorDiv);
});

export default app
