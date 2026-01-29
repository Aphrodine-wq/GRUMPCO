/* eslint-disable @typescript-eslint/no-non-null-assertion -- root mount target (Phase 1.1) */
import { mount } from 'svelte'
import App from './App.svelte'
// import App from './TestApp.svelte'
import './style.css'

const app = mount(App, {
  target: document.getElementById('app')!,
})



export default app
