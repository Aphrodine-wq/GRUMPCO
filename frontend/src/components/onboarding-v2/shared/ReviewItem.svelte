<script lang="ts">
  import { Check, Edit3 } from 'lucide-svelte';

  interface Props {
    label: string;
    value: string;
    configured?: boolean;
    onEdit: () => void;
  }

  let { label, value, configured = false, onEdit }: Props = $props();
</script>

<div class="review-item" class:configured>
  <div class="item-status">
    {#if configured}
      <Check size={16} />
    {:else}
      <span class="empty-dot"></span>
    {/if}
  </div>
  <div class="item-content">
    <span class="item-label">{label}</span>
    <span class="item-value" class:empty={!configured}>
      {value}
    </span>
  </div>
  <button class="edit-button" onclick={onEdit} aria-label="Edit {label}">
    <Edit3 size={14} />
  </button>
</div>

<style>
  .review-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    transition: all 0.2s;
  }

  .review-item:hover {
    border-color: #d1d5db;
  }

  .review-item.configured {
    border-color: #d1fae5;
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.02) 0%, rgba(16, 185, 129, 0.05) 100%);
  }

  .item-status {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .review-item.configured .item-status {
    background: #10b981;
    color: white;
  }

  .empty-dot {
    width: 8px;
    height: 8px;
    background: #e5e7eb;
    border-radius: 50%;
  }

  .item-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
    min-width: 0;
  }

  .item-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  .item-value {
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .item-value.empty {
    color: #9ca3af;
    font-style: italic;
  }

  .edit-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: #f3f4f6;
    border: none;
    border-radius: 8px;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .edit-button:hover {
    background: #e5e7eb;
    color: #374151;
  }

  .edit-button:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px #7c3aed;
  }

  @media (prefers-reduced-motion: reduce) {
    .review-item,
    .edit-button {
      transition: none;
    }
  }
</style>
