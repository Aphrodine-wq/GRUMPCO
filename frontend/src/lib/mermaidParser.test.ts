/**
 * Mermaid Parser Tests
 *
 * Comprehensive tests for Mermaid diagram parsing utilities
 */

import { describe, it, expect } from 'vitest';
import { parseMermaidNodes, findComponentByNodeId, findSvgNodeElement } from './mermaidParser';

describe('mermaidParser', () => {
  describe('parseMermaidNodes', () => {
    it('should return empty object for empty input', () => {
      expect(parseMermaidNodes('')).toEqual({});
    });

    it('should return empty object for whitespace only', () => {
      expect(parseMermaidNodes('   \n  ')).toEqual({});
    });

    it('should parse simple node definitions with square brackets', () => {
      const code = `
        flowchart TD
        A[Start]
        B[Process]
        C[End]
      `;

      const nodes = parseMermaidNodes(code);

      expect(nodes['A'].label).toBe('Start');
      expect(nodes['B'].label).toBe('Process');
      expect(nodes['C'].label).toBe('End');
    });

    it('should parse node definitions with parentheses', () => {
      const code = `
        graph LR
        A(Database)
        B(Service)
      `;

      const nodes = parseMermaidNodes(code);

      expect(nodes['A'].label).toBe('Database');
      expect(nodes['B'].label).toBe('Service');
    });

    it('should parse node definitions with curly braces', () => {
      const code = `
        flowchart TD
        A{Decision}
        B{Another Decision}
      `;

      const nodes = parseMermaidNodes(code);

      expect(nodes['A'].label).toBe('Decision');
      expect(nodes['B'].label).toBe('Another Decision');
    });

    it('should parse nodes from edges', () => {
      const code = `
        flowchart TD
        A --> B
        B --> C
      `;

      const nodes = parseMermaidNodes(code);

      expect(nodes['A']).toBeDefined();
      expect(nodes['B']).toBeDefined();
      expect(nodes['C']).toBeDefined();
    });

    it('should handle various arrow styles', () => {
      const code = `
        flowchart TD
        A --> B
        C --- D
        E ==> F
        G -.-> H
      `;

      const nodes = parseMermaidNodes(code);

      expect(nodes['A']).toBeDefined();
      expect(nodes['B']).toBeDefined();
      expect(nodes['C']).toBeDefined();
      expect(nodes['D']).toBeDefined();
    });

    it('should use node ID as label when no label provided', () => {
      const code = `
        flowchart TD
        MyNode
      `;

      const nodes = parseMermaidNodes(code);

      expect(nodes['MyNode'].label).toBe('MyNode');
    });

    it('should update label when node is defined with label after edge', () => {
      const code = `
        flowchart TD
        A --> B
        A[Starting Point]
      `;

      const nodes = parseMermaidNodes(code);

      expect(nodes['A'].label).toBe('Starting Point');
    });

    it('should create node with ID as label for edge targets never explicitly defined', () => {
      const code = `
        flowchart TD
        A[Start] --> UndefinedTarget
      `;

      const nodes = parseMermaidNodes(code);

      // UndefinedTarget is only referenced as target of edge, never defined with label
      expect(nodes['UndefinedTarget']).toBeDefined();
      expect(nodes['UndefinedTarget'].id).toBe('UndefinedTarget');
      expect(nodes['UndefinedTarget'].label).toBe('UndefinedTarget');
    });

    it('should create both nodes from edge when neither is explicitly defined', () => {
      // This edge only has node IDs, no labels defined anywhere
      const code = `
        flowchart TD
        SourceNode --> TargetNode
      `;

      const nodes = parseMermaidNodes(code);

      // Both nodes should be created from the edge with ID as label
      expect(nodes['SourceNode']).toBeDefined();
      expect(nodes['SourceNode'].id).toBe('SourceNode');
      expect(nodes['SourceNode'].label).toBe('SourceNode');

      expect(nodes['TargetNode']).toBeDefined();
      expect(nodes['TargetNode'].id).toBe('TargetNode');
      expect(nodes['TargetNode'].label).toBe('TargetNode');
    });

    it('should handle mixed node definitions', () => {
      const code = `
        flowchart TD
        A[Start] --> B(Process)
        B --> C{Decision}
        C --> D[End]
      `;

      const nodes = parseMermaidNodes(code);

      expect(nodes['A'].label).toBe('Start');
      expect(nodes['B'].label).toBe('Process');
      expect(nodes['C'].label).toBe('Decision');
      expect(nodes['D'].label).toBe('End');
    });

    it('should handle C4 diagram syntax', () => {
      const code = `
        C4Context
        C4Container(db, "Database")
        C4Container(api, "API Server")
      `;

      const nodes = parseMermaidNodes(code);

      expect(nodes['db']).toBeDefined();
      expect(nodes['db'].label).toBe('Database');
      expect(nodes['db'].type).toBe('c4');
      expect(nodes['api'].label).toBe('API Server');
    });

    it('should handle flowchart direction variations', () => {
      const directions = ['TD', 'TB', 'BT', 'LR', 'RL'];

      for (const dir of directions) {
        const code = `flowchart ${dir}\nA[Node]`;
        const nodes = parseMermaidNodes(code);
        expect(nodes['A']).toBeDefined();
      }
    });
  });

  describe('findComponentByNodeId', () => {
    const components = [
      { id: 'user-service', name: 'User Service' },
      { id: 'db', name: 'Database' },
      { id: 'api', name: 'API Gateway' },
    ];

    it('should return null for empty components', () => {
      expect(findComponentByNodeId('id', 'label', [])).toBeNull();
    });

    it('should find by exact ID match', () => {
      const result = findComponentByNodeId('db', 'anything', components);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('db');
    });

    it('should find by case-insensitive ID match', () => {
      const result = findComponentByNodeId('DB', 'anything', components);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('db');
    });

    it('should find by exact label match', () => {
      const result = findComponentByNodeId('unknown', 'Database', components);

      expect(result).not.toBeNull();
      expect(result?.name).toBe('Database');
    });

    it('should find by partial label match', () => {
      const result = findComponentByNodeId('unknown', 'User', components);

      expect(result).not.toBeNull();
      expect(result?.name).toBe('User Service');
    });

    it('should find by partial ID match', () => {
      const result = findComponentByNodeId('user', 'unknown', components);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('user-service');
    });

    it('should return null when no match found', () => {
      const result = findComponentByNodeId('nonexistent', 'nothing', components);

      expect(result).toBeNull();
    });

    it('should prefer exact ID match over label match', () => {
      const specialComponents = [
        { id: 'exact', name: 'Different' },
        { id: 'other', name: 'exact' },
      ];

      const result = findComponentByNodeId('exact', 'exact', specialComponents);

      expect(result?.id).toBe('exact');
    });
  });

  describe('findSvgNodeElement', () => {
    it('should return null for null svg', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(findSvgNodeElement(null as any, 'node')).toBeNull();
    });

    it('should return null for empty nodeId', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      expect(findSvgNodeElement(svg, '')).toBeNull();
    });

    it('should find node by class name', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const node = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      node.classList.add('node-TestNode');
      svg.appendChild(node);

      const result = findSvgNodeElement(svg, 'TestNode');

      expect(result).toBe(node);
    });

    it('should find node by ID', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const node = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      node.id = 'MyNode';
      svg.appendChild(node);

      const result = findSvgNodeElement(svg, 'MyNode');

      expect(result).toBe(node);
    });

    it('should find node by text content', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.classList.add('node');
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.textContent = 'TestLabel';
      group.appendChild(text);
      svg.appendChild(group);

      const result = findSvgNodeElement(svg, 'TestLabel');

      expect(result).toBe(group);
    });

    it('should find node by data attribute', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const node = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      node.setAttribute('data-node-id', 'DataNode');
      svg.appendChild(node);

      const result = findSvgNodeElement(svg, 'DataNode');

      expect(result).toBe(node);
    });

    it('should return null when node not found', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

      const result = findSvgNodeElement(svg, 'NonExistent');

      expect(result).toBeNull();
    });

    it('should traverse parent elements to find g tag when text matches', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const outerGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      const innerContainer = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'foreignObject'
      );
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.textContent = 'NestedLabel';
      innerContainer.appendChild(text);
      outerGroup.appendChild(innerContainer);
      svg.appendChild(outerGroup);

      const result = findSvgNodeElement(svg, 'NestedLabel');

      // Should traverse up to find the g element
      expect(result).toBe(outerGroup);
    });

    it('should return text element itself when no parent g or node class found', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.textContent = 'OrphanLabel';
      svg.appendChild(text);

      const result = findSvgNodeElement(svg, 'OrphanLabel');

      // Should return the text element itself since no parent container found
      expect(result).toBe(text);
    });
  });
});
