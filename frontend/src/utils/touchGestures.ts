/**
 * Touch gesture utilities for mobile interactions
 */

export interface SwipeGestureOptions {
  threshold?: number; // Minimum distance in pixels
  timeout?: number; // Maximum time in ms
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

export class SwipeGestureHandler {
  private startX = 0;
  private startY = 0;
  private startTime = 0;
  private element: HTMLElement;
  private options: Required<SwipeGestureOptions>;

  constructor(element: HTMLElement, options: SwipeGestureOptions = {}) {
    this.element = element;
    this.options = {
      threshold: options.threshold ?? 50,
      timeout: options.timeout ?? 300,
      onSwipeLeft: options.onSwipeLeft ?? (() => { }),
      onSwipeRight: options.onSwipeRight ?? (() => { }),
      onSwipeUp: options.onSwipeUp ?? (() => { }),
      onSwipeDown: options.onSwipeDown ?? (() => { }),
    };

    this.element.addEventListener('touchstart', this.handleTouchStart, { passive: true });
    this.element.addEventListener('touchend', this.handleTouchEnd, { passive: true });
  }

  private handleTouchStart = (e: TouchEvent) => {
    this.startX = e.touches[0].clientX;
    this.startY = e.touches[0].clientY;
    this.startTime = Date.now();
  };

  private handleTouchEnd = (e: TouchEvent) => {
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const endTime = Date.now();

    const deltaX = endX - this.startX;
    const deltaY = endY - this.startY;
    const deltaTime = endTime - this.startTime;

    // Check if gesture is within timeout
    if (deltaTime > this.options.timeout) {
      return;
    }

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Horizontal swipe
    if (absX > absY && absX > this.options.threshold) {
      if (deltaX > 0) {
        this.options.onSwipeRight();
      } else {
        this.options.onSwipeLeft();
      }
    }
    // Vertical swipe
    else if (absY > absX && absY > this.options.threshold) {
      if (deltaY > 0) {
        this.options.onSwipeDown();
      } else {
        this.options.onSwipeUp();
      }
    }
  };

  public destroy() {
    this.element.removeEventListener('touchstart', this.handleTouchStart);
    this.element.removeEventListener('touchend', this.handleTouchEnd);
  }
}

/**
 * Svelte action for swipe gestures
 */
export function swipe(node: HTMLElement, options: SwipeGestureOptions = {}) {
  const handler = new SwipeGestureHandler(node, options);

  return {
    destroy() {
      handler.destroy();
    },
  };
}

/**
 * Pull-to-refresh gesture handler
 */
export interface PullToRefreshOptions {
  threshold?: number;
  onRefresh?: () => void | Promise<void>;
}

export class PullToRefreshHandler {
  private startY = 0;
  private currentY = 0;
  private pulling = false;
  private element: HTMLElement;
  private indicator: HTMLElement | null = null;
  private options: Required<PullToRefreshOptions>;

  constructor(element: HTMLElement, options: PullToRefreshOptions = {}) {
    this.element = element;
    this.options = {
      threshold: options.threshold ?? 80,
      onRefresh: options.onRefresh ?? (() => { }),
    };

    this.createIndicator();
    this.element.addEventListener('touchstart', this.handleTouchStart, { passive: true });
    this.element.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    this.element.addEventListener('touchend', this.handleTouchEnd, { passive: true });
  }

  private createIndicator() {
    this.indicator = document.createElement('div');
    this.indicator.className = 'pull-to-refresh-indicator';
    this.indicator.innerHTML = `
      <div class="pull-to-refresh-spinner"></div>
      <span class="pull-to-refresh-text">Pull to refresh</span>
    `;
    this.indicator.style.cssText = `
      position: absolute;
      top: -60px;
      left: 0;
      right: 0;
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: var(--color-bg-elevated, white);
      transition: transform 0.3s ease;
      z-index: 1000;
    `;
    this.element.style.position = 'relative';
    this.element.insertBefore(this.indicator, this.element.firstChild);
  }

  private handleTouchStart = (e: TouchEvent) => {
    // Only activate if scrolled to top
    if (this.element.scrollTop === 0) {
      this.startY = e.touches[0].clientY;
      this.pulling = true;
    }
  };

  private handleTouchMove = (e: TouchEvent) => {
    if (!this.pulling) return;

    this.currentY = e.touches[0].clientY;
    const pullDistance = this.currentY - this.startY;

    if (pullDistance > 0 && this.element.scrollTop === 0) {
      e.preventDefault();
      const translateY = Math.min(pullDistance, this.options.threshold * 1.5);

      if (this.indicator) {
        this.indicator.style.transform = `translateY(${translateY}px)`;

        const textEl = this.indicator.querySelector('.pull-to-refresh-text');
        if (textEl) {
          textEl.textContent =
            pullDistance >= this.options.threshold ? 'Release to refresh' : 'Pull to refresh';
        }
      }
    }
  };

  private handleTouchEnd = async () => {
    if (!this.pulling) return;

    const pullDistance = this.currentY - this.startY;

    if (pullDistance >= this.options.threshold) {
      // Trigger refresh
      if (this.indicator) {
        const textEl = this.indicator.querySelector('.pull-to-refresh-text');
        if (textEl) {
          textEl.textContent = 'Refreshing...';
        }
      }

      await this.options.onRefresh();
    }

    // Reset
    if (this.indicator) {
      this.indicator.style.transform = 'translateY(0)';
      const textEl = this.indicator.querySelector('.pull-to-refresh-text');
      if (textEl) {
        textEl.textContent = 'Pull to refresh';
      }
    }

    this.pulling = false;
    this.startY = 0;
    this.currentY = 0;
  };

  public destroy() {
    this.element.removeEventListener('touchstart', this.handleTouchStart);
    this.element.removeEventListener('touchmove', this.handleTouchMove);
    this.element.removeEventListener('touchend', this.handleTouchEnd);

    if (this.indicator) {
      this.indicator.remove();
    }
  }
}

/**
 * Svelte action for pull-to-refresh
 */
export function pullToRefresh(node: HTMLElement, options: PullToRefreshOptions = {}) {
  const handler = new PullToRefreshHandler(node, options);

  return {
    destroy() {
      handler.destroy();
    },
  };
}

/**
 * Edge swipe handler for sidebar toggle
 */
export interface EdgeSwipeOptions {
  edgeWidth?: number; // Width of edge detection zone
  threshold?: number; // Minimum swipe distance
  onSwipeFromLeft?: () => void;
  onSwipeFromRight?: () => void;
}

export class EdgeSwipeHandler {
  private startX = 0;
  private startY = 0;
  private isEdgeSwipe = false;
  private options: Required<EdgeSwipeOptions>;

  constructor(options: EdgeSwipeOptions = {}) {
    this.options = {
      edgeWidth: options.edgeWidth ?? 20,
      threshold: options.threshold ?? 50,
      onSwipeFromLeft: options.onSwipeFromLeft ?? (() => { }),
      onSwipeFromRight: options.onSwipeFromRight ?? (() => { }),
    };

    document.addEventListener('touchstart', this.handleTouchStart, { passive: true });
    document.addEventListener('touchend', this.handleTouchEnd, { passive: true });
  }

  private handleTouchStart = (e: TouchEvent) => {
    this.startX = e.touches[0].clientX;
    this.startY = e.touches[0].clientY;

    const windowWidth = window.innerWidth;

    // Check if touch started at edge
    this.isEdgeSwipe =
      this.startX <= this.options.edgeWidth || this.startX >= windowWidth - this.options.edgeWidth;
  };

  private handleTouchEnd = (e: TouchEvent) => {
    if (!this.isEdgeSwipe) return;

    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;

    const deltaX = endX - this.startX;
    const deltaY = Math.abs(endY - this.startY);

    // Ensure horizontal swipe (not diagonal)
    if (deltaY > Math.abs(deltaX)) return;

    const windowWidth = window.innerWidth;

    // Swipe from left edge to right
    if (this.startX <= this.options.edgeWidth && deltaX > this.options.threshold) {
      this.options.onSwipeFromLeft();
      triggerHaptic('light');
    }

    // Swipe from right edge to left
    if (this.startX >= windowWidth - this.options.edgeWidth && deltaX < -this.options.threshold) {
      this.options.onSwipeFromRight();
      triggerHaptic('light');
    }

    this.isEdgeSwipe = false;
  };

  public destroy() {
    document.removeEventListener('touchstart', this.handleTouchStart);
    document.removeEventListener('touchend', this.handleTouchEnd);
  }
}

/**
 * Swipe-to-delete handler for list items
 */
export interface SwipeToDeleteOptions {
  threshold?: number;
  onDelete?: () => void;
  deleteBackground?: string;
}

export class SwipeToDeleteHandler {
  private startX = 0;
  private currentX = 0;
  private element: HTMLElement;
  private options: Required<SwipeToDeleteOptions>;
  private deleteIndicator: HTMLElement | null = null;

  constructor(element: HTMLElement, options: SwipeToDeleteOptions = {}) {
    this.element = element;
    this.options = {
      threshold: options.threshold ?? 100,
      onDelete: options.onDelete ?? (() => { }),
      deleteBackground: options.deleteBackground ?? '#ff3b30',
    };

    this.createDeleteIndicator();
    this.element.addEventListener('touchstart', this.handleTouchStart, { passive: true });
    this.element.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    this.element.addEventListener('touchend', this.handleTouchEnd, { passive: true });
  }

  private createDeleteIndicator() {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
      position: relative;
      overflow: hidden;
    `;

    this.deleteIndicator = document.createElement('div');
    this.deleteIndicator.innerHTML = '🗑️ Delete';
    this.deleteIndicator.style.cssText = `
      position: absolute;
      right: 0;
      top: 0;
      bottom: 0;
      width: 100px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: ${this.options.deleteBackground};
      color: white;
      font-weight: 600;
      transform: translateX(100%);
      transition: transform 0.3s ease;
    `;

    this.element.parentNode?.insertBefore(wrapper, this.element);
    wrapper.appendChild(this.deleteIndicator);
    wrapper.appendChild(this.element);

    this.element.style.transition = 'transform 0.3s ease';
    this.element.style.background = 'var(--color-bg-elevated, white)';
    this.element.style.position = 'relative';
    this.element.style.zIndex = '1';
  }

  private handleTouchStart = (e: TouchEvent) => {
    this.startX = e.touches[0].clientX;
    this.element.style.transition = 'none';
  };

  private handleTouchMove = (e: TouchEvent) => {
    this.currentX = e.touches[0].clientX;
    const deltaX = this.currentX - this.startX;

    if (deltaX < 0) {
      e.preventDefault();
      const translateX = Math.max(deltaX, -this.options.threshold - 20);
      this.element.style.transform = `translateX(${translateX}px)`;

      if (this.deleteIndicator) {
        const indicatorTranslate = Math.max(0, -translateX - this.options.threshold);
        this.deleteIndicator.style.transform = `translateX(${100 - indicatorTranslate}%)`;
      }
    }
  };

  private handleTouchEnd = () => {
    const deltaX = this.currentX - this.startX;
    this.element.style.transition = 'transform 0.3s ease';

    if (deltaX < -this.options.threshold) {
      triggerHaptic('medium');
      this.options.onDelete();
    } else {
      this.element.style.transform = 'translateX(0)';
      if (this.deleteIndicator) {
        this.deleteIndicator.style.transform = 'translateX(100%)';
      }
    }

    this.startX = 0;
    this.currentX = 0;
  };

  public destroy() {
    this.element.removeEventListener('touchstart', this.handleTouchStart);
    this.element.removeEventListener('touchmove', this.handleTouchMove);
    this.element.removeEventListener('touchend', this.handleTouchEnd);
  }
}

/**
 * Svelte action for swipe-to-delete
 */
export function swipeToDelete(node: HTMLElement, options: SwipeToDeleteOptions = {}) {
  const handler = new SwipeToDeleteHandler(node, options);

  return {
    destroy() {
      handler.destroy();
    },
  };
}

/**
 * Haptic feedback utility (uses Vibration API)
 */
export function triggerHaptic(intensity: 'light' | 'medium' | 'heavy' = 'medium'): void {
  if (!('vibrate' in navigator)) return;

  const patterns: Record<string, number | number[]> = {
    light: 10,
    medium: 25,
    heavy: [50, 30, 50],
  };

  try {
    navigator.vibrate(patterns[intensity]);
  } catch {
    // Vibration API not supported or failed
  }
}

/**
 * Check if device is mobile
 */
export function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Check if device supports touch
 */
export function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/**
 * Get viewport dimensions
 */
export function getViewportDimensions() {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    isMobile: window.innerWidth < 768,
    isTablet: window.innerWidth >= 768 && window.innerWidth < 1024,
    isDesktop: window.innerWidth >= 1024,
  };
}

/**
 * Initialize global edge swipe for sidebar
 */
let edgeSwipeInstance: EdgeSwipeHandler | null = null;

export function initEdgeSwipe(options: EdgeSwipeOptions): () => void {
  if (edgeSwipeInstance) {
    edgeSwipeInstance.destroy();
  }

  edgeSwipeInstance = new EdgeSwipeHandler(options);

  return () => {
    edgeSwipeInstance?.destroy();
    edgeSwipeInstance = null;
  };
}
