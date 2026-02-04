import { describe, it, expect, vi, beforeEach } from 'vitest';
import LintSkill from '../../src/skills/lint/index.js';
import * as eslint from 'eslint';

vi.mock('eslint');

const lintText = vi.fn();
const outputFixes = vi.fn();

(eslint.ESLint as any) = vi.fn().mockImplementation(() => {
  return {
    lintText: lintText,
  };
});
(eslint.ESLint as any).outputFixes = outputFixes;

const mockFileSystem = {
  isWithinWorkspace: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
};

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
};

const skillContext = {
  services: {
    logger: mockLogger,
    fileSystem: mockFileSystem,
  },
};

describe('LintSkill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lintText.mockClear();
    outputFixes.mockClear();
  });

  it('should have the correct manifest', () => {
    expect(LintSkill.manifest.id).toBe('lint');
  });

  it('should lint a file', async () => {
    mockFileSystem.isWithinWorkspace.mockReturnValue(true);
    mockFileSystem.readFile.mockResolvedValue('const x = 1;');
    lintText.mockResolvedValue([]);

    const result = await LintSkill.tools.handlers.lint_file(
      { filePath: 'test.ts' },
      skillContext as any
    );

    expect(mockFileSystem.readFile).toHaveBeenCalledWith('test.ts');
    expect(lintText).toHaveBeenCalledWith('const x = 1;', { filePath: 'test.ts' });
    expect(result.output).toBe('[]');
  });

  it('should fix a file', async () => {
    mockFileSystem.isWithinWorkspace.mockReturnValue(true);
    mockFileSystem.readFile.mockResolvedValue('const x=1');
    const lintResult = [{ output: 'const x = 1;' }];
    lintText.mockResolvedValue(lintResult);

    await LintSkill.tools.handlers.lint_file(
      { filePath: 'test.ts', fix: true },
      skillContext as any
    );

    expect(lintText).toHaveBeenCalled();
    expect(outputFixes).toHaveBeenCalledWith(lintResult);
    expect(mockFileSystem.writeFile).toHaveBeenCalledWith('test.ts', 'const x = 1;');
  });

  it('should return an error if file is outside workspace', async () => {
    mockFileSystem.isWithinWorkspace.mockReturnValue(false);

    const result = await LintSkill.tools.handlers.lint_file(
      { filePath: '../test.ts' },
      skillContext as any
    );

    expect(result.error).toContain('File is outside the workspace');
  });

  it('should return an error if file not found', async () => {
    mockFileSystem.isWithinWorkspace.mockReturnValue(true);
    mockFileSystem.readFile.mockResolvedValue(null);

    const result = await LintSkill.tools.handlers.lint_file(
      { filePath: 'test.ts' },
      skillContext as any
    );

    expect(result.error).toContain('File not found');
  });

  it('should handle errors during linting', async () => {
    mockFileSystem.isWithinWorkspace.mockReturnValue(true);
    mockFileSystem.readFile.mockResolvedValue('const x = 1;');
    lintText.mockRejectedValue(new Error('Linter error'));

    const result = await LintSkill.tools.handlers.lint_file(
      { filePath: 'test.ts' },
      skillContext as any
    );

    expect(result.error).toContain('Linter error');
  });
});
