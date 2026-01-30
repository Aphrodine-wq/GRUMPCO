<script lang="ts">
  import { RECOMMENDED_EXTENSIONS, marketplaceUrl } from '../lib/recommendedExtensions.js';
</script>

<div class="recommended-extensions">
  <h2 class="section-title">Recommended VS Code extensions</h2>
  <p class="section-desc">Useful extensions when working with G-Rump–generated code. Open in Marketplace to install.</p>
  <ul class="ext-list">
    {#each RECOMMENDED_EXTENSIONS as ext}
      <li class="ext-item">
        <div class="ext-info">
          <span class="ext-name">{ext.name}</span>
          <span class="ext-desc">{ext.description}</span>
        </div>
        <a
          href={marketplaceUrl(ext)}
          target="_blank"
          rel="noopener noreferrer"
          class="ext-link"
        >
          Open in Marketplace
        </a>
      </li>
    {/each}
  </ul>
</div>

<style>
  .recommended-extensions {
    margin-top: 1.5rem;
    padding: 1.25rem;
    background: #f9fafb;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
  }
  .section-title {
    font-size: 1rem;
    font-weight: 600;
    color: #111827;
    margin: 0 0 0.35rem 0;
  }
  .section-desc {
    font-size: 0.8125rem;
    color: #6b7280;
    margin: 0 0 1rem 0;
    line-height: 1.4;
  }
  .ext-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .ext-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: #fff;
    border-radius: 6px;
    border: 1px solid #e5e7eb;
  }
  .ext-info {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .ext-name {
    font-size: 0.9375rem;
    font-weight: 600;
    color: #111827;
  }
  .ext-desc {
    font-size: 0.8125rem;
    color: #6b7280;
  }
  .ext-link {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-primary);
    text-decoration: none;
    white-space: nowrap;
  }
  .ext-link:hover {
    text-decoration: underline;
  }
</style>

