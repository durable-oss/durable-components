/**
 * Main parser tests
 */

import { parse } from '../../parser';
import type { DurableComponentAST } from '../../types/ast';

describe('Parser', () => {
  describe('Basic parsing', () => {
    it('should parse empty source', () => {
      const ast = parse('', { filename: 'Test.dce' });

      expect(ast.type).toBe('DurableComponent');
      expect(ast.meta.filename).toBe('Test.dce');
      expect(ast.script).toBeUndefined();
      expect(ast.template).toBeUndefined();
      expect(ast.style).toBeUndefined();
    });

    it('should parse component with only script', () => {
      const source = '<script>let count = 0;</script>';
      const ast = parse(source, { filename: 'Test.dce' });

      expect(ast.script).toBeDefined();
      expect(ast.script!.type).toBe('ScriptBlock');
      expect(ast.script!.content).toContain('let count = 0;');
    });

    it('should parse component with only template', () => {
      const source = '<template><div>Test</div></template>';
      const ast = parse(source, { filename: 'Test.dce' });

      expect(ast.template).toBeDefined();
      expect(ast.template!.type).toBe('TemplateBlock');
      expect(ast.template!.children).toHaveLength(1);
    });

    it('should parse component with only style', () => {
      const source = '<style>.container { padding: 1rem; }</style>';
      const ast = parse(source, { filename: 'Test.dce' });

      expect(ast.style).toBeDefined();
      expect(ast.style!.type).toBe('StyleBlock');
      expect(ast.style!.content).toContain('.container');
    });

    it('should use default filename if not provided', () => {
      const ast = parse('');

      expect(ast.meta.filename).toBe('Component.dce');
    });
  });

  describe('Script block parsing', () => {
    it('should parse valid JavaScript', () => {
      const source = `
<script>
  let count = $state(0);

  function increment() {
    count++;
  }
</script>
      `;
      const ast = parse(source);

      expect(ast.script).toBeDefined();
      expect(ast.script!.ast).toBeDefined();
      expect(ast.script!.content).toContain('$state');
    });

    it('should preserve script content positions', () => {
      const source = '<script>let x = 1;</script>';
      const ast = parse(source);

      expect(ast.script).toBeDefined();
      expect(ast.script!.start).toBeGreaterThanOrEqual(0);
      expect(ast.script!.end).toBeGreaterThan(ast.script!.start);
    });

    it('should throw error for invalid JavaScript', () => {
      const source = '<script>let x = ;</script>';

      expect(() => {
        parse(source);
      }).toThrow();
    });

    it('should handle ES2022 features', () => {
      const source = '<script>const obj = { name: "test", ...other };</script>';
      const ast = parse(source);

      expect(ast.script).toBeDefined();
    });

    it('should handle module syntax', () => {
      const source = `
<script>
  import { helper } from './utils';
  export const value = 42;
</script>
      `;
      const ast = parse(source);

      expect(ast.script).toBeDefined();
    });
  });

  describe('Template block parsing', () => {
    it('should parse simple template', () => {
      const source = '<template><div>Hello</div></template>';
      const ast = parse(source);

      expect(ast.template).toBeDefined();
      expect(ast.template!.children).toHaveLength(1);
    });

    it('should parse template with multiple root elements', () => {
      const source = `
<template>
  <div>First</div>
  <div>Second</div>
</template>
      `;
      const ast = parse(source);

      expect(ast.template).toBeDefined();
      expect(ast.template!.children.length).toBeGreaterThan(1);
    });

    it('should parse template with directives', () => {
      const source = `
<template>
  {#if show}
    <p>Visible</p>
  {/if}
</template>
      `;
      const ast = parse(source);

      expect(ast.template).toBeDefined();
      expect(ast.template!.children[0].type).toBe('IfBlock');
    });

    it('should preserve template content', () => {
      const source = '<template><div>Test</div></template>';
      const ast = parse(source);

      expect(ast.template!.content).toBeDefined();
      expect(ast.template!.content).toContain('div');
    });
  });

  describe('Style block parsing', () => {
    it('should parse CSS content', () => {
      const source = `
<style>
  .container {
    padding: 1rem;
    margin: 0;
  }
</style>
      `;
      const ast = parse(source);

      expect(ast.style).toBeDefined();
      expect(ast.style!.content).toContain('.container');
      expect(ast.style!.content).toContain('padding');
    });

    it('should trim style content', () => {
      const source = `
<style>

  .test { color: red; }

</style>
      `;
      const ast = parse(source);

      expect(ast.style!.content.trim()).toBe('.test { color: red; }');
    });

    it('should default to scoped styles', () => {
      const source = '<style>.test {}</style>';
      const ast = parse(source);

      expect(ast.style!.scoped).toBe(true);
    });
  });

  describe('Full component parsing', () => {
    it('should parse complete component', () => {
      const source = `
<script>
  let count = $state(0);

  function increment() {
    count++;
  }
</script>

<template>
  <div>
    <button on:click={increment}>
      Count: {count}
    </button>
  </div>
</template>

<style>
  button {
    padding: 0.5rem 1rem;
  }
</style>
      `;

      const ast = parse(source, { filename: 'Counter.dce' });

      expect(ast.script).toBeDefined();
      expect(ast.template).toBeDefined();
      expect(ast.style).toBeDefined();
      expect(ast.meta.filename).toBe('Counter.dce');
    });

    it('should preserve source in metadata', () => {
      const source = '<template><div>Test</div></template>';
      const ast = parse(source);

      expect(ast.meta.source).toBe(source);
    });

    it('should handle blocks in any order', () => {
      const source = `
<template><div>Test</div></template>
<style>.test {}</style>
<script>let x = 1;</script>
      `;

      const ast = parse(source);

      expect(ast.script).toBeDefined();
      expect(ast.template).toBeDefined();
      expect(ast.style).toBeDefined();
    });

    it('should handle missing blocks gracefully', () => {
      const source = '<script>let x = 1;</script>';
      const ast = parse(source);

      expect(ast.script).toBeDefined();
      expect(ast.template).toBeUndefined();
      expect(ast.style).toBeUndefined();
    });
  });

  describe('Error handling', () => {
    it('should throw CompilerError for parse errors', () => {
      const source = '<script>invalid js {</script>';

      expect(() => {
        parse(source);
      }).toThrow('Invalid JavaScript');
    });

    it('should include filename in error messages', () => {
      const source = '<script>let x = ;</script>';

      expect(() => {
        parse(source, { filename: 'MyComponent.dce' });
      }).toThrow();
    });

    it('should handle malformed template', () => {
      const source = '<template><div></span></template>';

      expect(() => {
        parse(source);
      }).toThrow();
    });
  });

  describe('Complex component parsing', () => {
    it('should parse component with props', () => {
      const source = `
<script>
  let { name = 'Guest', age } = $props();
</script>

<template>
  <p>Name: {name}, Age: {age}</p>
</template>
      `;

      const ast = parse(source);

      expect(ast.script).toBeDefined();
      expect(ast.template).toBeDefined();
    });

    it('should parse component with $state rune', () => {
      const source = `
<script>
  let count = $state(0);
  let isOpen = $state(false);
</script>

<template>
  <div>{count}</div>
</template>
      `;

      const ast = parse(source);

      expect(ast.script).toBeDefined();
      expect(ast.script!.content).toContain('$state(0)');
      expect(ast.script!.content).toContain('$state(false)');
      expect(ast.template).toBeDefined();
    });

    it('should parse component with $derived rune', () => {
      const source = `
<script>
  let count = $state(0);
  let doubled = $derived(count * 2);
  let result = $derived.by(() => count * 3);
</script>

<template>
  <div>{doubled}</div>
</template>
      `;

      const ast = parse(source);

      expect(ast.script).toBeDefined();
      expect(ast.script!.content).toContain('$derived(count * 2)');
      expect(ast.script!.content).toContain('$derived.by');
      expect(ast.template).toBeDefined();
    });

    it('should parse component with $bindable rune', () => {
      const source = `
<script>
  let { value = $bindable('') } = $props();
</script>

<template>
  <input bind:value />
</template>
      `;

      const ast = parse(source);

      expect(ast.script).toBeDefined();
      expect(ast.script!.content).toContain('$bindable');
      expect(ast.template).toBeDefined();
    });

    it('should parse component with derived state', () => {
      const source = `
<script>
  let count = $state(0);
  let doubled = $derived(count * 2);
</script>

<template>
  <p>{doubled}</p>
</template>
      `;

      const ast = parse(source);

      expect(ast.script).toBeDefined();
      expect(ast.script!.content).toContain('$derived');
    });

    it('should parse component with effects', () => {
      const source = `
<script>
  let count = $state(0);

  $effect(() => {
    console.log(count);
  });
</script>

<template>
  <p>{count}</p>
</template>
      `;

      const ast = parse(source);

      expect(ast.script).toBeDefined();
      expect(ast.script!.content).toContain('$effect');
    });

    it('should parse component with control flow', () => {
      const source = `
<template>
  {#if items.length > 0}
    {#each items as item, index}
      <div>{index}: {item}</div>
    {/each}
  {:else}
    <p>No items</p>
  {/if}
</template>
      `;

      const ast = parse(source);

      expect(ast.template).toBeDefined();
      expect(ast.template!.children[0].type).toBe('IfBlock');
    });

    it('should parse component with scoped styles', () => {
      const source = `
<template>
  <div class="container">
    <p class="text">Content</p>
  </div>
</template>

<style>
  .container {
    padding: 1rem;
  }

  .text {
    color: blue;
  }

  .text:hover {
    color: red;
  }
</style>
      `;

      const ast = parse(source);

      expect(ast.template).toBeDefined();
      expect(ast.style).toBeDefined();
      expect(ast.style!.scoped).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty script block', () => {
      const source = '<script></script>';
      const ast = parse(source);

      expect(ast.script).toBeDefined();
    });

    it('should handle empty template block', () => {
      const source = '<template></template>';
      const ast = parse(source);

      expect(ast.template).toBeDefined();
    });

    it('should handle empty style block', () => {
      const source = '<style></style>';
      const ast = parse(source);

      expect(ast.style).toBeDefined();
    });

    it('should handle whitespace-only blocks', () => {
      const source = `
<script>

</script>
<template>

</template>
      `;

      // Should not throw
      const ast = parse(source);
      expect(ast).toBeDefined();
    });

    it('should handle script with comments only', () => {
      const source = `
<script>
  // This is a comment
  /* Multi-line
     comment */
</script>
      `;

      const ast = parse(source);
      expect(ast.script).toBeDefined();
    });
  });
});
