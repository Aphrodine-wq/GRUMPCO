/**
 * Comprehensive Analytics & Tracking Module for G-Rump
 * Supports Google Analytics 4, custom events, performance monitoring, and error tracking
 * Privacy-compliant with GDPR/CCPA support
 */

import { writable, derived } from 'svelte/store'

// Configuration interface
interface AnalyticsConfig {
  ga4MeasurementId: string | null
  debugMode: boolean
  anonymizeIp: boolean
  cookieConsentRequired: boolean
  retentionMonths: number
}

// Default configuration
const defaultConfig: AnalyticsConfig = {
  ga4MeasurementId: import.meta.env.VITE_GA4_MEASUREMENT_ID || null,
  debugMode: import.meta.env.DEV || false,
  anonymizeIp: true,
  cookieConsentRequired: true,
  retentionMonths: 14, // GA4 default
}

// Privacy consent store
interface ConsentState {
  analytics: boolean
  marketing: boolean
  functional: boolean
  timestamp: number | null
  version: string
}

const CONSENT_VERSION = '1.0'

function createConsentStore() {
  const stored = typeof window !== 'undefined' 
    ? localStorage.getItem('grump-consent') 
    : null
  
  const initial: ConsentState = stored 
    ? JSON.parse(stored) 
    : {
        analytics: false,
        marketing: false,
        functional: true,
        timestamp: null,
        version: CONSENT_VERSION
      }

  const { subscribe, set, update } = writable<ConsentState>(initial)

  return {
    subscribe,
    grantConsent: (types: { analytics?: boolean; marketing?: boolean; functional?: boolean }) => {
      update(s => {
        const next = {
          ...s,
          ...types,
          timestamp: Date.now(),
          version: CONSENT_VERSION
        }
        localStorage.setItem('grump-consent', JSON.stringify(next))
        return next
      })
    },
    revokeConsent: () => {
      update(() => {
        const next: ConsentState = {
          analytics: false,
          marketing: false,
          functional: true,
          timestamp: Date.now(),
          version: CONSENT_VERSION
        }
        localStorage.setItem('grump-consent', JSON.stringify(next))
        return next
      })
    },
    reset: () => {
      localStorage.removeItem('grump-consent')
      set({
        analytics: false,
        marketing: false,
        functional: true,
        timestamp: null,
        version: CONSENT_VERSION
      })
    }
  }
}

export const consentStore = createConsentStore()
export const hasAnalyticsConsent = derived(consentStore, $c => $c.analytics)

// User session tracking
interface UserSession {
  sessionId: string
  userId: string | null
  startTime: number
  lastActivity: number
  pageViews: number
  events: number
}

function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

class AnalyticsService {
  private config: AnalyticsConfig
  private session: UserSession | null = null
  private consent: ConsentState | null = null
  private performanceMetrics: Map<string, number> = new Map()
  private errorQueue: Array<{ error: Error; context: any; timestamp: number }> = []
  private flushInterval: number | null = null

  constructor(config: Partial<AnalyticsConfig> = {}) {
    this.config = { ...defaultConfig, ...config }
    
    if (typeof window !== 'undefined') {
      this.initSession()
      this.initErrorTracking()
      this.initPerformanceObserver()
      this.startFlushInterval()
    }
  }

  // Initialize user session
  private initSession() {
    this.session = {
      sessionId: generateSessionId(),
      userId: null,
      startTime: Date.now(),
      lastActivity: Date.now(),
      pageViews: 0,
      events: 0
    }

    // Track initial page view
    this.trackPageView(window.location.pathname + window.location.hash)
  }

  // Set user ID (call after login)
  setUserId(userId: string) {
    if (this.session) {
      this.session.userId = userId
    }
    
    if (this.consent?.analytics && window.gtag) {
      window.gtag('config', this.config.ga4MeasurementId, {
        user_id: userId
      })
    }
  }

  // Clear user ID (call on logout)
  clearUserId() {
    if (this.session) {
      this.session.userId = null
    }
    
    if (window.gtag) {
      window.gtag('config', this.config.ga4MeasurementId, {
        user_id: undefined
      })
    }
  }

  // Track page views
  trackPageView(path: string, title?: string) {
    if (!this.consent?.analytics) {
      this.queueEvent('page_view', { path, title })
      return
    }

    this.session!.pageViews++
    this.session!.lastActivity = Date.now()

    // GA4 page view
    if (window.gtag && this.config.ga4MeasurementId) {
      window.gtag('event', 'page_view', {
        page_path: path,
        page_title: title || document.title,
        page_location: window.location.href,
        session_id: this.session!.sessionId
      })
    }

    // Custom tracking for SPA navigation
    this.trackEvent('navigation', 'page_view', path, undefined, {
      session_duration: Date.now() - this.session!.startTime,
      page_views: this.session!.pageViews
    })

    if (this.config.debugMode) {
      console.log('[Analytics] Page view:', path)
    }
  }

  // Track custom events
  trackEvent(
    category: string,
    action: string,
    label?: string,
    value?: number,
    customParams?: Record<string, any>
  ) {
    if (!this.consent?.analytics) {
      this.queueEvent('custom', { category, action, label, value, customParams })
      return
    }

    this.session!.events++

    const eventName = `${category}_${action}`.toLowerCase().replace(/\s+/g, '_')
    
    // GA4 event
    if (window.gtag && this.config.ga4MeasurementId) {
      const eventParams: Record<string, any> = {
        event_category: category,
        event_action: action,
        event_label: label,
        session_id: this.session!.sessionId,
        ...customParams
      }
      if (value !== undefined) {
        eventParams.value = value
      }
      window.gtag('event', eventName, eventParams)
    }

    // Send to custom endpoint if configured
    this.sendToApi('/api/analytics/events', {
      type: 'event',
      category,
      action,
      label,
      value,
      customParams,
      sessionId: this.session!.sessionId,
      timestamp: Date.now()
    })

    if (this.config.debugMode) {
      console.log('[Analytics] Event:', { category, action, label, value })
    }
  }

  // Track user interactions
  trackInteraction(element: string, action: string, metadata?: Record<string, any>) {
    this.trackEvent('interaction', action, element, undefined, metadata)
  }

  // Track form submissions
  trackFormSubmit(formName: string, success: boolean, metadata?: Record<string, any>) {
    this.trackEvent('form', 'submit', formName, success ? 1 : 0, {
      success,
      ...metadata
    })
  }

  // Track conversion events
  trackConversion(conversionName: string, value?: number, currency: string = 'USD') {
    if (!this.consent?.analytics) return

    if (window.gtag && this.config.ga4MeasurementId) {
      window.gtag('event', 'conversion', {
        send_to: this.config.ga4MeasurementId,
        value: value || 0,
        currency,
        transaction_id: `${this.session!.sessionId}-${Date.now()}`,
        conversion_name: conversionName
      })
    }

    this.trackEvent('conversion', conversionName, undefined, value)
  }

  // Track errors
  trackError(error: Error, context?: Record<string, any>) {
    const errorData = {
      type: error.name,
      message: error.message,
      stack: error.stack,
      context: {
        ...context,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: Date.now()
      },
      sessionId: this.session?.sessionId
    }

    // Send to error tracking endpoint
    this.sendToApi('/api/analytics/errors', errorData)

    // GA4 exception tracking
    if (window.gtag && this.consent?.analytics) {
      window.gtag('event', 'exception', {
        description: `${error.name}: ${error.message}`,
        fatal: false
      })
    }

    if (this.config.debugMode) {
      console.error('[Analytics] Error tracked:', errorData)
    }
  }

  // Performance tracking
  trackPerformance(metricName: string, value: number, rating?: 'good' | 'needs-improvement' | 'poor') {
    this.performanceMetrics.set(metricName, value)

    if (!this.consent?.analytics) return

    // GA4 custom timing
    if (window.gtag) {
      window.gtag('event', 'timing_complete', {
        name: metricName,
        value: Math.round(value)
      })
    }

    this.sendToApi('/api/analytics/performance', {
      metric: metricName,
      value,
      rating,
      sessionId: this.session?.sessionId,
      timestamp: Date.now()
    })

    if (this.config.debugMode) {
      console.log('[Analytics] Performance:', { metricName, value, rating })
    }
  }

  // Initialize performance observer
  private initPerformanceObserver() {
    if (!window.PerformanceObserver) return

    // Core Web Vitals
    const vitalsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const value = entry.startTime
        let rating: 'good' | 'needs-improvement' | 'poor' = 'good'

        // Core Web Vitals thresholds
        if (entry.entryType === 'web-vital') {
          if (entry.name === 'LCP') {
            rating = value < 2500 ? 'good' : value < 4000 ? 'needs-improvement' : 'poor'
          } else if (entry.name === 'FID') {
            rating = value < 100 ? 'good' : value < 300 ? 'needs-improvement' : 'poor'
          } else if (entry.name === 'CLS') {
            rating = (entry as any).value < 0.1 ? 'good' : (entry as any).value < 0.25 ? 'needs-improvement' : 'poor'
          }
        }

        this.trackPerformance(entry.name, value, rating)
      }
    })

    try {
      vitalsObserver.observe({ entryTypes: ['web-vital', 'navigation', 'resource', 'measure'] })
    } catch {
      // Fallback for older browsers
    }

    // Navigation timing
    window.addEventListener('load', () => {
      setTimeout(() => {
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
        if (nav) {
          this.trackPerformance('TTFB', nav.responseStart - nav.startTime)
          this.trackPerformance('FCP', nav.domContentLoadedEventStart - nav.startTime)
          this.trackPerformance('DOM_Load', nav.loadEventStart - nav.startTime)
        }
      }, 0)
    })
  }

  // Error tracking setup
  private initErrorTracking() {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.trackError(event.error, {
        type: 'global',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      })
    })

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason instanceof Error 
        ? event.reason 
        : new Error(String(event.reason))
      this.trackError(error, { type: 'unhandled_promise' })
    })
  }

  // Queue events when consent not granted
  private queueEvent(type: string, data: any) {
    if (this.errorQueue.length < 100) {
      this.errorQueue.push({ error: new Error(`Queued ${type}`), context: data, timestamp: Date.now() })
    }
  }

  // Flush queued events when consent granted
  flushQueuedEvents() {
    if (!this.consent?.analytics || this.errorQueue.length === 0) return
    
    this.errorQueue.forEach(({ context }) => {
      if (context.path) {
        this.trackPageView(context.path, context.title)
      } else if (context.category) {
        this.trackEvent(context.category, context.action, context.label, context.value, context.customParams)
      }
    })
    this.errorQueue = []
  }

  // Start periodic flush interval
  private startFlushInterval() {
    this.flushInterval = window.setInterval(() => {
      if (this.session && Date.now() - this.session.lastActivity > 30 * 60 * 1000) {
        // Session expired after 30 minutes of inactivity
        this.endSession()
        this.initSession()
      }
    }, 60000) // Check every minute
  }

  // End session tracking
  private endSession() {
    if (!this.session) return

    const duration = Date.now() - this.session.startTime
    
    this.sendToApi('/api/analytics/session', {
      sessionId: this.session.sessionId,
      duration,
      pageViews: this.session.pageViews,
      events: this.session.events,
      endTime: Date.now()
    })
  }

  // Send data to API
  private async sendToApi(endpoint: string, data: any) {
    try {
      const base = import.meta.env.VITE_API_URL || ''
      const url = base ? `${base.replace(/\/$/, '')}${endpoint}` : endpoint
      
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        keepalive: true
      })
    } catch (err) {
      if (this.config.debugMode) {
        console.error('[Analytics] Failed to send:', err)
      }
    }
  }

  // Update consent
  updateConsent(consent: ConsentState) {
    this.consent = consent
    
    if (consent.analytics) {
      this.flushQueuedEvents()
    }
  }

  // Destroy/cleanup
  destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
    }
    this.endSession()
  }
}

// Create singleton instance
export const analytics = new AnalyticsService()

// Declare gtag for TypeScript
declare global {
  interface Window {
    gtag: (...args: any[]) => void
    dataLayer: any[]
  }
}

// Helper functions for common tracking patterns
export function trackAuthEvent(action: 'login' | 'register' | 'logout' | 'login_failed' | 'register_failed', metadata?: any) {
  analytics.trackEvent('authentication', action, undefined, undefined, metadata)
  
  if (action === 'login' || action === 'register') {
    analytics.trackConversion(`auth_${action}`, 1)
  }
}

export function trackWorkspaceEvent(action: 'open' | 'design_mode' | 'code_mode' | 'generate', metadata?: any) {
  analytics.trackEvent('workspace', action, undefined, undefined, metadata)
}

export function trackSettingsEvent(action: 'save_models' | 'save_accessibility' | 'view', metadata?: any) {
  analytics.trackEvent('settings', action, undefined, undefined, metadata)
}

export function trackBillingEvent(action: 'view' | 'upgrade' | 'downgrade' | 'purchase_click' | 'autotopup_click' | 'credit_purchase' | 'purchase_success' | 'purchase_error' | 'autotopup_toggle', tier?: string) {
  analytics.trackEvent('billing', action, tier)
  
  if (action === 'upgrade' || action === 'credit_purchase' || action === 'purchase_success') {
    analytics.trackConversion('subscription_upgrade')
  }
}

export function trackNavigation(from: string, to: string) {
  analytics.trackEvent('navigation', 'route_change', `${from} -> ${to}`)
}
