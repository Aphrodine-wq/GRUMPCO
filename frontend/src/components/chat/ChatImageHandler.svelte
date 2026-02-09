<script lang="ts">
  /**
   * ChatImageHandler Component
   *
   * Handles image attachment state and NIM provider detection.
   */
  import { showToast } from '../../stores/toastStore';

  interface Props {
    pendingImages: string[];
    maxPendingImages?: number;
    isNimProvider?: boolean;
    onImagesChange?: (images: string[]) => void;
    onImageAdd?: (url: string) => void;
    onImageRemove?: (index: number) => void;
  }

  let {
    pendingImages = $bindable([]),
    maxPendingImages = 3,
    isNimProvider = false,
    onImagesChange,
    onImageAdd,
    onImageRemove,
  }: Props = $props();

  export function addImage(url: string): boolean {
    if (pendingImages.length >= maxPendingImages) {
      showToast(`Maximum ${maxPendingImages} images allowed`, 'error');
      return false;
    }
    
    if (!isNimProvider) {
      showToast('Image support requires NIM provider', 'warning');
      return false;
    }

    pendingImages = [...pendingImages, url];
    onImagesChange?.(pendingImages);
    onImageAdd?.(url);
    showToast('Image attached', 'success');
    return true;
  }

  export function removeImage(index: number): void {
    if (index < 0 || index >= pendingImages.length) return;
    pendingImages = pendingImages.filter((_, i) => i !== index);
    onImagesChange?.(pendingImages);
    onImageRemove?.(index);
  }

  export function clearImages(): void {
    pendingImages = [];
    onImagesChange?.(pendingImages);
  }

  export function getImages(): string[] {
    return [...pendingImages];
  }

  export function hasImages(): boolean {
    return pendingImages.length > 0;
  }
</script>

<!-- This is primarily a logic component, but can render image previews if needed -->
{#if pendingImages.length > 0}
  <div class="image-preview-bar">
    {#each pendingImages as image, index}
      <div class="image-preview">
        <img src={image} alt="Pending attachment" />
        <button 
          type="button" 
          class="remove-image-btn"
          onclick={() => removeImage(index)}
          aria-label="Remove image"
        >
          ×
        </button>
      </div>
    {/each}
  </div>
{/if}

<style>
  .image-preview-bar {
    display: flex;
    gap: 0.5rem;
    padding: 0.5rem;
    overflow-x: auto;
  }

  .image-preview {
    position: relative;
    width: 80px;
    height: 80px;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--color-border, #e5e7eb);
  }

  .image-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .remove-image-btn {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.6);
    color: white;
    border: none;
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }

  .remove-image-btn:hover {
    background: rgba(0, 0, 0, 0.8);
  }
</style>
