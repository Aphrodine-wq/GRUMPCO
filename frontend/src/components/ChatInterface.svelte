<script lang="ts">
  // Minimal dummy ChatInterface to prove isolation
  import type { Message } from '../types';

  export let initialMessages: Message[] = [];
  export let onMessagesUpdated = (e: any) => {};
</script>

<div style="padding: 50px; text-align: center; border: 2px dashed red;">
  <h1>Chat Interface Replaced</h1>
  <p>If you see this, the component logic was the crasher.</p>
</div>
