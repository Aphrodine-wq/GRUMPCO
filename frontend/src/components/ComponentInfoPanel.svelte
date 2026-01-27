<script lang="ts">
  import type { Component } from '../types/workflow';

  interface Props {
    component: Component | null;
    onClose?: () => void;
  }

  let { component, onClose }: Props = $props();
</script>

{#if component}
  <div class="component-info-panel" role="dialog" aria-label="Component Information">
    <div class="panel-header">
      <h3 class="panel-title">{component.name}</h3>
      {#if onClose}
        <button class="close-btn" on:click={onClose} aria-label="Close panel">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      {/if}
    </div>
    
    <div class="panel-content">
      {#if component.description}
        <div class="info-section">
          <div class="section-label">Description</div>
          <div class="section-value">{component.description}</div>
        </div>
      {/if}
      
      <div class="info-section">
        <div class="section-label">Type</div>
        <div class="section-value">
          <span class="type-badge type-{component.type}">{component.type}</span>
        </div>
      </div>
      
      {#if component.technology && component.technology.length > 0}
        <div class="info-section">
          <div class="section-label">Technology Stack</div>
          <div class="tech-stack">
            {#each component.technology as tech (tech)}
              <span class="tech-badge">{tech}</span>
            {/each}
          </div>
        </div>
      {:else}
        <div class="info-section">
          <div class="section-label">Technology Stack</div>
          <div class="section-value no-tech">No technology specified</div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .component-info-panel {
    position: absolute;
    top: 1rem;
    right: 1rem;
    width: 320px;
    max-width: calc(100% - 2rem);
    background: #FFFFFF;
    border: 1px solid #E5E5E5;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    animation: slideIn 0.2s ease-out;
    font-family: 'JetBrains Mono', monospace;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(20px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid #E5E5E5;
    background: #F9FAFB;
    border-radius: 8px 8px 0 0;
  }

  .panel-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #000000;
    margin: 0;
    flex: 1;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: #6B7280;
    cursor: pointer;
    transition: all 0.15s;
    flex-shrink: 0;
  }

  .close-btn:hover {
    background: #F5F5F5;
    color: #000000;
  }

  .close-btn svg {
    width: 16px;
    height: 16px;
  }

  .panel-content {
    padding: 1rem;
    max-height: 400px;
    overflow-y: auto;
  }

  .info-section {
    margin-bottom: 1rem;
  }

  .info-section:last-child {
    margin-bottom: 0;
  }

  .section-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #6B7280;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 0.5rem;
  }

  .section-value {
    font-size: 0.875rem;
    color: #000000;
    line-height: 1.5;
  }

  .section-value.no-tech {
    color: #9CA3AF;
    font-style: italic;
  }

  .type-badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: capitalize;
  }

  .type-badge.type-frontend {
    background: #DBEAFE;
    color: #1E40AF;
  }

  .type-badge.type-backend {
    background: #D1FAE5;
    color: #065F46;
  }

  .type-badge.type-database {
    background: #FEF3C7;
    color: #92400E;
  }

  .type-badge.type-service {
    background: #E9D5FF;
    color: #6B21A8;
  }

  .type-badge.type-external {
    background: #FCE7F3;
    color: #9F1239;
  }

  .type-badge.type-queue {
    background: #FED7AA;
    color: #9A3412;
  }

  .tech-stack {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .tech-badge {
    display: inline-block;
    padding: 0.375rem 0.75rem;
    background: #F3F4F6;
    border: 1px solid #E5E7EB;
    border-radius: 4px;
    font-size: 0.75rem;
    color: #374151;
    font-weight: 500;
  }
</style>
