import { describe, it, expect } from 'vitest';
import { getBaseTemplate, getPackageJson } from '../../src/services/projectTemplates.ts';
import type { TechStack } from '../../src/types/index.js';

describe('projectTemplates', () => {
  describe('getBaseTemplate', () => {
    it('should return base template for react-express-prisma', () => {
      const files = getBaseTemplate('react-express-prisma');
      
      expect(files.length).toBeGreaterThan(0);
      expect(files.some(f => f.path === '.gitignore')).toBe(true);
      expect(files.some(f => f.path === '.env.example')).toBe(true);
      expect(files.some(f => f.path === 'tsconfig.json')).toBe(true);
    });

    it('should return base template for fastapi-sqlalchemy', () => {
      const files = getBaseTemplate('fastapi-sqlalchemy');
      
      expect(files.length).toBeGreaterThan(0);
      expect(files.some(f => f.path === '.gitignore')).toBe(true);
      expect(files.some(f => f.path === '.env.example')).toBe(true);
      expect(files.some(f => f.path === 'requirements.txt')).toBe(true);
    });

    it('should return base template for nextjs-prisma', () => {
      const files = getBaseTemplate('nextjs-prisma');
      
      expect(files.length).toBeGreaterThan(0);
      expect(files.some(f => f.path === '.gitignore')).toBe(true);
      expect(files.some(f => f.path === '.env.example')).toBe(true);
      expect(files.some(f => f.path === 'next.config.js')).toBe(true);
      expect(files.some(f => f.path === 'tsconfig.json')).toBe(true);
    });

    it('should return empty array for unknown tech stack', () => {
      const files = getBaseTemplate('unknown-stack' as TechStack);
      expect(files).toEqual([]);
    });

    it('should include correct content in .gitignore for react-express-prisma', () => {
      const files = getBaseTemplate('react-express-prisma');
      const gitignore = files.find(f => f.path === '.gitignore');
      
      expect(gitignore).toBeDefined();
      expect(gitignore?.content).toContain('node_modules/');
      expect(gitignore?.content).toContain('dist/');
      expect(gitignore?.content).toContain('.env');
    });

    it('should include correct content in .env.example for react-express-prisma', () => {
      const files = getBaseTemplate('react-express-prisma');
      const envExample = files.find(f => f.path === '.env.example');
      
      expect(envExample).toBeDefined();
      expect(envExample?.content).toContain('DATABASE_URL');
      expect(envExample?.content).toContain('PORT');
      expect(envExample?.content).toContain('NODE_ENV');
    });

    it('should include valid tsconfig.json for react-express-prisma', () => {
      const files = getBaseTemplate('react-express-prisma');
      const tsconfig = files.find(f => f.path === 'tsconfig.json');
      
      expect(tsconfig).toBeDefined();
      const config = JSON.parse(tsconfig!.content);
      expect(config.compilerOptions).toBeDefined();
      expect(config.compilerOptions.strict).toBe(true);
      expect(config.compilerOptions.target).toBe('ES2022');
    });

    it('should include requirements.txt for fastapi-sqlalchemy', () => {
      const files = getBaseTemplate('fastapi-sqlalchemy');
      const requirements = files.find(f => f.path === 'requirements.txt');
      
      expect(requirements).toBeDefined();
      expect(requirements?.content).toContain('fastapi');
      expect(requirements?.content).toContain('uvicorn');
      expect(requirements?.content).toContain('sqlalchemy');
    });

    it('should include next.config.js for nextjs-prisma', () => {
      const files = getBaseTemplate('nextjs-prisma');
      const nextConfig = files.find(f => f.path === 'next.config.js');
      
      expect(nextConfig).toBeDefined();
      expect(nextConfig?.content).toContain('nextConfig');
      expect(nextConfig?.content).toContain('serverActions');
    });
  });

  describe('getPackageJson', () => {
    it('should return package.json for react-express-prisma', () => {
      const result = getPackageJson('test-project', 'react-express-prisma');
      
      expect(result).not.toBeNull();
      expect(result?.path).toBe('package.json');
      
      const packageJson = JSON.parse(result!.content);
      expect(packageJson.name).toBe('test-project');
      expect(packageJson.version).toBe('0.1.0');
      expect(packageJson.private).toBe(true);
      expect(packageJson.type).toBe('module');
      expect(packageJson.scripts).toBeDefined();
      expect(packageJson.scripts.dev).toBeDefined();
      expect(packageJson.dependencies).toBeDefined();
      expect(packageJson.dependencies.express).toBeDefined();
      expect(packageJson.dependencies['@prisma/client']).toBeDefined();
    });

    it('should return package.json for nextjs-prisma', () => {
      const result = getPackageJson('my-nextjs-app', 'nextjs-prisma');
      
      expect(result).not.toBeNull();
      expect(result?.path).toBe('package.json');
      
      const packageJson = JSON.parse(result!.content);
      expect(packageJson.name).toBe('my-nextjs-app');
      expect(packageJson.version).toBe('0.1.0');
      expect(packageJson.private).toBe(true);
      expect(packageJson.scripts).toBeDefined();
      expect(packageJson.scripts.dev).toBe('next dev');
      expect(packageJson.dependencies).toBeDefined();
      expect(packageJson.dependencies.next).toBeDefined();
      expect(packageJson.dependencies.react).toBeDefined();
    });

    it('should return null for fastapi-sqlalchemy (Python uses requirements.txt)', () => {
      const result = getPackageJson('test-project', 'fastapi-sqlalchemy');
      expect(result).toBeNull();
    });

    it('should include correct scripts for react-express-prisma', () => {
      const result = getPackageJson('test-project', 'react-express-prisma');
      const packageJson = JSON.parse(result!.content);
      
      expect(packageJson.scripts.dev).toContain('tsx watch');
      expect(packageJson.scripts.build).toBe('tsc');
      expect(packageJson.scripts.start).toBeDefined();
      expect(packageJson.scripts['db:generate']).toBe('prisma generate');
      expect(packageJson.scripts['db:migrate']).toBe('prisma migrate dev');
    });

    it('should include correct scripts for nextjs-prisma', () => {
      const result = getPackageJson('test-project', 'nextjs-prisma');
      const packageJson = JSON.parse(result!.content);
      
      expect(packageJson.scripts.dev).toBe('next dev');
      expect(packageJson.scripts.build).toBe('next build');
      expect(packageJson.scripts.start).toBe('next start');
      expect(packageJson.scripts.lint).toBe('next lint');
      expect(packageJson.scripts['db:generate']).toBe('prisma generate');
    });

    it('should include devDependencies for react-express-prisma', () => {
      const result = getPackageJson('test-project', 'react-express-prisma');
      const packageJson = JSON.parse(result!.content);
      
      expect(packageJson.devDependencies).toBeDefined();
      expect(packageJson.devDependencies['@types/express']).toBeDefined();
      expect(packageJson.devDependencies['@types/node']).toBeDefined();
      expect(packageJson.devDependencies.prisma).toBeDefined();
      expect(packageJson.devDependencies.typescript).toBeDefined();
      expect(packageJson.devDependencies.tsx).toBeDefined();
    });

    it('should include devDependencies for nextjs-prisma', () => {
      const result = getPackageJson('test-project', 'nextjs-prisma');
      const packageJson = JSON.parse(result!.content);
      
      expect(packageJson.devDependencies).toBeDefined();
      expect(packageJson.devDependencies['@types/node']).toBeDefined();
      expect(packageJson.devDependencies['@types/react']).toBeDefined();
      expect(packageJson.devDependencies.prisma).toBeDefined();
      expect(packageJson.devDependencies.typescript).toBeDefined();
      expect(packageJson.devDependencies.eslint).toBeDefined();
    });

    it('should sanitize project name in package.json', () => {
      const result = getPackageJson('My Test Project!', 'react-express-prisma');
      const packageJson = JSON.parse(result!.content);
      
      // Name should be sanitized (lowercase, no spaces/special chars)
      expect(packageJson.name).toBe('my-test-project');
    });
  });
});
