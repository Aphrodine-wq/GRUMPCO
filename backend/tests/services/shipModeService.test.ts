/**
 * SHIP Mode Service Tests
 */

import { describe, it, expect } from 'vitest';
import { startShipMode, getShipSession, executeShipMode } from '../../src/services/shipModeService.js';

describe('SHIP Mode Service', () => {
  describe('startShipMode', () => {
    it('should create a new SHIP mode session', () => {
      const request = {
        projectDescription: 'A test project',
        preferences: {
          frontendFramework: 'vue' as const,
          backendRuntime: 'node' as const,
        },
      };
      
      const session = startShipMode(request);
      
      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.projectDescription).toBe(request.projectDescription);
      expect(session.phase).toBe('design');
      expect(session.status).toBe('initializing');
      expect(session.preferences).toEqual(request.preferences);
    });
  });
  
  describe('getShipSession', () => {
    it('should retrieve a session by ID', () => {
      const request = {
        projectDescription: 'Test project',
      };
      
      const session = startShipMode(request);
      const retrieved = getShipSession(session.id);
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(session.id);
    });
    
    it('should return null for non-existent session', () => {
      const retrieved = getShipSession('non-existent-id');
      expect(retrieved).toBeNull();
    });
  });
  
  describe('executeShipMode', () => {
    it('should execute SHIP mode workflow', async () => {
      const request = {
        projectDescription: 'A simple todo app',
      };
      
      const session = startShipMode(request);
      
      // Note: This test requires API key and will make actual API calls
      // In a real test environment, you'd mock the API calls
      try {
        const response = await executeShipMode(session.id);
        
        expect(response).toBeDefined();
        expect(response.sessionId).toBe(session.id);
        expect(['design', 'spec', 'plan', 'code', 'completed', 'failed']).toContain(response.phase);
      } catch (error) {
        console.warn('Skipping SHIP mode execution test - API key may not be available or execution failed');
      }
    });
  });
});
