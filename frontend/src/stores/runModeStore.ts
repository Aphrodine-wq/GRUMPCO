/**
 * Run mode: 'docker' | 'local'.
 * Set by FreeAgentScreen when it detects Docker; ChatInterface uses it for local confirmation.
 */
import { writable } from 'svelte/store';

export const runMode = writable<'docker' | 'local'>('local');
