<script lang="ts">
  interface Props {
    mermaidCode?: string;
  }

  let { mermaidCode = $bindable('') }: Props = $props();
</script>

<div class="codegen-panel">
  <p>Code generation panel</p>
</div>

<style>
  .codegen-panel {
    padding: 1rem;
  }
</style>
