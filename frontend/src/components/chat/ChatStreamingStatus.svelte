<script lang="ts">
  /**
   * ChatStreamingStatus Component
   *
   * Displays streaming status with Claude Code-style file activity tracking.
   */
  import StreamingIndicator from './StreamingIndicator.svelte';

  interface FileActivity {
    path: string;
    shortPath: string;
    action: 'writing' | 'reading' | 'editing' | 'searching' | 'executing' | 'tool';
  }

  interface Props {
    streaming: boolean;
    status: string;
    toolNames: string[];
    activeFiles: FileActivity[];
  }

  let { streaming, status, toolNames, activeFiles }: Props = $props();
</script>

{#if streaming}
  <div class="streaming-message">
    <StreamingIndicator
      {streaming}
      {status}
      toolSummary={toolNames.length > 1 ? toolNames.join(', ') : undefined}
      {activeFiles}
    />
  </div>
{/if}

<style>
  .streaming-message {
    padding: 0.5rem 1rem;
  }
</style>
