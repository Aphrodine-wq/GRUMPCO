/**
 * UI Store Tests
 *
 * Comprehensive tests for UI state management stores
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
  currentView,
  showSettings,
  showAskDocs,
  showVoiceCode,
  showDesignToCode,
  showCostDashboard,
  sidebarOpen,
  showIntegrations,
  showApprovals,

  showMemory,
  showAuditLog,
  showDocker,
  showCloudDashboard,
  sidebarCollapsed,
  focusChatTrigger,
  setCurrentView,
} from './uiStore';

describe('uiStore', () => {
  beforeEach(() => {
    currentView.set('chat');
    showSettings.set(false);
    showAskDocs.set(false);
    showVoiceCode.set(false);
    showDesignToCode.set(false);
    showCostDashboard.set(false);
    sidebarOpen.set(true);
    showIntegrations.set(false);
    showApprovals.set(false);

    showMemory.set(false);
    showAuditLog.set(false);
    showDocker.set(false);
    showCloudDashboard.set(false);
    sidebarCollapsed.set(false);
    focusChatTrigger.set(0);
  });

  describe('showSettings', () => {
    it('should default to false', () => {
      expect(get(showSettings)).toBe(false);
    });

    it('should toggle settings visibility', () => {
      showSettings.set(true);
      expect(get(showSettings)).toBe(true);
      showSettings.set(false);
      expect(get(showSettings)).toBe(false);
    });
  });

  describe('showAskDocs', () => {
    it('should default to false', () => {
      expect(get(showAskDocs)).toBe(false);
    });

    it('should toggle ask docs visibility', () => {
      showAskDocs.set(true);
      expect(get(showAskDocs)).toBe(true);
    });
  });

  describe('showVoiceCode', () => {
    it('should default to false', () => {
      expect(get(showVoiceCode)).toBe(false);
    });

    it('should toggle voice code screen', () => {
      showVoiceCode.set(true);
      expect(get(showVoiceCode)).toBe(true);
    });
  });



  describe('showDesignToCode', () => {
    it('should default to false', () => {
      expect(get(showDesignToCode)).toBe(false);
    });

    it('should toggle design to code screen', () => {
      showDesignToCode.set(true);
      expect(get(showDesignToCode)).toBe(true);
    });
  });

  describe('showCostDashboard', () => {
    it('should default to false', () => {
      expect(get(showCostDashboard)).toBe(false);
    });

    it('should toggle cost dashboard', () => {
      showCostDashboard.set(true);
      expect(get(showCostDashboard)).toBe(true);
    });
  });

  describe('sidebarOpen', () => {
    it('should default to true', () => {
      expect(get(sidebarOpen)).toBe(true);
    });

    it('should toggle sidebar open state', () => {
      sidebarOpen.set(false);
      expect(get(sidebarOpen)).toBe(false);
      sidebarOpen.set(true);
      expect(get(sidebarOpen)).toBe(true);
    });
  });

  describe('showIntegrations', () => {
    it('should default to false', () => {
      expect(get(showIntegrations)).toBe(false);
    });

    it('should toggle integrations hub', () => {
      showIntegrations.set(true);
      expect(get(showIntegrations)).toBe(true);
    });
  });

  describe('showApprovals', () => {
    it('should default to false', () => {
      expect(get(showApprovals)).toBe(false);
    });

    it('should toggle approvals center', () => {
      showApprovals.set(true);
      expect(get(showApprovals)).toBe(true);
    });
  });



  describe('showMemory', () => {
    it('should default to false', () => {
      expect(get(showMemory)).toBe(false);
    });

    it('should toggle memory manager', () => {
      showMemory.set(true);
      expect(get(showMemory)).toBe(true);
    });
  });

  describe('showAuditLog', () => {
    it('should default to false', () => {
      expect(get(showAuditLog)).toBe(false);
    });

    it('should toggle audit log viewer', () => {
      showAuditLog.set(true);
      expect(get(showAuditLog)).toBe(true);
    });
  });



  describe('showDocker', () => {
    it('should default to false', () => {
      expect(get(showDocker)).toBe(false);
    });

    it('should toggle docker panel', () => {
      showDocker.set(true);
      expect(get(showDocker)).toBe(true);
    });
  });

  describe('showCloudDashboard', () => {
    it('should default to false', () => {
      expect(get(showCloudDashboard)).toBe(false);
    });

    it('should toggle cloud dashboard', () => {
      showCloudDashboard.set(true);
      expect(get(showCloudDashboard)).toBe(true);
    });
  });

  describe('sidebarCollapsed', () => {
    it('should default to false', () => {
      expect(get(sidebarCollapsed)).toBe(false);
    });

    it('should toggle sidebar collapsed state', () => {
      sidebarCollapsed.set(true);
      expect(get(sidebarCollapsed)).toBe(true);
    });
  });

  describe('focusChatTrigger', () => {
    it('should default to 0', () => {
      expect(get(focusChatTrigger)).toBe(0);
    });

    it('should increment to trigger focus', () => {
      focusChatTrigger.update((n) => n + 1);
      expect(get(focusChatTrigger)).toBe(1);
      focusChatTrigger.update((n) => n + 1);
      expect(get(focusChatTrigger)).toBe(2);
    });
  });

  describe('currentView (single active view)', () => {
    it('should have only one view active at a time', () => {
      showSettings.set(true);
      expect(get(showSettings)).toBe(true);
      expect(get(currentView)).toBe('settings');

      showCostDashboard.set(true);
      expect(get(showCostDashboard)).toBe(true);
      expect(get(showSettings)).toBe(false);
      expect(get(currentView)).toBe('cost');

      showIntegrations.set(true);
      expect(get(showIntegrations)).toBe(true);
      expect(get(showCostDashboard)).toBe(false);
      expect(get(currentView)).toBe('integrations');
    });

    it('should close a view by setting it false and return to chat', () => {
      showSettings.set(true);
      expect(get(currentView)).toBe('settings');
      showSettings.set(false);
      expect(get(showSettings)).toBe(false);
      expect(get(currentView)).toBe('chat');

      showCostDashboard.set(true);
      showSettings.set(false); // no-op when current view is cost
      expect(get(showCostDashboard)).toBe(true);
      expect(get(currentView)).toBe('cost');
    });
  });

  describe('setCurrentView', () => {
    it('should set current view directly', () => {
      setCurrentView('settings');
      expect(get(currentView)).toBe('settings');
      expect(get(showSettings)).toBe(true);
    });

    it('should return to chat view', () => {
      setCurrentView('settings');
      setCurrentView('chat');
      expect(get(currentView)).toBe('chat');
      expect(get(showSettings)).toBe(false);
    });
  });

  describe('view store update method', () => {
    it('should update via callback returning true', () => {
      showSettings.update(() => true);
      expect(get(showSettings)).toBe(true);
      expect(get(currentView)).toBe('settings');
    });

    it('should update via callback returning false when view is active', () => {
      showSettings.set(true);
      expect(get(currentView)).toBe('settings');

      showSettings.update(() => false);
      expect(get(showSettings)).toBe(false);
      expect(get(currentView)).toBe('chat');
    });

    it('should not change view when callback returns false on inactive view', () => {
      showCostDashboard.set(true);
      expect(get(currentView)).toBe('cost');

      showSettings.update(() => false);
      expect(get(currentView)).toBe('cost');
      expect(get(showSettings)).toBe(false);
    });

    it('should handle update with current value', () => {
      showSettings.update((current) => !current);
      expect(get(showSettings)).toBe(true);

      showSettings.update((current) => !current);
      expect(get(showSettings)).toBe(false);
    });
  });
});
