import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as service from '../../src/features/security-compliance/service';
import * as llmGateway from '../../src/services/llmGateway';
import * as fs from 'fs';

vi.mock('fs');
vi.mock('../../src/services/llmGateway');

describe('Security & Compliance Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('performSecurityScan', () => {
    it('should perform a secrets scan', async () => {
      (fs.readFileSync as any).mockReturnValue('const aws_key = "AKIAIOSFODNN7EXAMPLE";');
      (fs.readdirSync as any).mockReturnValue([{ name: 'test.js', isFile: () => true, isDirectory: () => false }]);

      const result = await service.performSecurityScan({
        workspacePath: '/test',
        scanTypes: ['secrets'],
      });

      expect(result.summary.totalVulnerabilities).toBe(1);
      expect(result.vulnerabilities[0].type).toBe('secret-exposure');
    });
  });

  describe('generateSBOM', () => {
    it('should generate an SBOM', async () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue(JSON.stringify({
        dependencies: { 'express': '4.17.1' }
      }));

      const result = await service.generateSBOM({ workspacePath: '/test' });
      expect(result.components.length).toBe(1);
      expect(result.components[0].name).toBe('express');
    });
  });

  describe('generateComplianceReport', () => {
    it('should generate a compliance report', async () => {
      (fs.readFileSync as any).mockReturnValue('{}');
      (fs.existsSync as any).mockReturnValue(true);
      (llmGateway.getStream as any).mockImplementation(async function*() {
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text: '```json\n{"requirements":[]}\n```' } };
      });
      
      const result = await service.generateComplianceReport({
        workspacePath: '/test',
        standard: 'pci-dss',
        projectType: 'web-app'
      });

      expect(result.summary.totalRequirements).toBe(0);
    });
  });

  describe('auditSecrets', () => {
    it('should audit secrets', async () => {
      (fs.readFileSync as any).mockReturnValue('const aws_key = "AKIAIOSFODNN7EXAMPLE";');
      (fs.readdirSync as any).mockReturnValue([{ name: 'test.js', isFile: () => true, isDirectory: () => false }]);

      const result = await service.auditSecrets({ workspacePath: '/test' });
      expect(result.secretsFound).toBe(1);
    });
  });
});
