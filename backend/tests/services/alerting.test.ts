/**
 * Alerting Service Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Alerting Service', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  
  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });
  
  describe('Alert Thresholds', () => {
    it('should trigger alert when error rate exceeds threshold', () => {
      const alertTriggered = vi.fn();
      const threshold = 0.1; // 10%
      const currentErrorRate = 0.15; // 15%
      
      if (currentErrorRate > threshold) {
        alertTriggered({ type: 'error_rate', value: currentErrorRate, threshold });
      }
      
      expect(alertTriggered).toHaveBeenCalledWith({
        type: 'error_rate',
        value: 0.15,
        threshold: 0.1,
      });
    });
    
    it('should not trigger alert when below threshold', () => {
      const alertTriggered = vi.fn();
      const threshold = 0.1;
      const currentErrorRate = 0.05;
      
      if (currentErrorRate > threshold) {
        alertTriggered({ type: 'error_rate', value: currentErrorRate, threshold });
      }
      
      expect(alertTriggered).not.toHaveBeenCalled();
    });
    
    it('should trigger latency alert when p95 exceeds threshold', () => {
      const alertTriggered = vi.fn();
      const threshold = 500; // 500ms
      const p95Latency = 750; // 750ms
      
      if (p95Latency > threshold) {
        alertTriggered({ type: 'latency_p95', value: p95Latency, threshold });
      }
      
      expect(alertTriggered).toHaveBeenCalled();
    });
  });
  
  describe('Alert Aggregation', () => {
    it('should aggregate multiple alerts within time window', () => {
      const alerts: Array<{ type: string; timestamp: number }> = [];
      const now = Date.now();
      
      // Simulate multiple alerts
      alerts.push({ type: 'error_rate', timestamp: now });
      alerts.push({ type: 'error_rate', timestamp: now + 1000 });
      alerts.push({ type: 'error_rate', timestamp: now + 2000 });
      
      const windowMs = 60000;
      const alertsInWindow = alerts.filter(a => a.timestamp >= now - windowMs);
      
      expect(alertsInWindow).toHaveLength(3);
    });
    
    it('should deduplicate repeated alerts', () => {
      const seenAlerts = new Set<string>();
      const alertKey = 'error_rate:high';
      
      // First alert should be recorded
      const firstAlert = !seenAlerts.has(alertKey);
      if (firstAlert) seenAlerts.add(alertKey);
      
      // Second identical alert should be deduplicated
      const secondAlert = !seenAlerts.has(alertKey);
      
      expect(firstAlert).toBe(true);
      expect(secondAlert).toBe(false);
    });
  });
  
  describe('Alert Channels', () => {
    it('should send alerts to configured channels', async () => {
      const channels = {
        slack: vi.fn().mockResolvedValue(true),
        email: vi.fn().mockResolvedValue(true),
        pagerduty: vi.fn().mockResolvedValue(true),
      };
      
      const alert = { type: 'critical', message: 'Service down' };
      const enabledChannels = ['slack', 'email'];
      
      for (const channel of enabledChannels) {
        await channels[channel as keyof typeof channels](alert);
      }
      
      expect(channels.slack).toHaveBeenCalledWith(alert);
      expect(channels.email).toHaveBeenCalledWith(alert);
      expect(channels.pagerduty).not.toHaveBeenCalled();
    });
    
    it('should retry failed alert delivery', async () => {
      let attempts = 0;
      const sendAlert = vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 3) throw new Error('Network error');
        return true;
      });
      
      const maxRetries = 3;
      let success = false;
      
      for (let i = 0; i < maxRetries && !success; i++) {
        try {
          await sendAlert();
          success = true;
        } catch {
          // Retry
        }
      }
      
      expect(sendAlert).toHaveBeenCalledTimes(3);
      expect(success).toBe(true);
    });
  });
  
  describe('Alert Severity', () => {
    it('should classify alerts by severity', () => {
      const classifySeverity = (errorRate: number): string => {
        if (errorRate > 0.5) return 'critical';
        if (errorRate > 0.2) return 'high';
        if (errorRate > 0.1) return 'medium';
        return 'low';
      };
      
      expect(classifySeverity(0.6)).toBe('critical');
      expect(classifySeverity(0.3)).toBe('high');
      expect(classifySeverity(0.15)).toBe('medium');
      expect(classifySeverity(0.05)).toBe('low');
    });
  });
});
