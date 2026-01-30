/**
 * Web App Store Tests
 * 
 * Comprehensive tests for authStore and appStore
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { authStore, isAuthenticated } from './authStore';
import { appStore } from './appStore';
import type { User } from '@supabase/supabase-js';

describe('authStore', () => {
  beforeEach(() => {
    authStore.reset();
  });

  describe('initial state', () => {
    it('should have null user initially', () => {
      const state = get(authStore);
      expect(state.user).toBeNull();
    });

    it('should have loading true initially', () => {
      const state = get(authStore);
      expect(state.loading).toBe(true);
    });

    it('should have null error initially', () => {
      const state = get(authStore);
      expect(state.error).toBeNull();
    });
  });

  describe('setUser', () => {
    it('should set user', () => {
      const mockUser = { id: '123', email: 'test@example.com' } as User;
      
      authStore.setUser(mockUser);
      
      const state = get(authStore);
      expect(state.user).toEqual(mockUser);
    });

    it('should set loading to false', () => {
      authStore.setUser({ id: '123' } as User);
      
      expect(get(authStore).loading).toBe(false);
    });

    it('should clear error', () => {
      authStore.setError('Previous error');
      authStore.setUser({ id: '123' } as User);
      
      expect(get(authStore).error).toBeNull();
    });

    it('should handle null user', () => {
      authStore.setUser({ id: '123' } as User);
      authStore.setUser(null);
      
      expect(get(authStore).user).toBeNull();
    });
  });

  describe('setLoading', () => {
    it('should set loading state', () => {
      authStore.setLoading(false);
      expect(get(authStore).loading).toBe(false);
      
      authStore.setLoading(true);
      expect(get(authStore).loading).toBe(true);
    });
  });

  describe('setError', () => {
    it('should set error message', () => {
      authStore.setError('Authentication failed');
      
      expect(get(authStore).error).toBe('Authentication failed');
    });

    it('should allow clearing error', () => {
      authStore.setError('Some error');
      authStore.setError(null);
      
      expect(get(authStore).error).toBeNull();
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      authStore.setUser({ id: '123' } as User);
      authStore.setError('error');
      
      authStore.reset();
      
      const state = get(authStore);
      expect(state.user).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('isAuthenticated derived store', () => {
    it('should be false when no user', () => {
      expect(get(isAuthenticated)).toBe(false);
    });

    it('should be true when user exists', () => {
      authStore.setUser({ id: '123' } as User);
      
      expect(get(isAuthenticated)).toBe(true);
    });

    it('should update when user changes', () => {
      expect(get(isAuthenticated)).toBe(false);
      
      authStore.setUser({ id: '123' } as User);
      expect(get(isAuthenticated)).toBe(true);
      
      authStore.setUser(null);
      expect(get(isAuthenticated)).toBe(false);
    });
  });
});

describe('appStore', () => {
  beforeEach(() => {
    // Reset to defaults by setting each property
    appStore.setView('dashboard');
    appStore.setMobileMenuOpen(false);
    // Toggle sidebar to known state
    const state = get(appStore);
    if (!state.sidebarOpen) {
      appStore.toggleSidebar();
    }
  });

  describe('initial state', () => {
    it('should have sidebarOpen true', () => {
      expect(get(appStore).sidebarOpen).toBe(true);
    });

    it('should have dashboard as default view', () => {
      expect(get(appStore).currentView).toBe('dashboard');
    });

    it('should have mobileMenuOpen false', () => {
      expect(get(appStore).mobileMenuOpen).toBe(false);
    });
  });

  describe('toggleSidebar', () => {
    it('should toggle sidebar state', () => {
      expect(get(appStore).sidebarOpen).toBe(true);
      
      appStore.toggleSidebar();
      expect(get(appStore).sidebarOpen).toBe(false);
      
      appStore.toggleSidebar();
      expect(get(appStore).sidebarOpen).toBe(true);
    });
  });

  describe('setView', () => {
    it('should set dashboard view', () => {
      appStore.setView('dashboard');
      expect(get(appStore).currentView).toBe('dashboard');
    });

    it('should set workspace view', () => {
      appStore.setView('workspace');
      expect(get(appStore).currentView).toBe('workspace');
    });

    it('should set settings view', () => {
      appStore.setView('settings');
      expect(get(appStore).currentView).toBe('settings');
    });

    it('should set billing view', () => {
      appStore.setView('billing');
      expect(get(appStore).currentView).toBe('billing');
    });
  });

  describe('toggleMobileMenu', () => {
    it('should toggle mobile menu', () => {
      expect(get(appStore).mobileMenuOpen).toBe(false);
      
      appStore.toggleMobileMenu();
      expect(get(appStore).mobileMenuOpen).toBe(true);
      
      appStore.toggleMobileMenu();
      expect(get(appStore).mobileMenuOpen).toBe(false);
    });
  });

  describe('setMobileMenuOpen', () => {
    it('should set mobile menu open state', () => {
      appStore.setMobileMenuOpen(true);
      expect(get(appStore).mobileMenuOpen).toBe(true);
      
      appStore.setMobileMenuOpen(false);
      expect(get(appStore).mobileMenuOpen).toBe(false);
    });
  });
});
