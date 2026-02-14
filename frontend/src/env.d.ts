/// <reference types="vite/client" />

declare module '*.svelte' {
  import type { ComponentType, SvelteComponent } from 'svelte';
  const component: ComponentType<SvelteComponent>;
  export default component;
}

declare module 'diff' {
  export interface Change {
    value: string;
    added?: boolean;
    removed?: boolean;
    count?: number;
  }
  export function diffLines(oldStr: string, newStr: string): Change[];
  export function diffWords(oldStr: string, newStr: string): Change[];
  export function diffChars(oldStr: string, newStr: string): Change[];
}
