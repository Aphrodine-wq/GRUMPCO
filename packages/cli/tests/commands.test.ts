/**
 * CLI Commands Unit Tests
 * Tests all CLI commands execute without errors
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockConsole, mockFs, mockRandom, sampleCode, wait } from './setup.js';

// Mock fs
vi.mock('fs', () => mockFs({ 'test.ts': sampleCode }));

// Mock child_process
vi.mock('child_process', () => ({
  execSync: vi.fn(() => `
^hash123 (John Doe 2024-01-15 14:30:00 +0000 1) const x = 1;
^hash456 (Jane Smith 2024-01-14 09:20:00 +0000 2) const y = 2;
  `),
}));

describe('CLI Commands', () => {
  const consoleMock = mockConsole();
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Funny Commands', () => {
    it('should execute rant command', async () => {
      const { rantCommand } = await import('../src/commands/rant.js');
      await expect(rantCommand.execute({ level: 'gentle', count: 1 })).resolves.not.toThrow();
    });

    it('should execute excuse command', async () => {
      const { excuseCommand } = await import('../src/commands/excuse.js');
      await expect(excuseCommand.execute({ category: 'classic', count: 1 })).resolves.not.toThrow();
    });

    it('should execute fortune command', async () => {
      const { fortuneCommand } = await import('../src/commands/fortune.js');
      await expect(fortuneCommand.execute({ category: 'lucky' })).resolves.not.toThrow();
    });

    it('should execute panic command', async () => {
      const { panicCommand } = await import('../src/commands/panic.js');
      await expect(panicCommand.execute({ reason: 'test panic' })).resolves.not.toThrow();
    });

    it('should execute vibes command', async () => {
      const { vibesCommand } = await import('../src/commands/vibes.js');
      await expect(vibesCommand.execute({ path: '.', deep: false })).resolves.not.toThrow();
    });

    it('should execute coffee command without file', async () => {
      const { coffeeCommand } = await import('../src/commands/coffee.js');
      await expect(coffeeCommand.execute(undefined, {})).resolves.not.toThrow();
    });

    it('should execute why command', async () => {
      const { whyCommand } = await import('../src/commands/why.js');
      await expect(whyCommand.execute('code', { file: 'code', deep: false })).resolves.not.toThrow();
    });

    it('should execute shipit command', async () => {
      vi.useFakeTimers();
      const { shipitCommand } = await import('../src/commands/shipit.js');
      const promise = shipitCommand.execute({ yolo: true, force: false });
      await vi.runAllTimersAsync();
      await expect(promise).resolves.not.toThrow();
      vi.useRealTimers();
    });
  });

  describe('Batch 2 Commands', () => {
    it('should execute overtime command', async () => {
      const { overtimeCommand } = await import('../src/commands/overtime.js');
      await expect(overtimeCommand.execute({ hours: 45, rate: 50, weeks: 52 })).resolves.not.toThrow();
    });

    it('should execute meeting command with excuse', async () => {
      const { meetingCommand } = await import('../src/commands/meeting.js');
      await expect(meetingCommand.execute({ excuse: true })).resolves.not.toThrow();
    });

    it('should execute meeting command with tip', async () => {
      const { meetingCommand } = await import('../src/commands/meeting.js');
      await expect(meetingCommand.execute({ tip: true })).resolves.not.toThrow();
    });

    it('should execute meeting command default', async () => {
      const { meetingCommand } = await import('../src/commands/meeting.js');
      await expect(meetingCommand.execute({})).resolves.not.toThrow();
    });

    it('should execute stackoverflow command', async () => {
      const { stackoverflowCommand } = await import('../src/commands/stackoverflow.js');
      await expect(stackoverflowCommand.execute({})).resolves.not.toThrow();
    });

    it('should execute stackoverflow with question', async () => {
      const { stackoverflowCommand } = await import('../src/commands/stackoverflow.js');
      await expect(stackoverflowCommand.execute({ question: 'How do I center a div?' })).resolves.not.toThrow();
    });

    it('should execute fml command', async () => {
      const { fmlCommand } = await import('../src/commands/fml.js');
      await expect(fmlCommand.execute({})).resolves.not.toThrow();
    });

    it('should execute fml with help', async () => {
      const { fmlCommand } = await import('../src/commands/fml.js');
      await expect(fmlCommand.execute({ help: true })).resolves.not.toThrow();
    });

    it('should execute intern command', async () => {
      const { internCommand } = await import('../src/commands/intern.js');
      await expect(internCommand.execute({})).resolves.not.toThrow();
    });

    it('should execute intern with excuse', async () => {
      const { internCommand } = await import('../src/commands/intern.js');
      await expect(internCommand.execute({ excuse: true })).resolves.not.toThrow();
    });

    it('should execute intern with achievements', async () => {
      const { internCommand } = await import('../src/commands/intern.js');
      await expect(internCommand.execute({ achievement: true })).resolves.not.toThrow();
    });

    it('should execute legacy command', async () => {
      const { legacyCommand } = await import('../src/commands/legacy.js');
      await expect(legacyCommand.execute({})).resolves.not.toThrow();
    });

    it('should execute legacy with horror', async () => {
      const { legacyCommand } = await import('../src/commands/legacy.js');
      await expect(legacyCommand.execute({ horror: true })).resolves.not.toThrow();
    });

    it('should execute legacy with tips', async () => {
      const { legacyCommand } = await import('../src/commands/legacy.js');
      await expect(legacyCommand.execute({ tips: true })).resolves.not.toThrow();
    });

    it('should execute yeet command', async () => {
      const { yeetCommand } = await import('../src/commands/yeet.js');
      await expect(yeetCommand.execute('bad code', {})).resolves.not.toThrow();
    });

    it('should execute yeet with wisdom', async () => {
      const { yeetCommand } = await import('../src/commands/yeet.js');
      await expect(yeetCommand.execute(undefined, { wisdom: true })).resolves.not.toThrow();
    });

    it('should execute techdebt command', async () => {
      const { techDebtCommand } = await import('../src/commands/techdebt.js');
      await expect(techDebtCommand.execute({})).resolves.not.toThrow();
    });

    it('should execute techdebt with excuses', async () => {
      const { techDebtCommand } = await import('../src/commands/techdebt.js');
      await expect(techDebtCommand.execute({ excuses: true })).resolves.not.toThrow();
    });

    it('should execute techdebt with strategies', async () => {
      const { techDebtCommand } = await import('../src/commands/techdebt.js');
      await expect(techDebtCommand.execute({ strategies: true })).resolves.not.toThrow();
    });

    it('should execute friday command', async () => {
      const { fridayCommand } = await import('../src/commands/friday.js');
      await expect(fridayCommand.execute({})).resolves.not.toThrow();
    });

    it('should execute friday with excuse', async () => {
      const { fridayCommand } = await import('../src/commands/friday.js');
      await expect(fridayCommand.execute({ excuse: true })).resolves.not.toThrow();
    });

    it('should execute friday with guide', async () => {
      const { fridayCommand } = await import('../src/commands/friday.js');
      await expect(fridayCommand.execute({ guide: true })).resolves.not.toThrow();
    });

    it('should execute imposter command', async () => {
      const { imposterCommand } = await import('../src/commands/imposter.js');
      await expect(imposterCommand.execute({})).resolves.not.toThrow();
    });

    it('should execute imposter with truths', async () => {
      const { imposterCommand } = await import('../src/commands/imposter.js');
      await expect(imposterCommand.execute({ truth: true })).resolves.not.toThrow();
    });

    it('should execute imposter with affirmations', async () => {
      const { imposterCommand } = await import('../src/commands/imposter.js');
      await expect(imposterCommand.execute({ affirm: true })).resolves.not.toThrow();
    });

    it('should execute imposter with stats', async () => {
      const { imposterCommand } = await import('../src/commands/imposter.js');
      await expect(imposterCommand.execute({ stats: true })).resolves.not.toThrow();
    });
  });

  describe('Utility Commands', () => {
    it('should execute motivate command', async () => {
      const { motivateCommand } = await import('../src/commands/motivate.js');
      await expect(motivateCommand.execute({ level: 'gentle', count: 1 })).resolves.not.toThrow();
    });

    it('should execute insult command', async () => {
      const { insultCommand } = await import('../src/commands/insult.js');
      await expect(insultCommand.execute({ count: 1 })).resolves.not.toThrow();
    });

    it('should execute procrastinate command', async () => {
      const { procrastinateCommand } = await import('../src/commands/procrastinate.js');
      await expect(procrastinateCommand.execute({})).resolves.not.toThrow();
    });

    it('should execute deadline command', async () => {
      const { deadlineCommand } = await import('../src/commands/deadline.js');
      await expect(deadlineCommand.execute({})).resolves.not.toThrow();
    });

    it('should execute bug command', async () => {
      const { bugCommand } = await import('../src/commands/bug.js');
      await expect(bugCommand.execute({})).resolves.not.toThrow();
    });

    it('should execute deploy command', async () => {
      const { deployCommand } = await import('../src/commands/deploy.js');
      await expect(deployCommand.execute({})).resolves.not.toThrow();
    });

    it('should execute review command', async () => {
      const { reviewCommand } = await import('../src/commands/review.js');
      await expect(reviewCommand.execute({})).resolves.not.toThrow();
    });

    it('should execute standup command', async () => {
      const { standupCommand } = await import('../src/commands/standup.js');
      await expect(standupCommand.execute({})).resolves.not.toThrow();
    });

    it('should execute retro command', async () => {
      const { retroCommand } = await import('../src/commands/retro.js');
      await expect(retroCommand.execute({})).resolves.not.toThrow();
    });

    it('should execute merge command', async () => {
      const { mergeCommand } = await import('../src/commands/merge.js');
      await expect(mergeCommand.execute({})).resolves.not.toThrow();
    });
  });

  describe('Documentation Commands', () => {
    it('should execute docs command without file', async () => {
      const { docsCommand } = await import('../src/commands/docs.js');
      await expect(docsCommand.execute(undefined, { style: 'sassy' })).resolves.not.toThrow();
    });

    it('should execute refactor command without file', async () => {
      const { refactorCommand } = await import('../src/commands/refactor.js');
      await expect(refactorCommand.execute(undefined, { aggressive: false })).resolves.not.toThrow();
    });
  });
});

describe('Command Consistency', () => {
  it('all commands should export an execute function', async () => {
    const commandModules = [
      '../src/commands/rant.js',
      '../src/commands/excuse.js',
      '../src/commands/fortune.js',
      '../src/commands/panic.js',
      '../src/commands/vibes.js',
      '../src/commands/coffee.js',
      '../src/commands/why.js',
      '../src/commands/shipit.js',
      '../src/commands/overtime.js',
      '../src/commands/meeting.js',
      '../src/commands/stackoverflow.js',
      '../src/commands/fml.js',
      '../src/commands/intern.js',
      '../src/commands/legacy.js',
      '../src/commands/yeet.js',
      '../src/commands/techdebt.js',
      '../src/commands/friday.js',
      '../src/commands/imposter.js',
      '../src/commands/motivate.js',
      '../src/commands/insult.js',
      '../src/commands/procrastinate.js',
      '../src/commands/deadline.js',
      '../src/commands/bug.js',
      '../src/commands/deploy.js',
      '../src/commands/review.js',
      '../src/commands/standup.js',
      '../src/commands/retro.js',
      '../src/commands/merge.js',
      '../src/commands/docs.js',
      '../src/commands/refactor.js',
    ];

    for (const modulePath of commandModules) {
      const module = await import(modulePath);
      // Each module should have a default export or a named command export
      const command = Object.values(module).find((exp: any) => exp && typeof exp.execute === 'function');
      expect(command, `Module ${modulePath} should export a command with execute function`).toBeDefined();
      expect(typeof (command as any).execute).toBe('function');
    }
  });
});
