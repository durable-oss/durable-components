/**
 * Template transformer tests
 *
 * Note: These are simplified tests. Full integration testing is done in compiler.test.ts
 */

import { transformTemplate } from '../../transformer/template-transformer';
import type { ElementNode } from '../../types/ir';

describe('Template Transformer', () => {
  describe('Basic transformations', () => {
    it('should transform empty nodes to div', () => {
      const result = transformTemplate([]);
      expect(result.type).toBe('element');
      expect((result as ElementNode).name).toBe('div');
      expect((result as ElementNode).children).toHaveLength(0);
    });

    it('should transform single element', () => {
      const nodes = [{
        type: 'Element' as const,
        name: 'div',
        attributes: [],
        children: [],
        start: 0,
        end: 10
      }];

      const result = transformTemplate(nodes);
      expect(result.type).toBe('element');
      expect((result as ElementNode).name).toBe('div');
    });

    it('should wrap multiple root nodes in div', () => {
      const nodes = [
        {
          type: 'Element' as const,
          name: 'p',
          attributes: [],
          children: [],
          start: 0,
          end: 5
        },
        {
          type: 'Element' as const,
          name: 'p',
          attributes: [],
          children: [],
          start: 5,
          end: 10
        }
      ];

      const result = transformTemplate(nodes) as ElementNode;
      expect(result.type).toBe('element');
      expect(result.name).toBe('div');
      expect(result.children).toHaveLength(2);
    });

    it('should transform text node', () => {
      const nodes = [{
        type: 'Text' as const,
        data: 'Hello World',
        start: 0,
        end: 11
      }];

      const result = transformTemplate(nodes);
      expect(result.type).toBe('text');
      expect((result as any).content).toBe('Hello World');
    });

    it('should transform element with children', () => {
      const nodes = [{
        type: 'Element' as const,
        name: 'div',
        attributes: [],
        children: [{
          type: 'Element' as const,
          name: 'p',
          attributes: [],
          children: [{
            type: 'Text' as const,
            data: 'Content',
            start: 0,
            end: 7
          }],
          start: 0,
          end: 20
        }],
        start: 0,
        end: 30
      }];

      const result = transformTemplate(nodes) as ElementNode;
      expect(result.children).toBeDefined();
      expect(result.children).toHaveLength(1);
      expect((result.children![0] as ElementNode).type).toBe('element');
      expect((result.children![0] as ElementNode).name).toBe('p');
    });
  });
});
