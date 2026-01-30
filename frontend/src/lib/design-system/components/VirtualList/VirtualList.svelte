<script lang="ts">
  /**
   * VirtualList - Efficient virtual scrolling component
   * Only renders items that are visible in the viewport
   * 
   * Usage:
   * <VirtualList items={messages} itemHeight={80} let:item>
   *   <MessageItem message={item} />
   * </VirtualList>
   */
  
  import { onMount, onDestroy } from 'svelte';
  
  // Props
  let {
    items = [],
    itemHeight = 60,
    overscan = 3,
    class: className = '',
    onScroll,
  }: {
    items: unknown[];
    itemHeight: number;
    overscan?: number;
    class?: string;
    onScroll?: (event: { scrollTop: number; scrollHeight: number; clientHeight: number }) => void;
  } = $props();
  
  // State
  let container: HTMLElement;
  let scrollTop = $state(0);
  let containerHeight = $state(0);
  
  // Computed values
  let totalHeight = $derived(items.length * itemHeight);
  
  let startIndex = $derived(
    Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  );
  
  let endIndex = $derived(
    Math.min(
      items.length,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    )
  );
  
  let visibleItems = $derived(
    items.slice(startIndex, endIndex).map((item, index) => ({
      item,
      index: startIndex + index,
      style: `position: absolute; top: ${(startIndex + index) * itemHeight}px; left: 0; right: 0; height: ${itemHeight}px;`,
    }))
  );
  
  let offsetY = $derived(startIndex * itemHeight);
  
  // Handle scroll
  function handleScroll(e: Event) {
    const target = e.target as HTMLElement;
    scrollTop = target.scrollTop;
    
    onScroll?.({
      scrollTop: target.scrollTop,
      scrollHeight: target.scrollHeight,
      clientHeight: target.clientHeight,
    });
  }
  
  // Resize observer
  let resizeObserver: ResizeObserver | null = null;
  
  onMount(() => {
    if (container) {
      containerHeight = container.clientHeight;
      
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          containerHeight = entry.contentRect.height;
        }
      });
      
      resizeObserver.observe(container);
    }
  });
  
  onDestroy(() => {
    resizeObserver?.disconnect();
  });
  
  // Scroll to item
  export function scrollToIndex(index: number, behavior: ScrollBehavior = 'smooth') {
    if (container) {
      container.scrollTo({
        top: index * itemHeight,
        behavior,
      });
    }
  }
  
  // Scroll to bottom
  export function scrollToBottom(behavior: ScrollBehavior = 'smooth') {
    if (container) {
      container.scrollTo({
        top: totalHeight,
        behavior,
      });
    }
  }
</script>

<div
  bind:this={container}
  class="virtual-list-container {className}"
  onscroll={handleScroll}
>
  <div class="virtual-list-content" style="height: {totalHeight}px; position: relative;">
    {#each visibleItems as { item, index, style } (index)}
      <div class="virtual-list-item" {style}>
        {@render children(item, index)}
      </div>
    {/each}
  </div>
</div>

{#snippet children(item: unknown, index: number)}
  <!-- Default slot content - override with let:item -->
  <div>Item {index}</div>
{/snippet}

<style>
  .virtual-list-container {
    overflow-y: auto;
    overflow-x: hidden;
    height: 100%;
    width: 100%;
    position: relative;
  }
  
  .virtual-list-content {
    position: relative;
    width: 100%;
  }
  
  .virtual-list-item {
    box-sizing: border-box;
    width: 100%;
  }
  
  /* Smooth scrolling */
  @media (prefers-reduced-motion: no-preference) {
    .virtual-list-container {
      scroll-behavior: smooth;
    }
  }
</style>
