# Vue to Svelte Migration Notes

This document outlines the migration from Vue 3 to Svelte 5.

## Overview

The frontend has been migrated from Vue 3 to Svelte 5 to improve performance and reduce bundle size.

## Key Changes

### Components

All `.vue` files have been converted to `.svelte` files:

- `App.vue` → `App.svelte`
- `ChatInterface.vue` → `ChatInterface.svelte`
- All other components similarly migrated

### Composables → Stores

Vue composables have been converted to Svelte stores:

- `useSessions` → `sessionsStore.ts` (writable store)
- `useToast` → `toastStore.ts` (writable store)
- `useConnectionStatus` → `connectionStatusStore.ts` (writable store)
- `useAuth` → `authStore.ts` (writable store)
- `useClarification` → `clarificationStore.ts` (writable store)
- `useWorkflow` → `workflowStore.ts` (writable store)

### Utilities

Stateless composables converted to utility modules:

- `useAnalytics` → `lib/analytics.ts`
- `useMermaid` → `lib/mermaid.ts`
- `useCodeGeneration` → `lib/codeGeneration.ts`

## Pattern Mappings

### Reactivity

**Vue:**
```typescript
const count = ref(0);
const doubled = computed(() => count.value * 2);
```

**Svelte:**
```typescript
let count = $state(0);
let doubled = $derived(count * 2);
```

### Props

**Vue:**
```typescript
const props = defineProps<{ name: string }>();
```

**Svelte:**
```typescript
let { name = $bindable('') }: { name?: string } = $props();
```

### Events

**Vue:**
```typescript
const emit = defineEmits(['update']);
emit('update', value);
```

**Svelte:**
```typescript
const dispatch = createEventDispatcher();
dispatch('update', { detail: value });
```

### Lifecycle

**Vue:**
```typescript
onMounted(() => { ... });
onUnmounted(() => { ... });
```

**Svelte:**
```typescript
import { onMount, onDestroy } from 'svelte';
onMount(() => { ... });
onDestroy(() => { ... });
```

### Template Syntax

**Vue:**
```vue
<div v-if="show">Content</div>
<div v-for="item in items" :key="item.id">{{ item.name }}</div>
```

**Svelte:**
```svelte
{#if show}
  <div>Content</div>
{/if}
{#each items as item (item.id)}
  <div>{item.name}</div>
{/each}
```

### Stores

**Vue (Composable):**
```typescript
const { count, increment } = useCounter();
```

**Svelte:**
```typescript
import { counterStore } from './stores/counterStore';
$counterStore.increment();
```

## File Structure Changes

```
frontend/src/
  components/     # .svelte files (was .vue)
  stores/         # Svelte stores (was composables/)
  lib/            # Utility modules (was composables/)
  types/          # Unchanged
```

## Breaking Changes

1. **Store Access**: Use `$store` syntax for reactive access
2. **Event Handling**: Events use `on:event` instead of `@event`
3. **Props**: Use `$props()` instead of `defineProps()`
4. **Reactivity**: Use `$state()` and `$derived()` instead of `ref()` and `computed()`

## Benefits

- Smaller bundle size
- Better performance
- Simpler reactivity model
- Better TypeScript integration
- No virtual DOM overhead

## Testing

All functionality has been preserved. Test:
- Message sending/receiving
- Diagram rendering
- Workflow progression
- Session management
- Toast notifications
