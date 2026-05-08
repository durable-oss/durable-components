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
      const { template } = transformTemplate([]);
      expect(template.type).toBe('element');
      expect((template as ElementNode).name).toBe('div');
      expect((template as ElementNode).children).toHaveLength(0);
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

      const { template } = transformTemplate(nodes);
      expect(template.type).toBe('element');
      expect((template as ElementNode).name).toBe('div');
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

      const { template } = transformTemplate(nodes);
      expect(template.type).toBe('element');
      expect((template as ElementNode).name).toBe('div');
      expect((template as ElementNode).children).toHaveLength(2);
    });

    it('should transform text node', () => {
      const nodes = [{
        type: 'Text' as const,
        data: 'Hello World',
        start: 0,
        end: 11
      }];

      const { template } = transformTemplate(nodes);
      expect(template.type).toBe('text');
      expect((template as any).content).toBe('Hello World');
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

      const { template } = transformTemplate(nodes);
      expect((template as ElementNode).children).toBeDefined();
      expect((template as ElementNode).children).toHaveLength(1);
      expect(((template as ElementNode).children![0] as ElementNode).type).toBe('element');
      expect(((template as ElementNode).children![0] as ElementNode).name).toBe('p');
    });
  });

  describe('Render blocks', () => {
    it('should transform render block without arguments', () => {
      const nodes = [{
        type: 'RenderBlock' as const,
        expression: {
          type: 'Program',
          body: [{
            type: 'ExpressionStatement',
            expression: {
              type: 'CallExpression',
              callee: { type: 'Identifier', name: 'children' },
              arguments: []
            }
          }]
        },
        snippet: 'children',
        args: undefined,
        start: 0,
        end: 20
      }];

      const { template } = transformTemplate(nodes);
      expect(template.type).toBe('render');
      expect((template as any).snippet).toBe('children');
      expect((template as any).args).toBeUndefined();
    });

    it('should transform render block with arguments', () => {
      const nodes = [{
        type: 'RenderBlock' as const,
        expression: {
          type: 'Program',
          body: [{
            type: 'ExpressionStatement',
            expression: {
              type: 'CallExpression',
              callee: { type: 'Identifier', name: 'header' },
              arguments: [
                { type: 'Identifier', name: 'title' },
                { type: 'ObjectExpression', properties: [] }
              ]
            }
          }]
        },
        snippet: 'header',
        args: [
          { type: 'Identifier', name: 'title' },
          { type: 'ObjectExpression', properties: [] }
        ],
        start: 0,
        end: 30
      }];

      const { template } = transformTemplate(nodes);
      expect(template.type).toBe('render');
      expect((template as any).snippet).toBe('header');
      expect((template as any).args).toBeDefined();
      expect((template as any).args).toHaveLength(2);
    });

    it('should transform render block inside element', () => {
      const nodes = [{
        type: 'Element' as const,
        name: 'div',
        attributes: [],
        children: [{
          type: 'RenderBlock' as const,
          expression: {
            type: 'Program',
            body: [{
              type: 'ExpressionStatement',
              expression: {
                type: 'CallExpression',
                callee: { type: 'Identifier', name: 'children' },
                arguments: []
              }
            }]
          },
          snippet: 'children',
          args: undefined,
          start: 5,
          end: 25
        }],
        start: 0,
        end: 31
      }];

      const { template } = transformTemplate(nodes);
      expect(template.type).toBe('element');
      expect((template as ElementNode).name).toBe('div');
      expect((template as ElementNode).children).toHaveLength(1);
      expect((template as ElementNode).children[0].type).toBe('render');
      expect(((template as ElementNode).children[0] as any).snippet).toBe('children');
    });
  });
});
