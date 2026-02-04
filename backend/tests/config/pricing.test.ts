/**
 * Pricing Configuration Tests
 * Tests for backend/src/config/pricing.ts
 */

import { describe, it, expect } from 'vitest';
import {
  TIERS,
  CREDITS_PER_OPERATION,
  getTier,
  hasPremiumFeature,
  getSwarmLimit,
  getConcurrentAgentLimit,
  getHeartbeatLimit,
  type TierId,
  type Tier,
  type PremiumFeature,
} from '../../src/config/pricing.js';

describe('Pricing Configuration', () => {
  describe('CREDITS_PER_OPERATION', () => {
    it('should define credits for chat operation', () => {
      expect(CREDITS_PER_OPERATION.chat).toBe(1);
    });

    it('should define credits for architecture operation', () => {
      expect(CREDITS_PER_OPERATION.architecture).toBe(2);
    });

    it('should define credits for intent operation', () => {
      expect(CREDITS_PER_OPERATION.intent).toBe(1);
    });

    it('should define credits for prd operation', () => {
      expect(CREDITS_PER_OPERATION.prd).toBe(3);
    });

    it('should define credits for plan operation', () => {
      expect(CREDITS_PER_OPERATION.plan).toBe(2);
    });

    it('should define credits for ship operation', () => {
      expect(CREDITS_PER_OPERATION.ship).toBe(10);
    });

    it('should define credits for codegen operation', () => {
      expect(CREDITS_PER_OPERATION.codegen).toBe(20);
    });

    it('should define credits for swarm_run operation', () => {
      expect(CREDITS_PER_OPERATION.swarm_run).toBe(15);
    });
  });

  describe('TIERS', () => {
    describe('free tier', () => {
      it('should have correct id and name', () => {
        expect(TIERS.free.id).toBe('free');
        expect(TIERS.free.name).toBe('Free');
      });

      it('should have zero monthly price', () => {
        expect(TIERS.free.priceMonthlyCents).toBe(0);
      });

      it('should have 100 credits per month', () => {
        expect(TIERS.free.creditsPerMonth).toBe(100);
        expect(TIERS.free.apiCallsPerMonth).toBe(100);
      });

      it('should have 1 seat and 1 GB storage', () => {
        expect(TIERS.free.seats).toBe(1);
        expect(TIERS.free.includedStorageGb).toBe(1);
      });

      it('should have limited swarm agents', () => {
        expect(TIERS.free.maxSwarmAgents).toBe(3);
      });

      it('should have 1 concurrent agent', () => {
        expect(TIERS.free.maxConcurrentAgents).toBe(1);
      });

      it('should have 3 max heartbeats', () => {
        expect(TIERS.free.maxHeartbeats).toBe(3);
      });

      it('should have no premium features', () => {
        expect(TIERS.free.premiumFeatures).toEqual([]);
      });

      it('should have features list', () => {
        expect(Array.isArray(TIERS.free.features)).toBe(true);
        expect(TIERS.free.features.length).toBeGreaterThan(0);
      });
    });

    describe('pro tier', () => {
      it('should have correct id and name', () => {
        expect(TIERS.pro.id).toBe('pro');
        expect(TIERS.pro.name).toBe('Pro');
      });

      it('should have $49/month price', () => {
        expect(TIERS.pro.priceMonthlyCents).toBe(4900);
      });

      it('should have yearly price option', () => {
        expect(TIERS.pro.priceYearlyCents).toBe(49000);
      });

      it('should have 1000 credits per month', () => {
        expect(TIERS.pro.creditsPerMonth).toBe(1_000);
      });

      it('should include storage and seat limits', () => {
        expect(TIERS.pro.seats).toBe(1);
        expect(TIERS.pro.includedStorageGb).toBe(10);
      });

      it('should have 5 max swarm agents', () => {
        expect(TIERS.pro.maxSwarmAgents).toBe(5);
      });

      it('should have 3 concurrent agents', () => {
        expect(TIERS.pro.maxConcurrentAgents).toBe(3);
      });

      it('should have 10 max heartbeats', () => {
        expect(TIERS.pro.maxHeartbeats).toBe(10);
      });

      it('should include cloud_tools premium feature', () => {
        expect(TIERS.pro.premiumFeatures).toContain('cloud_tools');
      });

      it('should include cicd_tools premium feature', () => {
        expect(TIERS.pro.premiumFeatures).toContain('cicd_tools');
      });

      it('should include priority_routing premium feature', () => {
        expect(TIERS.pro.premiumFeatures).toContain('priority_routing');
      });
    });

    describe('team tier', () => {
      it('should have correct id and name', () => {
        expect(TIERS.team.id).toBe('team');
        expect(TIERS.team.name).toBe('Team');
      });

      it('should have $149/month price', () => {
        expect(TIERS.team.priceMonthlyCents).toBe(14900);
      });

      it('should have yearly price option', () => {
        expect(TIERS.team.priceYearlyCents).toBe(149000);
      });

      it('should have 5000 credits per month', () => {
        expect(TIERS.team.creditsPerMonth).toBe(5_000);
      });

      it('should include storage and seat limits', () => {
        expect(TIERS.team.seats).toBe(5);
        expect(TIERS.team.includedStorageGb).toBe(50);
      });

      it('should have 10 max swarm agents', () => {
        expect(TIERS.team.maxSwarmAgents).toBe(10);
      });

      it('should have 5 concurrent agents', () => {
        expect(TIERS.team.maxConcurrentAgents).toBe(5);
      });

      it('should have 50 max heartbeats', () => {
        expect(TIERS.team.maxHeartbeats).toBe(50);
      });

      it('should include large_swarm premium feature', () => {
        expect(TIERS.team.premiumFeatures).toContain('large_swarm');
      });

      it('should include persistent_agent premium feature', () => {
        expect(TIERS.team.premiumFeatures).toContain('persistent_agent');
      });

      it('should include multi_platform_msg premium feature', () => {
        expect(TIERS.team.premiumFeatures).toContain('multi_platform_msg');
      });

      it('should have swarm add-on price', () => {
        expect(TIERS.team.swarmAddOnCents).toBe(1500);
      });
    });

    describe('enterprise tier', () => {
      it('should have correct id and name', () => {
        expect(TIERS.enterprise.id).toBe('enterprise');
        expect(TIERS.enterprise.name).toBe('Enterprise');
      });

      it('should have custom pricing (0 cents)', () => {
        expect(TIERS.enterprise.priceMonthlyCents).toBe(0);
      });

      it('should have unlimited credits', () => {
        expect(TIERS.enterprise.creditsPerMonth).toBe(Number.MAX_SAFE_INTEGER);
      });

      it('should have 100 max swarm agents', () => {
        expect(TIERS.enterprise.maxSwarmAgents).toBe(100);
      });

      it('should have 20 concurrent agents', () => {
        expect(TIERS.enterprise.maxConcurrentAgents).toBe(20);
      });

      it('should have 500 max heartbeats', () => {
        expect(TIERS.enterprise.maxHeartbeats).toBe(500);
      });

      it('should include nvidia_advanced premium feature', () => {
        expect(TIERS.enterprise.premiumFeatures).toContain('nvidia_advanced');
      });

      it('should include all premium features', () => {
        expect(TIERS.enterprise.premiumFeatures).toContain('cloud_tools');
        expect(TIERS.enterprise.premiumFeatures).toContain('cicd_tools');
        expect(TIERS.enterprise.premiumFeatures).toContain('large_swarm');
        expect(TIERS.enterprise.premiumFeatures).toContain('persistent_agent');
        expect(TIERS.enterprise.premiumFeatures).toContain('nvidia_advanced');
        expect(TIERS.enterprise.premiumFeatures).toContain('multi_platform_msg');
        expect(TIERS.enterprise.premiumFeatures).toContain('priority_routing');
      });
    });
  });

  describe('getTier', () => {
    it('should return free tier', () => {
      const tier = getTier('free');
      
      expect(tier.id).toBe('free');
      expect(tier.name).toBe('Free');
    });

    it('should return pro tier', () => {
      const tier = getTier('pro');
      
      expect(tier.id).toBe('pro');
      expect(tier.name).toBe('Pro');
    });

    it('should return team tier', () => {
      const tier = getTier('team');
      
      expect(tier.id).toBe('team');
      expect(tier.name).toBe('Team');
    });

    it('should return enterprise tier', () => {
      const tier = getTier('enterprise');
      
      expect(tier.id).toBe('enterprise');
      expect(tier.name).toBe('Enterprise');
    });

    it('should fallback to free tier for unknown tier', () => {
      // @ts-expect-error Testing invalid tier
      const tier = getTier('unknown');
      
      expect(tier.id).toBe('free');
    });
  });

  describe('hasPremiumFeature', () => {
    describe('free tier', () => {
      it('should not have cloud_tools', () => {
        expect(hasPremiumFeature('free', 'cloud_tools')).toBe(false);
      });

      it('should not have cicd_tools', () => {
        expect(hasPremiumFeature('free', 'cicd_tools')).toBe(false);
      });

      it('should not have large_swarm', () => {
        expect(hasPremiumFeature('free', 'large_swarm')).toBe(false);
      });

      it('should not have persistent_agent', () => {
        expect(hasPremiumFeature('free', 'persistent_agent')).toBe(false);
      });

      it('should not have nvidia_advanced', () => {
        expect(hasPremiumFeature('free', 'nvidia_advanced')).toBe(false);
      });
    });

    describe('pro tier', () => {
      it('should have cloud_tools', () => {
        expect(hasPremiumFeature('pro', 'cloud_tools')).toBe(true);
      });

      it('should have cicd_tools', () => {
        expect(hasPremiumFeature('pro', 'cicd_tools')).toBe(true);
      });

      it('should have priority_routing', () => {
        expect(hasPremiumFeature('pro', 'priority_routing')).toBe(true);
      });

      it('should not have large_swarm', () => {
        expect(hasPremiumFeature('pro', 'large_swarm')).toBe(false);
      });

      it('should not have persistent_agent', () => {
        expect(hasPremiumFeature('pro', 'persistent_agent')).toBe(false);
      });
    });

    describe('team tier', () => {
      it('should have cloud_tools', () => {
        expect(hasPremiumFeature('team', 'cloud_tools')).toBe(true);
      });

      it('should have large_swarm', () => {
        expect(hasPremiumFeature('team', 'large_swarm')).toBe(true);
      });

      it('should have persistent_agent', () => {
        expect(hasPremiumFeature('team', 'persistent_agent')).toBe(true);
      });

      it('should have multi_platform_msg', () => {
        expect(hasPremiumFeature('team', 'multi_platform_msg')).toBe(true);
      });

      it('should not have nvidia_advanced', () => {
        expect(hasPremiumFeature('team', 'nvidia_advanced')).toBe(false);
      });
    });

    describe('enterprise tier', () => {
      it('should have all premium features', () => {
        const features: PremiumFeature[] = [
          'cloud_tools',
          'cicd_tools',
          'large_swarm',
          'persistent_agent',
          'nvidia_advanced',
          'multi_platform_msg',
          'priority_routing',
        ];

        for (const feature of features) {
          expect(hasPremiumFeature('enterprise', feature)).toBe(true);
        }
      });
    });
  });

  describe('getSwarmLimit', () => {
    it('should return 3 for free tier', () => {
      expect(getSwarmLimit('free')).toBe(3);
    });

    it('should return 5 for pro tier', () => {
      expect(getSwarmLimit('pro')).toBe(5);
    });

    it('should return 10 for team tier', () => {
      expect(getSwarmLimit('team')).toBe(10);
    });

    it('should return 100 for enterprise tier', () => {
      expect(getSwarmLimit('enterprise')).toBe(100);
    });
  });

  describe('getConcurrentAgentLimit', () => {
    it('should return 1 for free tier', () => {
      expect(getConcurrentAgentLimit('free')).toBe(1);
    });

    it('should return 3 for pro tier', () => {
      expect(getConcurrentAgentLimit('pro')).toBe(3);
    });

    it('should return 5 for team tier', () => {
      expect(getConcurrentAgentLimit('team')).toBe(5);
    });

    it('should return 20 for enterprise tier', () => {
      expect(getConcurrentAgentLimit('enterprise')).toBe(20);
    });
  });

  describe('getHeartbeatLimit', () => {
    it('should return 3 for free tier', () => {
      expect(getHeartbeatLimit('free')).toBe(3);
    });

    it('should return 10 for pro tier', () => {
      expect(getHeartbeatLimit('pro')).toBe(10);
    });

    it('should return 50 for team tier', () => {
      expect(getHeartbeatLimit('team')).toBe(50);
    });

    it('should return 500 for enterprise tier', () => {
      expect(getHeartbeatLimit('enterprise')).toBe(500);
    });
  });

  describe('Type exports', () => {
    it('should export TierId type', () => {
      const tierId: TierId = 'free';
      expect(tierId).toBe('free');
    });

    it('should export Tier type', () => {
      const tier: Tier = TIERS.free;
      expect(tier.id).toBe('free');
    });

    it('should export PremiumFeature type', () => {
      const feature: PremiumFeature = 'cloud_tools';
      expect(feature).toBe('cloud_tools');
    });
  });

  describe('Tier progression', () => {
    it('should have increasing credits from free to team', () => {
      expect(TIERS.free.creditsPerMonth).toBeLessThan(TIERS.pro.creditsPerMonth);
      expect(TIERS.pro.creditsPerMonth).toBeLessThan(TIERS.team.creditsPerMonth);
    });

    it('should have increasing swarm agents from free to enterprise', () => {
      expect(TIERS.free.maxSwarmAgents).toBeLessThan(TIERS.pro.maxSwarmAgents);
      expect(TIERS.pro.maxSwarmAgents).toBeLessThan(TIERS.team.maxSwarmAgents);
      expect(TIERS.team.maxSwarmAgents).toBeLessThan(TIERS.enterprise.maxSwarmAgents);
    });

    it('should have increasing concurrent agents from free to enterprise', () => {
      expect(TIERS.free.maxConcurrentAgents).toBeLessThan(TIERS.pro.maxConcurrentAgents);
      expect(TIERS.pro.maxConcurrentAgents).toBeLessThan(TIERS.team.maxConcurrentAgents);
      expect(TIERS.team.maxConcurrentAgents).toBeLessThan(TIERS.enterprise.maxConcurrentAgents);
    });

    it('should have increasing heartbeats from free to enterprise', () => {
      expect(TIERS.free.maxHeartbeats).toBeLessThan(TIERS.pro.maxHeartbeats);
      expect(TIERS.pro.maxHeartbeats).toBeLessThan(TIERS.team.maxHeartbeats);
      expect(TIERS.team.maxHeartbeats).toBeLessThan(TIERS.enterprise.maxHeartbeats);
    });

    it('should have increasing premium features from free to enterprise', () => {
      expect(TIERS.free.premiumFeatures.length).toBeLessThan(TIERS.pro.premiumFeatures.length);
      expect(TIERS.pro.premiumFeatures.length).toBeLessThan(TIERS.team.premiumFeatures.length);
      expect(TIERS.team.premiumFeatures.length).toBeLessThan(TIERS.enterprise.premiumFeatures.length);
    });
  });
});
