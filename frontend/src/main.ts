/* eslint-disable @typescript-eslint/no-non-null-assertion -- root mount target (Phase 1.1) */
window.onerror = function (msg, url, line, col, error) {
  const div = document.createElement('div');
  div.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:white;color:red;padding:20px;z-index:99999;white-space:pre-wrap;font-family:monospace;overflow:auto;';
  div.innerText = 'Runtime Error:\n' + msg + '\n\n' + url + ':' + line + ':' + col + '\n\n' + (error ? error.stack : '');
  document.body.appendChild(div);
  console.error(error);
};
console.log('App initializing...');
import { mount } from 'svelte'
import { inject } from '@vercel/analytics'
import App from './App.svelte'
// import App from './TestApp.svelte'
import './style.css'

// Initialize Vercel Web Analytics
inject()

const app = mount(App, {
  target: document.getElementById('app')!,
})



export default app
