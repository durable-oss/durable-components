/**
 * Tests for parser enhancements:
 * - Template literals in attributes
 * - Svelte #each key syntax
 * - Template literals in $derived expressions
 * - Multi-line template literals
 */

import { describe, it, expect } from 'vitest';
import { parseTemplate } from '../parser/template-parser';

describe('Parser Enhancements', () => {
  describe('Template Literals in Attributes', () => {
    it('should parse template literals in style attributes', () => {
      const template = `<div style={\`border-radius: \${customBorderRadius};\`}></div>`;
      const result = parseTemplate(template);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('Element');
      const element = result[0] as any;
      expect(element.attributes).toHaveLength(1);
      expect(element.attributes[0].name).toBe('style');
      expect(element.attributes[0].value[0].type).toBe('MustacheTag');
      expect(element.attributes[0].value[0].expression.body[0].expression.type).toBe('TemplateLiteral');
    });

    it('should parse template literals in aria attributes', () => {
      const template = `<div aria-activedescendant={selectedIndex >= 0 ? \`option-\${selectedIndex}\` : undefined}></div>`;
      const result = parseTemplate(template);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('Element');
      const element = result[0] as any;
      expect(element.attributes).toHaveLength(1);
      expect(element.attributes[0].name).toBe('aria-activedescendant');
      expect(element.attributes[0].value[0].type).toBe('MustacheTag');
    });

    it('should parse multi-line template literals in attributes', () => {
      const template = `<div style={\`
        width: \${width};
        height: \${height};
      \`}></div>`;
      const result = parseTemplate(template);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('Element');
      const element = result[0] as any;
      expect(element.attributes).toHaveLength(1);
      expect(element.attributes[0].name).toBe('style');
      expect(element.attributes[0].value[0].type).toBe('MustacheTag');
      expect(element.attributes[0].value[0].expression.body[0].expression.type).toBe('TemplateLiteral');
    });

    it('should parse template literals in event handlers', () => {
      const template = `<button on:click={() => console.log(\`Clicked: \${count}\`)}>Click</button>`;
      const result = parseTemplate(template);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('Element');
      const element = result[0] as any;
      expect(element.attributes).toHaveLength(1);
      expect(element.attributes[0].type).toBe('EventHandler');
      expect(element.attributes[0].name).toBe('click');
    });

    it('should parse template literals in class directives', () => {
      const template = `<div class:active={status === \`active-\${id}\`}></div>`;
      const result = parseTemplate(template);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('Element');
      const element = result[0] as any;
      expect(element.attributes).toHaveLength(1);
      expect(element.attributes[0].type).toBe('Class');
      expect(element.attributes[0].name).toBe('active');
    });
  });

  describe('Svelte #each Key Syntax', () => {
    it('should parse #each with key expression', () => {
      const template = `{#each items as item (item.id)}
        <div>{item.name}</div>
      {/each}`;
      const result = parseTemplate(template);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('EachBlock');
      const eachBlock = result[0] as any;
      expect(eachBlock.context).toBe('item');
      expect(eachBlock.key).toBeDefined();
      expect(eachBlock.key.body[0].expression.type).toBe('MemberExpression');
    });

    it('should parse #each with index and key expression', () => {
      const template = `{#each items as item, index (item.id)}
        <div>{item.name}</div>
      {/each}`;
      const result = parseTemplate(template);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('EachBlock');
      const eachBlock = result[0] as any;
      expect(eachBlock.context).toBe('item');
      expect(eachBlock.index).toBe('index');
      expect(eachBlock.key).toBeDefined();
    });

    it('should parse #each without key (backward compatibility)', () => {
      const template = `{#each items as item}
        <div>{item.name}</div>
      {/each}`;
      const result = parseTemplate(template);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('EachBlock');
      const eachBlock = result[0] as any;
      expect(eachBlock.context).toBe('item');
      expect(eachBlock.key).toBeUndefined();
    });

    it('should parse #each with complex key expression', () => {
      const template = `{#each items as item (item.id + '-' + item.type)}
        <div>{item.name}</div>
      {/each}`;
      const result = parseTemplate(template);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('EachBlock');
      const eachBlock = result[0] as any;
      expect(eachBlock.context).toBe('item');
      expect(eachBlock.key).toBeDefined();
      expect(eachBlock.key.body[0].expression.type).toBe('BinaryExpression');
    });
  });

  describe('Template Literals in Mustache Tags', () => {
    it('should parse template literals in mustache tags', () => {
      const template = `<div>{\`Count: \${count}\`}</div>`;
      const result = parseTemplate(template);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('Element');
      const element = result[0] as any;
      expect(element.children).toHaveLength(1);
      expect(element.children[0].type).toBe('MustacheTag');
      expect(element.children[0].expression.body[0].expression.type).toBe('TemplateLiteral');
    });

    it('should parse complex expressions with template literals', () => {
      const template = `<div>{isActive ? \`active-\${id}\` : 'inactive'}</div>`;
      const result = parseTemplate(template);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('Element');
      const element = result[0] as any;
      expect(element.children).toHaveLength(1);
      expect(element.children[0].type).toBe('MustacheTag');
      expect(element.children[0].expression.body[0].expression.type).toBe('ConditionalExpression');
    });
  });

  describe('Template Literals in @const Tags', () => {
    it('should parse template literals in @const declarations', () => {
      const template = `{@const containerStyle = \`width: \${width}; height: \${height};\`}`;
      const result = parseTemplate(template);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('ConstTag');
      const constTag = result[0] as any;
      expect(constTag.name).toBe('containerStyle');
      expect(constTag.expression.body[0].expression.type).toBe('TemplateLiteral');
    });

    it('should parse multi-line template literals in @const', () => {
      const template = `{@const styles = \`
        display: flex;
        width: \${width}px;
        height: \${height}px;
      \`}`;
      const result = parseTemplate(template);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('ConstTag');
      const constTag = result[0] as any;
      expect(constTag.name).toBe('styles');
      expect(constTag.expression.body[0].expression.type).toBe('TemplateLiteral');
    });

    it('should parse nested objects with template literals in @const', () => {
      const template = `{@const config = ({ url: \`/api/\${endpoint}\`, method: 'GET' })}`;
      const result = parseTemplate(template);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('ConstTag');
      const constTag = result[0] as any;
      expect(constTag.name).toBe('config');
      expect(constTag.expression.body[0].expression.type).toBe('ObjectExpression');
    });
  });

  describe('Complex Nested Scenarios', () => {
    it('should parse template literals in nested structures', () => {
      const template = `
        {#each items as item (item.id)}
          <div style={\`color: \${item.color};\`}>
            {item.name}
          </div>
        {/each}
      `;
      const result = parseTemplate(template);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('EachBlock');
      const eachBlock = result[0] as any;
      expect(eachBlock.key).toBeDefined();
      expect(eachBlock.children).toHaveLength(1);
      expect(eachBlock.children[0].type).toBe('Element');
      expect(eachBlock.children[0].attributes[0].name).toBe('style');
    });

    it('should parse template literals with nested expressions', () => {
      const template = `<div title={\`Total: \${items.map(i => i.price).reduce((a, b) => a + b, 0)}\`}></div>`;
      const result = parseTemplate(template);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('Element');
      const element = result[0] as any;
      expect(element.attributes[0].name).toBe('title');
      expect(element.attributes[0].value[0].type).toBe('MustacheTag');
    });

    it('should parse template literals in @const with conditional operators', () => {
      const template = `{@const message = \`Status: \${isActive ? 'Active' : 'Inactive'}\`}`;
      const result = parseTemplate(template);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('ConstTag');
      const constTag = result[0] as any;
      expect(constTag.name).toBe('message');
      expect(constTag.expression.body[0].expression.type).toBe('TemplateLiteral');
    });
  });
});
