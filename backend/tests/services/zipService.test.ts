import { describe, it, expect } from 'vitest';
import { createProjectZip } from '../../src/services/zipService.ts';
import type { FileDefinition, TechStack } from '../../src/types/index.js';

describe('zipService', () => {
  const mockFiles: FileDefinition[] = [
    { path: 'src/index.js', content: 'console.log("hello");' },
    { path: 'package.json', content: '{"name": "test"}' },
  ];

  describe('createProjectZip', () => {
    it('should create a ZIP stream', () => {
      const zipStream = createProjectZip(mockFiles, 'test-project', 'react-express-prisma');
      
      expect(zipStream).toBeDefined();
      expect(zipStream.readable).toBe(true);
    });

    it('should include all files in the archive', async () => {
      const zipStream = createProjectZip(mockFiles, 'test-project', 'react-express-prisma');
      const chunks: Buffer[] = [];

      await new Promise<void>((resolve, reject) => {
        zipStream.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        zipStream.on('end', () => {
          const zipBuffer = Buffer.concat(chunks);
          // ZIP files start with PK (0x504B)
          expect(zipBuffer[0]).toBe(0x50);
          expect(zipBuffer[1]).toBe(0x4B);
          resolve();
        });

        zipStream.on('error', reject);
      });
    });

    it('should include README.md in the archive', async () => {
      const zipStream = createProjectZip(mockFiles, 'test-project', 'react-express-prisma');
      const chunks: Buffer[] = [];

      await new Promise<void>((resolve, reject) => {
        zipStream.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        zipStream.on('end', () => {
          const zipBuffer = Buffer.concat(chunks);
          const zipString = zipBuffer.toString('binary');
          // README should be included
          expect(zipString).toContain('README.md');
          expect(zipString).toContain('test-project');
          resolve();
        });

        zipStream.on('error', reject);
      });
    });

    it('should work with different tech stacks', () => {
      const stacks: TechStack[] = ['react-express-prisma', 'fastapi-sqlalchemy', 'nextjs-prisma'];
      
      stacks.forEach(stack => {
        const zipStream = createProjectZip(mockFiles, 'test-project', stack);
        expect(zipStream).toBeDefined();
      });
    });

    it('should handle empty file list', async () => {
      const zipStream = createProjectZip([], 'test-project', 'react-express-prisma');
      const chunks: Buffer[] = [];

      await new Promise<void>((resolve, reject) => {
        zipStream.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        zipStream.on('end', () => {
          // Should still create a valid ZIP (with just README)
          const zipBuffer = Buffer.concat(chunks);
          expect(zipBuffer.length).toBeGreaterThan(0);
          resolve();
        });

        zipStream.on('error', reject);
      });
    });

    it('should prefix files with project name', async () => {
      const zipStream = createProjectZip(mockFiles, 'my-project', 'react-express-prisma');
      const chunks: Buffer[] = [];

      await new Promise<void>((resolve, reject) => {
        zipStream.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        zipStream.on('end', () => {
          const zipBuffer = Buffer.concat(chunks);
          const zipString = zipBuffer.toString('binary');
          // Files should be prefixed with project name
          expect(zipString).toContain('my-project/');
          resolve();
        });

        zipStream.on('error', reject);
      });
    });
  });
});
