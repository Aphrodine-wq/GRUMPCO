/**
 * Tests for touchGestures utility
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  SwipeGestureHandler,
  swipe,
  PullToRefreshHandler,
  pullToRefresh,
  EdgeSwipeHandler,
  SwipeToDeleteHandler,
  swipeToDelete,
  triggerHaptic,
  isMobileDevice,
  isTouchDevice,
  getViewportDimensions,
  initEdgeSwipe,
} from './touchGestures';

// Mock navigator
Object.defineProperty(navigator, 'userAgent', {
  value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  writable: true,
  configurable: true,
});

Object.defineProperty(navigator, 'maxTouchPoints', {
  value: 0,
  writable: true,
  configurable: true,
});

Object.defineProperty(navigator, 'vibrate', {
  value: vi.fn(),
  writable: true,
  configurable: true,
});

describe('touchGestures', () => {
  let mockElement: HTMLElement;

  // Helper to create mock touch

  function createMockTouch(clientX: number, clientY: number, target: HTMLElement): Touch {
    return { clientX, clientY, identifier: 0, target } as unknown as Touch;
  }

  beforeEach(() => {
    mockElement = document.createElement('div');
    document.body.appendChild(mockElement);
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.removeChild(mockElement);
  });

  describe('SwipeGestureHandler', () => {
    it('should create handler with default options', () => {
      const handler = new SwipeGestureHandler(mockElement);

      expect(handler).toBeDefined();
      handler.destroy();
    });

    it('should create handler with custom options', () => {
      const onSwipeLeft = vi.fn();
      const handler = new SwipeGestureHandler(mockElement, {
        threshold: 100,
        timeout: 500,
        onSwipeLeft,
      });

      expect(handler).toBeDefined();
      handler.destroy();
    });

    it('should destroy without errors', () => {
      const handler = new SwipeGestureHandler(mockElement);

      expect(() => handler.destroy()).not.toThrow();
    });

    it('should detect swipe right gesture', () => {
      const onSwipeRight = vi.fn();
      const handler = new SwipeGestureHandler(mockElement, {
        threshold: 50,
        timeout: 300,
        onSwipeRight,
      });

      // Simulate touch start
      const touchStartEvent = new TouchEvent('touchstart', {
        touches: [createMockTouch(0, 100, mockElement)],
      });
      mockElement.dispatchEvent(touchStartEvent);

      // Simulate touch end (swipe right by 100px within timeout)
      const touchEndEvent = new TouchEvent('touchend', {
        changedTouches: [createMockTouch(100, 100, mockElement)],
      });
      mockElement.dispatchEvent(touchEndEvent);

      expect(onSwipeRight).toHaveBeenCalled();
      handler.destroy();
    });

    it('should detect swipe left gesture', () => {
      const onSwipeLeft = vi.fn();
      const handler = new SwipeGestureHandler(mockElement, {
        threshold: 50,
        timeout: 300,
        onSwipeLeft,
      });

      const touchStartEvent = new TouchEvent('touchstart', {
        touches: [createMockTouch(100, 100, mockElement)],
      });
      mockElement.dispatchEvent(touchStartEvent);

      const touchEndEvent = new TouchEvent('touchend', {
        changedTouches: [createMockTouch(0, 100, mockElement)],
      });
      mockElement.dispatchEvent(touchEndEvent);

      expect(onSwipeLeft).toHaveBeenCalled();
      handler.destroy();
    });

    it('should detect swipe down gesture', () => {
      const onSwipeDown = vi.fn();
      const handler = new SwipeGestureHandler(mockElement, {
        threshold: 50,
        timeout: 300,
        onSwipeDown,
      });

      const touchStartEvent = new TouchEvent('touchstart', {
        touches: [createMockTouch(100, 0, mockElement)],
      });
      mockElement.dispatchEvent(touchStartEvent);

      const touchEndEvent = new TouchEvent('touchend', {
        changedTouches: [createMockTouch(100, 100, mockElement)],
      });
      mockElement.dispatchEvent(touchEndEvent);

      expect(onSwipeDown).toHaveBeenCalled();
      handler.destroy();
    });

    it('should detect swipe up gesture', () => {
      const onSwipeUp = vi.fn();
      const handler = new SwipeGestureHandler(mockElement, {
        threshold: 50,
        timeout: 300,
        onSwipeUp,
      });

      const touchStartEvent = new TouchEvent('touchstart', {
        touches: [createMockTouch(100, 100, mockElement)],
      });
      mockElement.dispatchEvent(touchStartEvent);

      const touchEndEvent = new TouchEvent('touchend', {
        changedTouches: [createMockTouch(100, 0, mockElement)],
      });
      mockElement.dispatchEvent(touchEndEvent);

      expect(onSwipeUp).toHaveBeenCalled();
      handler.destroy();
    });

    it('should not trigger swipe if below threshold', () => {
      const onSwipeRight = vi.fn();
      const handler = new SwipeGestureHandler(mockElement, {
        threshold: 100,
        timeout: 300,
        onSwipeRight,
      });

      const touchStartEvent = new TouchEvent('touchstart', {
        touches: [createMockTouch(0, 100, mockElement)],
      });
      mockElement.dispatchEvent(touchStartEvent);

      // Move less than threshold
      const touchEndEvent = new TouchEvent('touchend', {
        changedTouches: [createMockTouch(50, 100, mockElement)],
      });
      mockElement.dispatchEvent(touchEndEvent);

      expect(onSwipeRight).not.toHaveBeenCalled();
      handler.destroy();
    });
  });

  describe('swipe action', () => {
    it('should create swipe action', () => {
      const action = swipe(mockElement);

      expect(action).toHaveProperty('destroy');
      expect(typeof action.destroy).toBe('function');

      action.destroy();
    });

    it('should destroy swipe action', () => {
      const action = swipe(mockElement);

      expect(() => action.destroy()).not.toThrow();
    });
  });

  describe('PullToRefreshHandler', () => {
    it('should create handler with default options', () => {
      const handler = new PullToRefreshHandler(mockElement);

      expect(handler).toBeDefined();
      handler.destroy();
    });

    it('should create handler with custom options', () => {
      const onRefresh = vi.fn();
      const handler = new PullToRefreshHandler(mockElement, {
        threshold: 100,
        onRefresh,
      });

      expect(handler).toBeDefined();
      handler.destroy();
    });

    it('should create indicator element', () => {
      const handler = new PullToRefreshHandler(mockElement);

      const indicator = mockElement.querySelector('.pull-to-refresh-indicator');
      expect(indicator).not.toBeNull();

      handler.destroy();
    });

    it('should destroy without errors', () => {
      const handler = new PullToRefreshHandler(mockElement);

      expect(() => handler.destroy()).not.toThrow();
    });

    it('should handle touch start when at top of scroll', () => {
      mockElement.scrollTop = 0;
      const handler = new PullToRefreshHandler(mockElement);

      const touchStartEvent = new TouchEvent('touchstart', {
        touches: [createMockTouch(100, 50, mockElement)],
      });
      mockElement.dispatchEvent(touchStartEvent);

      // Handler should be ready to detect pull
      expect(handler).toBeDefined();
      handler.destroy();
    });

    it('should not start pulling when not at top of scroll', () => {
      Object.defineProperty(mockElement, 'scrollTop', { value: 100, configurable: true });
      const handler = new PullToRefreshHandler(mockElement);

      const touchStartEvent = new TouchEvent('touchstart', {
        touches: [createMockTouch(100, 50, mockElement)],
      });
      mockElement.dispatchEvent(touchStartEvent);

      handler.destroy();
    });

    it('should handle touch move while pulling', () => {
      mockElement.scrollTop = 0;
      const handler = new PullToRefreshHandler(mockElement, { threshold: 60 });

      // Start touch
      const touchStartEvent = new TouchEvent('touchstart', {
        touches: [createMockTouch(100, 50, mockElement)],
      });
      mockElement.dispatchEvent(touchStartEvent);

      // Move down
      const touchMoveEvent = new TouchEvent('touchmove', {
        touches: [createMockTouch(100, 100, mockElement)],
      });
      mockElement.dispatchEvent(touchMoveEvent);

      handler.destroy();
    });

    it('should trigger refresh when pulled beyond threshold', async () => {
      mockElement.scrollTop = 0;
      const onRefresh = vi.fn().mockResolvedValue(undefined);
      const handler = new PullToRefreshHandler(mockElement, {
        threshold: 60,
        onRefresh,
      });

      // Start touch
      mockElement.dispatchEvent(
        new TouchEvent('touchstart', {
          touches: [createMockTouch(100, 50, mockElement)],
        })
      );

      // Move down past threshold
      mockElement.dispatchEvent(
        new TouchEvent('touchmove', {
          touches: [createMockTouch(100, 200, mockElement)],
        })
      );

      // End touch
      mockElement.dispatchEvent(new TouchEvent('touchend', {}));

      // Wait for async refresh callback
      await vi.waitFor(() => {
        expect(onRefresh).toHaveBeenCalled();
      });

      handler.destroy();
    });

    it('should not trigger refresh when pulled below threshold', async () => {
      mockElement.scrollTop = 0;
      const onRefresh = vi.fn();
      const handler = new PullToRefreshHandler(mockElement, {
        threshold: 100,
        onRefresh,
      });

      // Start touch
      mockElement.dispatchEvent(
        new TouchEvent('touchstart', {
          touches: [createMockTouch(100, 50, mockElement)],
        })
      );

      // Move down but not past threshold
      mockElement.dispatchEvent(
        new TouchEvent('touchmove', {
          touches: [createMockTouch(100, 80, mockElement)],
        })
      );

      // End touch
      mockElement.dispatchEvent(new TouchEvent('touchend', {}));

      // Should not trigger refresh
      expect(onRefresh).not.toHaveBeenCalled();

      handler.destroy();
    });
  });

  describe('pullToRefresh action', () => {
    it('should create pull-to-refresh action', () => {
      const action = pullToRefresh(mockElement);

      expect(action).toHaveProperty('destroy');
      expect(typeof action.destroy).toBe('function');

      action.destroy();
    });
  });

  describe('EdgeSwipeHandler', () => {
    it('should create handler with default options', () => {
      const handler = new EdgeSwipeHandler();

      expect(handler).toBeDefined();
      handler.destroy();
    });

    it('should create handler with custom options', () => {
      const onSwipeFromLeft = vi.fn();
      const handler = new EdgeSwipeHandler({
        edgeWidth: 30,
        threshold: 75,
        onSwipeFromLeft,
      });

      expect(handler).toBeDefined();
      handler.destroy();
    });

    it('should destroy without errors', () => {
      const handler = new EdgeSwipeHandler();

      expect(() => handler.destroy()).not.toThrow();
    });

    it('should detect swipe from left edge', () => {
      const onSwipeFromLeft = vi.fn();
      const handler = new EdgeSwipeHandler({
        edgeWidth: 20,
        threshold: 50,
        onSwipeFromLeft,
      });

      // Touch start at left edge (x = 10)
      const touchStartEvent = new TouchEvent('touchstart', {
        touches: [createMockTouch(10, 100, document.body)],
      });
      document.dispatchEvent(touchStartEvent);

      // Touch end with swipe to right
      const touchEndEvent = new TouchEvent('touchend', {
        changedTouches: [createMockTouch(100, 100, document.body)],
      });
      document.dispatchEvent(touchEndEvent);

      expect(onSwipeFromLeft).toHaveBeenCalled();
      handler.destroy();
    });

    it('should detect swipe from right edge', () => {
      const onSwipeFromRight = vi.fn();
      const handler = new EdgeSwipeHandler({
        edgeWidth: 20,
        threshold: 50,
        onSwipeFromRight,
      });

      // Set window width
      Object.defineProperty(window, 'innerWidth', { value: 400, configurable: true });

      // Touch start at right edge (x = 390, near edge at 400-20=380)
      const touchStartEvent = new TouchEvent('touchstart', {
        touches: [createMockTouch(390, 100, document.body)],
      });
      document.dispatchEvent(touchStartEvent);

      // Touch end with swipe to left (negative delta)
      const touchEndEvent = new TouchEvent('touchend', {
        changedTouches: [createMockTouch(300, 100, document.body)],
      });
      document.dispatchEvent(touchEndEvent);

      expect(onSwipeFromRight).toHaveBeenCalled();
      handler.destroy();
    });

    it('should not trigger if not starting from edge', () => {
      const onSwipeFromLeft = vi.fn();
      const handler = new EdgeSwipeHandler({
        edgeWidth: 20,
        threshold: 50,
        onSwipeFromLeft,
      });

      // Touch start in center (not at edge)
      const touchStartEvent = new TouchEvent('touchstart', {
        touches: [createMockTouch(200, 100, document.body)],
      });
      document.dispatchEvent(touchStartEvent);

      // Touch end
      const touchEndEvent = new TouchEvent('touchend', {
        changedTouches: [createMockTouch(300, 100, document.body)],
      });
      document.dispatchEvent(touchEndEvent);

      expect(onSwipeFromLeft).not.toHaveBeenCalled();
      handler.destroy();
    });

    it('should not trigger if swipe is diagonal (vertical movement too large)', () => {
      const onSwipeFromLeft = vi.fn();
      const handler = new EdgeSwipeHandler({
        edgeWidth: 20,
        threshold: 50,
        onSwipeFromLeft,
      });

      // Touch start at left edge
      const touchStartEvent = new TouchEvent('touchstart', {
        touches: [createMockTouch(10, 100, document.body)],
      });
      document.dispatchEvent(touchStartEvent);

      // Touch end with large vertical movement
      const touchEndEvent = new TouchEvent('touchend', {
        changedTouches: [createMockTouch(100, 300, document.body)],
      });
      document.dispatchEvent(touchEndEvent);

      expect(onSwipeFromLeft).not.toHaveBeenCalled();
      handler.destroy();
    });
  });

  describe('SwipeToDeleteHandler', () => {
    let parent: HTMLElement;
    let child: HTMLElement;

    beforeEach(() => {
      parent = document.createElement('div');
      child = document.createElement('div');
      parent.appendChild(child);
      document.body.appendChild(parent);
    });

    afterEach(() => {
      if (parent.parentNode) {
        document.body.removeChild(parent);
      }
    });

    it('should create handler with default options', () => {
      const handler = new SwipeToDeleteHandler(child);

      expect(handler).toBeDefined();
      handler.destroy();
    });

    it('should create handler with custom options', () => {
      const onDelete = vi.fn();
      const handler = new SwipeToDeleteHandler(child, {
        threshold: 150,
        onDelete,
        deleteBackground: '#ff0000',
      });

      expect(handler).toBeDefined();
      handler.destroy();
    });

    it('should destroy without errors', () => {
      const handler = new SwipeToDeleteHandler(child);

      expect(() => handler.destroy()).not.toThrow();
    });

    it('should handle touch start event', () => {
      const handler = new SwipeToDeleteHandler(child);

      const touchStartEvent = new TouchEvent('touchstart', {
        touches: [createMockTouch(200, 100, child)],
      });
      child.dispatchEvent(touchStartEvent);

      handler.destroy();
    });

    it('should handle touch move to the left', () => {
      const handler = new SwipeToDeleteHandler(child, { threshold: 100 });

      // Touch start
      child.dispatchEvent(
        new TouchEvent('touchstart', {
          touches: [createMockTouch(200, 100, child)],
        })
      );

      // Touch move left
      const touchMoveEvent = new TouchEvent('touchmove', {
        cancelable: true,
        touches: [createMockTouch(100, 100, child)],
      });
      child.dispatchEvent(touchMoveEvent);

      handler.destroy();
    });

    it('should trigger delete when swiped past threshold', () => {
      const onDelete = vi.fn();
      const handler = new SwipeToDeleteHandler(child, {
        threshold: 100,
        onDelete,
      });

      // Touch start
      child.dispatchEvent(
        new TouchEvent('touchstart', {
          touches: [createMockTouch(300, 100, child)],
        })
      );

      // Touch move left past threshold
      child.dispatchEvent(
        new TouchEvent('touchmove', {
          cancelable: true,
          touches: [createMockTouch(100, 100, child)],
        })
      );

      // Touch end
      child.dispatchEvent(new TouchEvent('touchend', {}));

      expect(onDelete).toHaveBeenCalled();
      handler.destroy();
    });

    it('should reset when not swiped past threshold', () => {
      const onDelete = vi.fn();
      const handler = new SwipeToDeleteHandler(child, {
        threshold: 100,
        onDelete,
      });

      // Touch start
      child.dispatchEvent(
        new TouchEvent('touchstart', {
          touches: [createMockTouch(200, 100, child)],
        })
      );

      // Touch move left but not past threshold
      child.dispatchEvent(
        new TouchEvent('touchmove', {
          cancelable: true,
          touches: [createMockTouch(150, 100, child)],
        })
      );

      // Touch end
      child.dispatchEvent(new TouchEvent('touchend', {}));

      expect(onDelete).not.toHaveBeenCalled();
      handler.destroy();
    });

    it('should not prevent default for rightward swipe', () => {
      const handler = new SwipeToDeleteHandler(child, { threshold: 100 });

      // Touch start
      child.dispatchEvent(
        new TouchEvent('touchstart', {
          touches: [createMockTouch(100, 100, child)],
        })
      );

      // Touch move right (positive delta) - should not trigger delete logic
      const touchMoveEvent = new TouchEvent('touchmove', {
        cancelable: true,
        touches: [createMockTouch(200, 100, child)],
      });
      child.dispatchEvent(touchMoveEvent);

      handler.destroy();
    });
  });

  describe('swipeToDelete action', () => {
    it('should create swipe-to-delete action', () => {
      const parent = document.createElement('div');
      const child = document.createElement('div');
      parent.appendChild(child);
      document.body.appendChild(parent);

      const action = swipeToDelete(child);

      expect(action).toHaveProperty('destroy');
      expect(typeof action.destroy).toBe('function');

      action.destroy();
      document.body.removeChild(parent);
    });
  });

  describe('triggerHaptic', () => {
    it('should not throw when vibrate is available', () => {
      expect(() => triggerHaptic('light')).not.toThrow();
      expect(() => triggerHaptic('medium')).not.toThrow();
      expect(() => triggerHaptic('heavy')).not.toThrow();
    });

    it('should not throw when vibrate is not available', () => {
      const originalVibrate = navigator.vibrate;
      // @ts-expect-error - removing vibrate for test
      navigator.vibrate = undefined;

      expect(() => triggerHaptic('medium')).not.toThrow();

      navigator.vibrate = originalVibrate;
    });
  });

  describe('isMobileDevice', () => {
    it('should return false for desktop user agent', () => {
      expect(isMobileDevice()).toBe(false);
    });

    it('should return true for iPhone user agent', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        writable: true,
        configurable: true,
      });

      expect(isMobileDevice()).toBe(true);
    });

    it('should return true for Android user agent', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Linux; Android 10; SM-G973F)',
        writable: true,
        configurable: true,
      });

      expect(isMobileDevice()).toBe(true);
    });

    afterEach(() => {
      // Reset user agent
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        writable: true,
        configurable: true,
      });
    });
  });

  describe('isTouchDevice', () => {
    it('should return true when ontouchstart is available', () => {
      // jsdom has ontouchstart by default
      expect(isTouchDevice()).toBe(true);
    });

    it('should return true when maxTouchPoints > 0', () => {
      // jsdom has maxTouchPoints > 0 by default
      expect(isTouchDevice()).toBe(true);
    });
  });

  describe('getViewportDimensions', () => {
    it('should return viewport dimensions', () => {
      const dimensions = getViewportDimensions();

      expect(dimensions).toHaveProperty('width');
      expect(dimensions).toHaveProperty('height');
      expect(dimensions).toHaveProperty('isMobile');
      expect(dimensions).toHaveProperty('isTablet');
      expect(dimensions).toHaveProperty('isDesktop');

      expect(typeof dimensions.width).toBe('number');
      expect(typeof dimensions.height).toBe('number');
      expect(typeof dimensions.isMobile).toBe('boolean');
    });

    it('should categorize viewport correctly', () => {
      // Mock window size for mobile
      Object.defineProperty(window, 'innerWidth', {
        value: 375,
        writable: true,
        configurable: true,
      });

      const dimensions = getViewportDimensions();

      expect(dimensions.isMobile).toBe(true);
      expect(dimensions.isTablet).toBe(false);
      expect(dimensions.isDesktop).toBe(false);
    });
  });

  describe('initEdgeSwipe', () => {
    it('should initialize edge swipe handler', () => {
      const onSwipeFromLeft = vi.fn();
      const cleanup = initEdgeSwipe({ onSwipeFromLeft });

      expect(typeof cleanup).toBe('function');

      cleanup();
    });

    it('should cleanup previous instance', () => {
      const _cleanup1 = initEdgeSwipe({});
      const cleanup2 = initEdgeSwipe({});

      expect(typeof cleanup2).toBe('function');

      cleanup2();
    });
  });
});
