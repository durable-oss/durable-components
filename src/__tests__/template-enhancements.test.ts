/**
 * Tests for template enhancements (template literals, prop shorthand, else-if, etc.)
 */

import { compile } from '../index';

describe('Template Enhancements', () => {
  describe('Template Literal Support', () => {
    it('should handle template literals in $derived() blocks', () => {
      const source = `
<script>
  let size = $state(100);
  let color = $state('red');
  const styles = $derived(\`width: \${size}px; color: \${color}\`);
</script>

<template>
  <div style={styles}>Test</div>
</template>
      `.trim();

      expect(() => {
        const result = compile(source, {
          filename: 'TemplateLiteral.dce',
          target: 'react'
        });
        expect(result.js.code).toBeDefined();
        expect(result.js.code).toContain('useMemo');
        expect(result.js.code).toContain('`width: ${size}px; color: ${color}`');
      }).not.toThrow();
    });

    it('should handle multi-line template literals in $derived()', () => {
      const source = `
<script>
  let color = $state('red');
  const dropdownStyles = $derived(\`
    position: absolute;
    top: 100%;
    left: 0;
    color: \${color};
  \`);
</script>

<template>
  <div style={dropdownStyles}>Test</div>
</template>
      `.trim();

      expect(() => {
        const result = compile(source, {
          filename: 'MultilineTemplate.dce',
          target: 'react'
        });
        expect(result.js.code).toBeDefined();
        expect(result.js.code).toContain('position: absolute');
      }).not.toThrow();
    });

    // Note: Template literals in template expressions ({`...`}) are not supported
    // because they need to be passed through Acorn parser. Use concatenation instead:
    // {'Hello ' + name + '!'} or extract to a $derived() value.
  });

  describe('Prop Shorthand Syntax', () => {
    it('should expand shorthand prop syntax', () => {
      const source = `
<script>
  let palette = $state(['red', 'blue']);
  let disabled = $state(false);
</script>

<template>
  <ColorPicker {palette} {disabled} />
</template>
      `.trim();

      expect(() => {
        const result = compile(source, {
          filename: 'PropShorthand.dce',
          target: 'react'
        });
        expect(result.js.code).toBeDefined();
        expect(result.js.code).toContain('palette={palette}');
        expect(result.js.code).toContain('disabled={disabled}');
        expect(result.js.code).not.toContain('{palette}=""');
      }).not.toThrow();
    });

    it('should handle mixed shorthand and regular props', () => {
      const source = `
<script>
  let palette = $state(['red', 'blue']);
  let size = $state('medium');
</script>

<template>
  <Selector {palette} size="large" {disabled} />
</template>
      `.trim();

      expect(() => {
        const result = compile(source, {
          filename: 'MixedProps.dce',
          target: 'react'
        });
        expect(result.js.code).toBeDefined();
        expect(result.js.code).toContain('palette={palette}');
        expect(result.js.code).toContain('size="large"');
      }).not.toThrow();
    });
  });

  describe('typeof Operator Support', () => {
    it('should handle typeof in template conditionals', () => {
      const source = `
<script>
  let content = $state('hello');
</script>

<template>
  {#if typeof content === 'string'}
    <div>Content is a string: {content}</div>
  {/if}
</template>
      `.trim();

      expect(() => {
        const result = compile(source, {
          filename: 'TypeofOperator.dce',
          target: 'react'
        });
        expect(result.js.code).toBeDefined();
        expect(result.js.code).toContain('typeof content');
        expect(result.js.code).not.toContain('typeofcontent');
      }).not.toThrow();
    });

    it('should handle typeof with other operators', () => {
      const source = `
<script>
  let value = $state(null);
</script>

<template>
  {#if typeof value !== 'undefined' && value !== null}
    <div>Value is defined: {value}</div>
  {/if}
</template>
      `.trim();

      expect(() => {
        const result = compile(source, {
          filename: 'TypeofComplex.dce',
          target: 'react'
        });
        expect(result.js.code).toBeDefined();
        expect(result.js.code).toContain('typeof value');
      }).not.toThrow();
    });
  });

  describe('{:else if} Block Support', () => {
    it('should handle {:else if} blocks', () => {
      const source = `
<script>
  let content = $state('hello');
</script>

<template>
  {#if typeof content === 'string'}
    <div>String content</div>
  {:else if content}
    <div>Truthy content</div>
  {:else}
    <div>Falsy content</div>
  {/if}
</template>
      `.trim();

      expect(() => {
        const result = compile(source, {
          filename: 'ElseIf.dce',
          target: 'react'
        });
        expect(result.js.code).toBeDefined();
        expect(result.js.code).toContain('?');
        expect(result.js.code).toContain(':');
      }).not.toThrow();
    });

    it('should handle multiple {:else if} blocks', () => {
      const source = `
<script>
  let status = $state('pending');
</script>

<template>
  {#if status === 'active'}
    <div class="green">Active</div>
  {:else if status === 'pending'}
    <div class="yellow">Pending</div>
  {:else if status === 'inactive'}
    <div class="red">Inactive</div>
  {:else}
    <div class="gray">Unknown</div>
  {/if}
</template>
      `.trim();

      expect(() => {
        const result = compile(source, {
          filename: 'MultipleElseIf.dce',
          target: 'react'
        });
        expect(result.js.code).toBeDefined();
      }).not.toThrow();
    });

    it('should handle {:else if} without final {:else}', () => {
      const source = `
<script>
  let count = $state(5);
</script>

<template>
  {#if count > 10}
    <div>Many</div>
  {:else if count > 5}
    <div>Some</div>
  {:else if count > 0}
    <div>Few</div>
  {/if}
</template>
      `.trim();

      expect(() => {
        const result = compile(source, {
          filename: 'ElseIfNoElse.dce',
          target: 'react'
        });
        expect(result.js.code).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('Complex Inline Expressions', () => {
    it('should handle ternary operators in attributes', () => {
      const source = `
<script>
  let currentStep = $state(0);
  let disabled = $state(false);
</script>

<template>
  <div style={currentStep === 0 ? 'opacity: 0.3' : 'opacity: 1'}>Step</div>
</template>
      `.trim();

      expect(() => {
        const result = compile(source, {
          filename: 'TernaryAttribute.dce',
          target: 'react'
        });
        expect(result.js.code).toBeDefined();
        expect(result.js.code).toContain('?');
        expect(result.js.code).toContain('opacity');
      }).not.toThrow();
    });

    it('should handle logical operators in template expressions', () => {
      const source = `
<script>
  let user = $state(null);
  let defaultName = $state('Guest');
</script>

<template>
  <div>Welcome, {user || defaultName}!</div>
</template>
      `.trim();

      expect(() => {
        const result = compile(source, {
          filename: 'LogicalOperator.dce',
          target: 'react'
        });
        expect(result.js.code).toBeDefined();
        expect(result.js.code).toContain('||');
      }).not.toThrow();
    });

    it('should handle array and object expressions', () => {
      const source = `
<script>
  let items = $state([1, 2, 3]);
</script>

<template>
  <div>{items.filter(x => x > 1).map(x => x * 2).join(', ')}</div>
</template>
      `.trim();

      expect(() => {
        const result = compile(source, {
          filename: 'ArrayExpression.dce',
          target: 'react'
        });
        expect(result.js.code).toBeDefined();
        expect(result.js.code).toContain('filter');
        expect(result.js.code).toContain('map');
      }).not.toThrow();
    });
  });

  describe('Combined Scenarios', () => {
    it('should handle all enhancements together', () => {
      const source = `
<script>
  let content = $state('test');
  let palette = $state(['red', 'blue']);
  let size = $state(100);
  const styles = $derived(\`width: \${size}px; color: red\`);
</script>

<template>
  <div>
    {#if typeof content === 'string'}
      <ColorPicker {palette} {size} style={styles} />
    {:else if content}
      <div>Fallback</div>
    {:else}
      <div>Empty</div>
    {/if}
  </div>
</template>
      `.trim();

      expect(() => {
        const result = compile(source, {
          filename: 'Combined.dce',
          target: 'react'
        });
        expect(result.js.code).toBeDefined();
        expect(result.js.code).toContain('typeof content');
        expect(result.js.code).toContain('palette={palette}');
        expect(result.js.code).toContain('`width: ${size}px; color: red`');
      }).not.toThrow();
    });
  });
});
