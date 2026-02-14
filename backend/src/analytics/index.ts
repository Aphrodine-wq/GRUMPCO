/**
 * Analytics Service Exports
 *
 * Centralized exports for all analytics-related modules
 */

export { analytics, AnalyticsService } from '../services/platform/analytics.js';
export type {
  AnalyticsEvent,
  AnalyticsEventName,
  AnalyticsUser,
} from '../services/platform/analytics.js';
export { analyticsMiddleware, identifyMiddleware } from '../middleware/analytics.js';
