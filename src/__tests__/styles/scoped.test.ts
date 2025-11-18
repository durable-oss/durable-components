/**
 * Scoped styles tests
 */

import { generateScopedCSS, addScopeToTemplate } from '../../styles/scoped';
import type { TemplateNode } from '../../types/ir';

describe('Scoped Styles', () => {
  describe('generateScopedCSS', () => {
    it('should generate scoped CSS with attribute selector', () => {
      const css = '.container { padding: 1rem; }';
      const { css: result, scopeId } = generateScopedCSS(css, 'MyComponent');

      expect(result.code).toContain('[data-');
      expect(result.code).toContain('.container');
      expect(scopeId).toBeTruthy();
      expect(scopeId).toMatch(/^dce-/);
    });

    it('should handle empty CSS', () => {
      const { css, scopeId } = generateScopedCSS('', 'Component');

      expect(css.code).toBe('');
      expect(scopeId).toBe('');
    });

    it('should handle whitespace-only CSS', () => {
      const { css, scopeId } = generateScopedCSS('   ', 'Component');

      expect(css.code).toBe('');
      expect(scopeId).toBe('');
    });

    it('should scope simple selector', () => {
      const css = 'p { color: blue; }';
      const { css: result } = generateScopedCSS(css, 'Test');

      expect(result.code).toMatch(/p\[data-dce-[a-z0-9]+\]/);
    });

    it('should scope multiple selectors', () => {
      const css = 'h1, h2, h3 { margin: 0; }';
      const { css: result } = generateScopedCSS(css, 'Test');

      expect(result.code).toMatch(/h1\[data-/);
      expect(result.code).toMatch(/h2\[data-/);
      expect(result.code).toMatch(/h3\[data-/);
    });

    it('should scope pseudo-classes', () => {
      const css = 'button:hover { background: red; }';
      const { css: result } = generateScopedCSS(css, 'Test');

      expect(result.code).toMatch(/button\[data-[^\]]+\]:hover/);
    });

    it('should scope pseudo-elements', () => {
      const css = 'p::before { content: "→"; }';
      const { css: result } = generateScopedCSS(css, 'Test');

      expect(result.code).toMatch(/p\[data-[^\]]+\]::before/);
    });

    it('should handle class selectors', () => {
      const css = '.container { padding: 1rem; }';
      const { css: result } = generateScopedCSS(css, 'Test');

      expect(result.code).toMatch(/\.container\[data-/);
    });

    it('should handle id selectors', () => {
      const css = '#main { width: 100%; }';
      const { css: result } = generateScopedCSS(css, 'Test');

      expect(result.code).toMatch(/#main\[data-/);
    });

    it('should handle complex selectors', () => {
      const css = '.container .item:hover { color: red; }';
      const { css: result } = generateScopedCSS(css, 'Test');

      expect(result.code).toContain('[data-');
    });

    it('should handle multiple rules', () => {
      const css = `
        .container { padding: 1rem; }
        .item { margin: 0.5rem; }
        .active { color: blue; }
      `;
      const { css: result } = generateScopedCSS(css, 'Test');

      expect(result.code).toMatch(/\.container\[data-/);
      expect(result.code).toMatch(/\.item\[data-/);
      expect(result.code).toMatch(/\.active\[data-/);
    });

    it('should skip @keyframes', () => {
      const css = '@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }';
      const { css: result } = generateScopedCSS(css, 'Test');

      expect(result.code).toContain('@keyframes');
    });

    it('should scope rules inside @media', () => {
      const css = '@media (min-width: 768px) { .container { width: 750px; } }';
      const { css: result } = generateScopedCSS(css, 'Test');

      expect(result.code).toContain('@media');
      expect(result.code).toMatch(/\.container\[data-/);
    });

    it('should scope rules inside @supports', () => {
      const css = '@supports (display: grid) { .grid { display: grid; } }';
      const { css: result } = generateScopedCSS(css, 'Test');

      expect(result.code).toContain('@supports');
      expect(result.code).toMatch(/\.grid\[data-/);
    });

    it('should generate consistent scope ID for same component and styles', () => {
      const css = '.test { color: red; }';
      const { scopeId: id1 } = generateScopedCSS(css, 'Component');
      const { scopeId: id2 } = generateScopedCSS(css, 'Component');

      expect(id1).toBe(id2);
    });

    it('should generate different scope ID for different component names', () => {
      const css = '.test { color: red; }';
      const { scopeId: id1 } = generateScopedCSS(css, 'Component1');
      const { scopeId: id2 } = generateScopedCSS(css, 'Component2');

      expect(id1).not.toBe(id2);
    });

    it('should generate different scope ID for different styles', () => {
      const { scopeId: id1 } = generateScopedCSS('.a { color: red; }', 'Test');
      const { scopeId: id2 } = generateScopedCSS('.b { color: blue; }', 'Test');

      expect(id1).not.toBe(id2);
    });

    it('should handle nested selectors', () => {
      const css = 'div p span { color: red; }';
      const { css: result } = generateScopedCSS(css, 'Test');

      expect(result.code).toContain('[data-');
    });

    it('should handle attribute selectors', () => {
      const css = 'input[type="text"] { border: 1px solid; }';
      const { css: result } = generateScopedCSS(css, 'Test');

      expect(result.code).toContain('[data-');
    });
  });

  describe('addScopeToTemplate', () => {
    it('should add scope to element node', () => {
      const node: TemplateNode = {
        type: 'element',
        name: 'div',
        children: []
      };

      const result = addScopeToTemplate(node, 'dce-abc123');
      expect(result.type).toBe('element');
      expect((result as any).bindings).toBeDefined();
      expect((result as any).bindings['data-dce-abc123']).toBe('""');
    });

    it('should return node unchanged if scopeId is empty', () => {
      const node: TemplateNode = {
        type: 'element',
        name: 'div',
        children: []
      };

      const result = addScopeToTemplate(node, '');
      expect(result).toEqual(node);
    });

    it('should add scope to nested elements', () => {
      const node: TemplateNode = {
        type: 'element',
        name: 'div',
        children: [{
          type: 'element',
          name: 'p',
          children: []
        }]
      };

      const result = addScopeToTemplate(node, 'dce-xyz');
      expect((result as any).bindings).toBeDefined();
      expect((result as any).children[0].bindings).toBeDefined();
    });

    it('should add scope to if block children', () => {
      const consequent = [{
        type: 'element' as const,
        name: 'p',
        children: []
      }];
      const node: TemplateNode = {
        type: 'if',
        condition: 'show',
        consequent,
        children: consequent
      };

      const result = addScopeToTemplate(node, 'dce-test') as any;
      expect(result.consequent[0].bindings).toBeDefined();
    });

    it('should add scope to if-else block children', () => {
      const consequent = [{
        type: 'element' as const,
        name: 'p',
        children: []
      }];
      const alternate = [{
        type: 'element' as const,
        name: 'span',
        children: []
      }];
      const node: TemplateNode = {
        type: 'if',
        condition: 'show',
        consequent,
        alternate,
        children: [...consequent, ...alternate]
      };

      const result = addScopeToTemplate(node, 'dce-test') as any;
      expect(result.consequent[0].bindings).toBeDefined();
      expect(result.alternate[0].bindings).toBeDefined();
    });

    it('should add scope to each block children', () => {
      const node: TemplateNode = {
        type: 'each',
        expression: 'items',
        itemName: 'item',
        children: [{
          type: 'element',
          name: 'li',
          children: []
        }]
      };

      const result = addScopeToTemplate(node, 'dce-test') as any;
      expect(result.children[0].bindings).toBeDefined();
    });

    it('should add scope to slot fallback', () => {
      const fallback = [{
        type: 'element' as const,
        name: 'p',
        children: []
      }];
      const node: TemplateNode = {
        type: 'slot',
        fallback,
        children: fallback
      };

      const result = addScopeToTemplate(node, 'dce-test') as any;
      expect(result.fallback[0].bindings).toBeDefined();
    });

    it('should preserve existing bindings', () => {
      const node: TemplateNode = {
        type: 'element',
        name: 'div',
        bindings: { class: '"container"' },
        children: []
      };

      const result = addScopeToTemplate(node, 'dce-test') as any;
      expect(result.bindings['class']).toBe('"container"');
      expect(result.bindings['data-dce-test']).toBe('""');
    });

    it('should not modify text nodes', () => {
      const node: TemplateNode = {
        type: 'text',
        content: 'Hello'
      };

      const result = addScopeToTemplate(node, 'dce-test');
      expect(result).toEqual(node);
    });

    it('should not modify expression nodes', () => {
      const node: TemplateNode = {
        type: 'expression',
        expression: 'count'
      };

      const result = addScopeToTemplate(node, 'dce-test');
      expect(result).toEqual(node);
    });

    it('should handle deeply nested structures', () => {
      const consequent = [{
        type: 'each' as const,
        expression: 'items',
        itemName: 'item',
        children: [{
          type: 'element' as const,
          name: 'span',
          children: []
        }]
      }];
      const node: TemplateNode = {
        type: 'element',
        name: 'div',
        children: [{
          type: 'if',
          condition: 'show',
          consequent,
          children: consequent
        }]
      };

      const result = addScopeToTemplate(node, 'dce-deep') as any;
      const span = result.children[0].consequent[0].children[0];
      expect(span.bindings).toBeDefined();
      expect(span.bindings['data-dce-deep']).toBe('""');
    });
  });
});
