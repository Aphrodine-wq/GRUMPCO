/**
 * Performance Monitoring Utility
 * 
 * Track and report performance metrics for the application
 */

interface PerformanceMetrics {
  // Navigation timing
  dnsLookup: number;
  tcpConnection: number;
  serverResponse: number;
  domProcessing: number;
  resourceLoading: number;
  totalLoadTime: number;

  // Custom metrics
  jsBundleSize?: number;
  cssBundleSize?: number;
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;
}

interface TimingEntry {
  name: string;
  startTime: number;
  duration: number;
}

class PerformanceMonitor {
  private metrics: Map<string, number> = new Map();
  private timings: TimingEntry[] = [];
  private isEnabled: boolean;

  constructor() {
    this.isEnabled = typeof window !== 'undefined' && 'performance' in window;
  }

  /**
   * Mark a timing point
   */
  mark(name: string): void {
    if (!this.isEnabled) return;

    performance.mark(name);
    this.metrics.set(name, performance.now());
  }

  /**
   * Measure duration between two marks
   */
  measure(name: string, startMark: string, endMark?: string): number | null {
    if (!this.isEnabled) return null;

    try {
      performance.measure(name, startMark, endMark);
      const entries = performance.getEntriesByName(name, 'measure');
      if (entries.length > 0) {
        const duration = entries[entries.length - 1].duration;
        this.timings.push({ name, startTime: performance.now() - duration, duration });
        return duration;
      }
    } catch (error) {
      console.warn(`[Performance] Failed to measure ${name}:`, error);
    }
    return null;
  }

  /**
   * Start timing an operation
   */
  startTimer(name: string): () => number {
    const startTime = performance.now();

    return () => {
      const duration = performance.now() - startTime;
      this.timings.push({ name, startTime, duration });
      return duration;
    };
  }

  /**
   * Get navigation timing metrics
   */
  getNavigationTiming(): PerformanceMetrics | null {
    if (!this.isEnabled || !performance.timing) return null;

    const timing = performance.timing;
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;

    return {
      dnsLookup: timing.domainLookupEnd - timing.domainLookupStart,
      tcpConnection: timing.connectEnd - timing.connectStart,
      serverResponse: timing.responseEnd - timing.requestStart,
      domProcessing: timing.domComplete - timing.domLoading,
      resourceLoading: timing.loadEventEnd - timing.domContentLoadedEventEnd,
      totalLoadTime: timing.loadEventEnd - timing.navigationStart,

      // Use newer Navigation Timing API v2 if available
      ...(navigation && {
        firstContentfulPaint: this.getFirstContentfulPaint(),
        largestContentfulPaint: this.getLargestContentfulPaint(),
      }),
    };
  }

  /**
   * Get First Contentful Paint timing
   */
  getFirstContentfulPaint(): number | undefined {
    if (!this.isEnabled) return undefined;

    const paintEntries = performance.getEntriesByType('paint');
    const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');
    return fcpEntry ? fcpEntry.startTime : undefined;
  }

  /**
   * Get Largest Contentful Paint timing
   */
  getLargestContentfulPaint(): number | undefined {
    if (!this.isEnabled) return undefined;

    // LCP is available via PerformanceObserver, but for simplicity we'll return undefined
    // In a real app, you'd set up a PerformanceObserver to track this
    return undefined;
  }

  /**
   * Get bundle sizes from Resource Timing API
   */
  getBundleSizes(): { js?: number; css?: number } {
    if (!this.isEnabled) return {};

    const resources = performance.getEntriesByType('resource');
    let jsSize = 0;
    let cssSize = 0;

    resources.forEach(resource => {
      const url = resource.name;
      const size = (resource as PerformanceResourceTiming).encodedBodySize || 0;

      if (url.endsWith('.js')) {
        jsSize += size;
      } else if (url.endsWith('.css')) {
        cssSize += size;
      }
    });

    return {
      js: jsSize > 0 ? jsSize : undefined,
      css: cssSize > 0 ? cssSize : undefined,
    };
  }

  /**
   * Log all collected metrics
   */
  logMetrics(): void {
    if (!this.isEnabled || !import.meta.env.DEV) return;

    const navigationTiming = this.getNavigationTiming();
    const bundleSizes = this.getBundleSizes();

    console.group('📊 Performance Metrics');

    if (navigationTiming) {
      console.log('Navigation Timing:', {
        'DNS Lookup': `${navigationTiming.dnsLookup}ms`,
        'TCP Connection': `${navigationTiming.tcpConnection}ms`,
        'Server Response': `${navigationTiming.serverResponse}ms`,
        'DOM Processing': `${navigationTiming.domProcessing}ms`,
        'Resource Loading': `${navigationTiming.resourceLoading}ms`,
        'Total Load Time': `${navigationTiming.totalLoadTime}ms`,
        ...(navigationTiming.firstContentfulPaint && {
          'First Contentful Paint': `${navigationTiming.firstContentfulPaint}ms`,
        }),
      });
    }

    if (bundleSizes.js || bundleSizes.css) {
      console.log('Bundle Sizes:', {
        ...(bundleSizes.js && { 'JavaScript': `${(bundleSizes.js / 1024).toFixed(2)}KB` }),
        ...(bundleSizes.css && { 'CSS': `${(bundleSizes.css / 1024).toFixed(2)}KB` }),
      });
    }

    if (this.timings.length > 0) {
      console.log('Custom Timings:', this.timings.map(t => ({
        name: t.name,
        duration: `${t.duration.toFixed(2)}ms`,
      })));
    }

    console.groupEnd();
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
    this.timings = [];
    if (this.isEnabled) {
      performance.clearMarks();
      performance.clearMeasures();
    }
  }

  /**
   * Observe long tasks (tasks that block the main thread for >50ms)
   */
  observeLongTasks(callback: (entries: PerformanceEntry[]) => void): void {
    if (!this.isEnabled || !('PerformanceObserver' in window)) return;

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        callback(entries);
      });

      observer.observe({ entryTypes: ['longtask'] });
    } catch (_error) {
      console.warn('[Performance] Long task observation not supported');
    }
  }

  /**
   * Get all raw timing entries
   */
  getAllTimings(): TimingEntry[] {
    return [...this.timings];
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Convenience exports
export const mark = (name: string) => performanceMonitor.mark(name);
export const measure = (name: string, startMark: string, endMark?: string) =>
  performanceMonitor.measure(name, startMark, endMark);
export const startTimer = (name: string) => performanceMonitor.startTimer(name);
export const logMetrics = () => performanceMonitor.logMetrics();
