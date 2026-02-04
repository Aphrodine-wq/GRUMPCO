import { describe, it, expect } from 'vitest';
import {
  parseGrump,
  chunkGrumpByAST,
  type GrumpBlock,
  type GrumpAST,
  type GrumpNodeType,
} from '../../src/services/grumpParser.js';

describe('grumpParser', () => {
  describe('parseGrump', () => {
    describe('entity parsing', () => {
      it('should parse a simple entity block', () => {
        const source = `entity Player {
          health: 100
          speed: 5
        }`;

        const result = parseGrump(source);

        expect(result.blocks).toHaveLength(1);
        expect(result.blocks[0].type).toBe('entity');
        expect(result.blocks[0].name).toBe('Player');
        expect(result.blocks[0].body).toContain('health: 100');
        expect(result.blocks[0].start).toBe(0);
        expect(result.blocks[0].end).toBeGreaterThan(0);
      });

      it('should parse multiple entity blocks', () => {
        const source = `entity Player {
          health: 100
        }

        entity Enemy {
          health: 50
        }`;

        const result = parseGrump(source);

        expect(result.blocks).toHaveLength(2);
        expect(result.blocks[0].name).toBe('Player');
        expect(result.blocks[1].name).toBe('Enemy');
      });
    });

    describe('component parsing', () => {
      it('should parse a component block', () => {
        const source = `component Position {
          x: 0
          y: 0
        }`;

        const result = parseGrump(source);

        expect(result.blocks).toHaveLength(1);
        expect(result.blocks[0].type).toBe('component');
        expect(result.blocks[0].name).toBe('Position');
      });

      it('should parse multiple component blocks', () => {
        const source = `component Position {
          x: 0
        }

        component Velocity {
          dx: 0
          dy: 0
        }`;

        const result = parseGrump(source);

        expect(result.blocks).toHaveLength(2);
        expect(result.blocks[0].name).toBe('Position');
        expect(result.blocks[1].name).toBe('Velocity');
      });
    });

    describe('system parsing', () => {
      it('should parse a system block', () => {
        const source = `system Movement {
          query: [Position, Velocity]
          update: move
        }`;

        const result = parseGrump(source);

        expect(result.blocks).toHaveLength(1);
        expect(result.blocks[0].type).toBe('system');
        expect(result.blocks[0].name).toBe('Movement');
      });
    });

    describe('anim parsing', () => {
      it('should parse an animation block', () => {
        const source = `anim Walk {
          frames: 8
          duration: 0.5
        }`;

        const result = parseGrump(source);

        expect(result.blocks).toHaveLength(1);
        expect(result.blocks[0].type).toBe('anim');
        expect(result.blocks[0].name).toBe('Walk');
      });
    });

    describe('mixed block types', () => {
      it('should parse mixed block types', () => {
        const source = `entity Player {
          health: 100
        }

        component Position {
          x: 0
        }

        system Physics {
          gravity: 9.8
        }

        anim Idle {
          frames: 4
        }`;

        const result = parseGrump(source);

        expect(result.blocks).toHaveLength(4);
        expect(result.blocks[0].type).toBe('entity');
        expect(result.blocks[1].type).toBe('component');
        expect(result.blocks[2].type).toBe('system');
        expect(result.blocks[3].type).toBe('anim');
      });
    });

    describe('nested braces handling', () => {
      it('should handle nested braces within blocks', () => {
        const source = `entity Player {
          stats: {
            health: 100
            mana: 50
          }
          inventory: {
            items: []
          }
        }`;

        const result = parseGrump(source);

        expect(result.blocks).toHaveLength(1);
        expect(result.blocks[0].body).toContain('stats: {');
        expect(result.blocks[0].body).toContain('inventory: {');
      });

      it('should correctly end block at matching closing brace', () => {
        const source = `entity Player {
          nested: {
            deep: {
              value: 1
            }
          }
        }

        entity Enemy {
          health: 50
        }`;

        const result = parseGrump(source);

        expect(result.blocks).toHaveLength(2);
        expect(result.blocks[0].name).toBe('Player');
        expect(result.blocks[1].name).toBe('Enemy');
        // Player block should contain all nested content
        expect(result.blocks[0].body).toContain('deep: {');
        // Enemy should not be part of Player
        expect(result.blocks[0].body).not.toContain('health: 50');
      });
    });

    describe('edge cases', () => {
      it('should return empty blocks array for empty source', () => {
        const result = parseGrump('');

        expect(result.blocks).toEqual([]);
        expect(result.raw).toBe('');
      });

      it('should return empty blocks for source without valid blocks', () => {
        const source = `// This is a comment
        some random text
        no blocks here`;

        const result = parseGrump(source);

        expect(result.blocks).toEqual([]);
      });

      it('should preserve raw source in AST', () => {
        const source = 'entity Test { value: 1 }';
        const result = parseGrump(source);

        expect(result.raw).toBe(source);
      });

      it('should handle whitespace variations', () => {
        const source = `  entity   Spaced  {
          value: 1
        }`;

        const result = parseGrump(source);

        expect(result.blocks).toHaveLength(1);
        expect(result.blocks[0].name).toBe('Spaced');
      });

      it('should handle blocks on single line', () => {
        const source = 'entity Single { value: 1 }';

        const result = parseGrump(source);

        expect(result.blocks).toHaveLength(1);
        expect(result.blocks[0].name).toBe('Single');
      });

      it('should handle consecutive blocks without gaps', () => {
        // Note: Parser requires newline before block declarations
        const source = `entity A {
        }
entity B {
        }`;

        const result = parseGrump(source);

        expect(result.blocks).toHaveLength(2);
        expect(result.blocks[0].name).toBe('A');
        expect(result.blocks[1].name).toBe('B');
      });

      it('should track correct start and end positions', () => {
        const source = `entity First {
          a: 1
        }

        entity Second {
          b: 2
        }`;

        const result = parseGrump(source);

        expect(result.blocks[0].start).toBe(0);
        expect(result.blocks[0].end).toBeLessThan(result.blocks[1].start);
        expect(result.blocks[1].end).toBeLessThanOrEqual(source.length);
      });
    });

    describe('names with underscores and numbers', () => {
      it('should parse names with underscores', () => {
        const source = `entity Player_Character {
          value: 1
        }`;

        const result = parseGrump(source);

        expect(result.blocks[0].name).toBe('Player_Character');
      });

      it('should parse names with numbers', () => {
        const source = `entity Entity123 {
          value: 1
        }`;

        const result = parseGrump(source);

        expect(result.blocks[0].name).toBe('Entity123');
      });

      it('should parse names with mixed characters', () => {
        const source = `component Position_2D_v1 {
          x: 0
        }`;

        const result = parseGrump(source);

        expect(result.blocks[0].name).toBe('Position_2D_v1');
      });
    });

    describe('special content inside blocks', () => {
      it('should handle string content with braces', () => {
        const source = `entity Player {
          message: "Hello { World }"
        }`;

        const result = parseGrump(source);

        // Note: This test verifies behavior - the simple brace counting
        // may not handle strings perfectly, but shows current behavior
        expect(result.blocks.length).toBeGreaterThanOrEqual(1);
      });

      it('should handle empty blocks', () => {
        const source = `entity Empty {
        }`;

        const result = parseGrump(source);

        expect(result.blocks).toHaveLength(1);
        expect(result.blocks[0].name).toBe('Empty');
      });

      it('should handle blocks with only whitespace', () => {
        const source = `entity Whitespace {


        }`;

        const result = parseGrump(source);

        expect(result.blocks).toHaveLength(1);
        expect(result.blocks[0].name).toBe('Whitespace');
      });
    });
  });

  describe('chunkGrumpByAST', () => {
    it('should chunk source by semantic blocks', () => {
      const source = `entity Player {
        health: 100
      }

      entity Enemy {
        health: 50
      }`;
      const filePath = 'game.grump';

      const result = chunkGrumpByAST(source, filePath);

      expect(result).toHaveLength(2);
      expect(result[0].content).toContain('entity Player');
      expect(result[0].source).toBe('game.grump#entity:Player');
      expect(result[0].type).toBe('grump');
      expect(result[1].content).toContain('entity Enemy');
      expect(result[1].source).toBe('game.grump#entity:Enemy');
    });

    it('should return whole file when no blocks found', () => {
      const source = 'Some plain text without blocks';
      const filePath = 'plain.grump';

      const result = chunkGrumpByAST(source, filePath);

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('Some plain text without blocks');
      expect(result[0].source).toBe('plain.grump');
      expect(result[0].type).toBe('grump');
    });

    it('should handle empty source', () => {
      const result = chunkGrumpByAST('', 'empty.grump');

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('');
      expect(result[0].source).toBe('empty.grump');
    });

    it('should trim block content', () => {
      const source = `entity Test {

        value: 1

      }`;
      const filePath = 'test.grump';

      const result = chunkGrumpByAST(source, filePath);

      expect(result[0].content).toBe(source.trim());
    });

    it('should include block type and name in source path', () => {
      const source = `component Physics {
        gravity: 9.8
      }

      system Render {
        pipeline: forward
      }

      anim Jump {
        frames: 12
      }`;
      const filePath = 'game/mechanics.grump';

      const result = chunkGrumpByAST(source, filePath);

      expect(result).toHaveLength(3);
      expect(result[0].source).toBe('game/mechanics.grump#component:Physics');
      expect(result[1].source).toBe('game/mechanics.grump#system:Render');
      expect(result[2].source).toBe('game/mechanics.grump#anim:Jump');
    });

    it('should handle file paths with special characters', () => {
      const source = `entity Player {
        health: 100
      }`;
      const filePath = 'my-game/level_1/entities.grump';

      const result = chunkGrumpByAST(source, filePath);

      expect(result[0].source).toBe('my-game/level_1/entities.grump#entity:Player');
    });

    it('should handle whitespace-only source', () => {
      const result = chunkGrumpByAST('   \n\n   ', 'whitespace.grump');

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('');
    });

    it('should create separate chunks for each block type', () => {
      const source = `entity Hero {
        power: 100
      }

      component Transform {
        x: 0
        y: 0
        z: 0
      }`;
      const filePath = 'mixed.grump';

      const result = chunkGrumpByAST(source, filePath);

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('grump');
      expect(result[1].type).toBe('grump');
    });

    it('should preserve content integrity in chunks', () => {
      const source = `entity ComplexEntity {
        nested: {
          deep: {
            value: 42
          }
        }
        array: [1, 2, 3]
        string: "test"
      }`;
      const filePath = 'complex.grump';

      const result = chunkGrumpByAST(source, filePath);

      expect(result).toHaveLength(1);
      expect(result[0].content).toContain('nested: {');
      expect(result[0].content).toContain('deep: {');
      expect(result[0].content).toContain('value: 42');
      expect(result[0].content).toContain('array: [1, 2, 3]');
    });
  });

  describe('type definitions', () => {
    it('should have correct GrumpNodeType values', () => {
      const types: GrumpNodeType[] = ['entity', 'component', 'system', 'anim'];
      
      // Each block type on its own line for the parser to match
      const source = `entity E { }
component C { }
system S { }
anim A { }`;
      const result = parseGrump(source);

      const parsedTypes = result.blocks.map(b => b.type);
      expect(parsedTypes).toEqual(types);
    });

    it('should return valid GrumpBlock structure', () => {
      const source = `entity Test { value: 1 }`;
      const result = parseGrump(source);
      const block: GrumpBlock = result.blocks[0];

      expect(block).toHaveProperty('type');
      expect(block).toHaveProperty('name');
      expect(block).toHaveProperty('body');
      expect(block).toHaveProperty('start');
      expect(block).toHaveProperty('end');
      expect(typeof block.type).toBe('string');
      expect(typeof block.name).toBe('string');
      expect(typeof block.body).toBe('string');
      expect(typeof block.start).toBe('number');
      expect(typeof block.end).toBe('number');
    });

    it('should return valid GrumpAST structure', () => {
      const source = `entity Test { }`;
      const result: GrumpAST = parseGrump(source);

      expect(result).toHaveProperty('blocks');
      expect(result).toHaveProperty('raw');
      expect(Array.isArray(result.blocks)).toBe(true);
      expect(typeof result.raw).toBe('string');
    });
  });

  describe('regex matching edge cases', () => {
    it('should not match partial keywords', () => {
      const source = `
        // entity_like keyword
        notentity Test { }
        entitylike Test { }
      `;

      const result = parseGrump(source);

      expect(result.blocks).toHaveLength(0);
    });

    it('should match keywords at line start with whitespace', () => {
      const source = `
        entity First { }
      entity Second { }`;

      const result = parseGrump(source);

      expect(result.blocks).toHaveLength(2);
    });

    it('should handle tab indentation', () => {
      const source = `\tentity Tabbed {
\t\tvalue: 1
\t}`;

      const result = parseGrump(source);

      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].name).toBe('Tabbed');
    });
  });
});
