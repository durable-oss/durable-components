/**
 * Compiler integration tests
 */

import { compile } from '../index';

describe('Durable Component Compiler', () => {
  describe('Basic compilation', () => {
    it('should compile a simple component to React', () => {
      const source = `
<script>
  let count = $state(0);

  function increment() {
    count++;
  }
</script>

<template>
  <button on:click={increment}>
    Count: {count}
  </button>
</template>

<style>
  button {
    padding: 1rem;
  }
</style>
      `.trim();

      const result = compile(source, {
        filename: 'Counter.dce',
        target: 'react',
        style: 'scoped'
      });

      expect(result.js.code).toBeDefined();
      expect(result.js.code).toContain('export function Counter');
      expect(result.js.code).toContain('useState');
      expect(result.js.code).toContain('const increment');
      expect(result.css).toBeDefined();
      expect(result.css?.code).toContain('button');
    });

    it('should compile a component with props', () => {
      const source = `
<script>
  let { name = 'World' } = $props();
</script>

<template>
  <h1>Hello, {name}!</h1>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'Greeting.dce',
        target: 'react'
      });

      expect(result.js.code).toContain('interface GreetingProps');
      expect(result.js.code).toContain('name');
      expect(result.meta?.props).toContain('name');
    });

    it('should compile a component with derived state', () => {
      const source = `
<script>
  let count = $state(0);
  let doubled = $derived(count * 2);
</script>

<template>
  <p>Count: {count}, Doubled: {doubled}</p>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'Derived.dce',
        target: 'react'
      });

      expect(result.js.code).toContain('useMemo');
      expect(result.js.code).toContain('doubled');
    });

    it('should compile a component with effects', () => {
      const source = `
<script>
  let count = $state(0);

  $effect(() => {
    console.log('Count changed:', count);
  });
</script>

<template>
  <p>{count}</p>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'Effect.dce',
        target: 'react'
      });

      expect(result.js.code).toContain('useEffect');
    });

    it('should compile a component with conditional rendering', () => {
      const source = `
<script>
  let show = $state(true);
</script>

<template>
  {#if show}
    <p>Visible</p>
  {:else}
    <p>Hidden</p>
  {/if}
</template>
      `.trim();

      const result = compile(source, {
        filename: 'Conditional.dce',
        target: 'react'
      });

      expect(result.js.code).toContain('?');
      expect(result.js.code).toContain('Visible');
      expect(result.js.code).toContain('Hidden');
    });

    it('should compile a component with list rendering', () => {
      const source = `
<script>
  let items = $state(['a', 'b', 'c']);
</script>

<template>
  {#each items as item}
    <li>{item}</li>
  {/each}
</template>
      `.trim();

      const result = compile(source, {
        filename: 'List.dce',
        target: 'react'
      });

      expect(result.js.code).toContain('.map');
      expect(result.js.code).toContain('item');
    });
  });

  describe('Scoped styles', () => {
    it('should generate scoped CSS', () => {
      const source = `
<script>
  let active = $state(false);
</script>

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
      `.trim();

      const result = compile(source, {
        filename: 'Scoped.dce',
        target: 'react',
        style: 'scoped'
      });

      expect(result.css).toBeDefined();
      expect(result.css?.code).toContain('[data-dce-');
      expect(result.css?.code).toContain('.container[data-dce-');
      expect(result.css?.code).toContain('.text[data-dce-');
    });
  });

  describe('SolidJS compilation', () => {
    it('should compile a simple component to SolidJS', () => {
      const source = `
<script>
  let count = $state(0);

  function increment() {
    count++;
  }
</script>

<template>
  <button on:click={increment}>
    Count: {count}
  </button>
</template>

<style>
  button {
    padding: 1rem;
  }
</style>
      `.trim();

      const result = compile(source, {
        filename: 'Counter.dce',
        target: 'solid',
        style: 'scoped'
      });

      expect(result.js.code).toBeDefined();
      expect(result.js.code).toContain('export function Counter');
      expect(result.js.code).toContain('createSignal');
      expect(result.js.code).toContain('const increment');
      expect(result.js.code).toContain('count()');
      expect(result.css).toBeDefined();
      expect(result.css?.code).toContain('button');
    });

    it('should compile a component with derived state to SolidJS', () => {
      const source = `
<script>
  let count = $state(0);
  let doubled = $derived(count * 2);
</script>

<template>
  <p>Count: {count}, Doubled: {doubled}</p>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'Derived.dce',
        target: 'solid'
      });

      expect(result.js.code).toContain('createMemo');
      expect(result.js.code).toContain('doubled');
      expect(result.js.code).toContain('count()');
    });

    it('should compile a component with effects to SolidJS', () => {
      const source = `
<script>
  let count = $state(0);

  $effect(() => {
    console.log('Count changed:', count);
  });
</script>

<template>
  <p>{count}</p>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'Effect.dce',
        target: 'solid'
      });

      expect(result.js.code).toContain('createEffect');
      expect(result.js.code).toContain('count()');
    });
  });

  describe('Error handling', () => {
    it('should throw error for invalid syntax', () => {
      const source = `
<script>
  let count = $state(0
</script>
      `.trim();

      expect(() => {
        compile(source, {
          filename: 'Invalid.dce',
          target: 'react'
        });
      }).toThrow();
    });

    it('should throw error for unsupported target', () => {
      const source = `<template><div>Test</div></template>`;

      expect(() => {
        compile(source, {
          filename: 'Test.dce',
          target: 'wc' as any
        });
      }).toThrow('not yet implemented');
    });

    it('should compile to Svelte 5', () => {
      const source = `
<script>
  let count = $state(0);
  function increment() {
    count++;
  }
</script>

<template>
  <button on:click={increment}>Count: {count}</button>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'Counter.dce',
        target: 'svelte'
      });

      expect(result.js.code).toBeDefined();
      expect(result.js.code).toContain('$state');
      expect(result.js.code).toContain('function increment');
    });
  });

  describe('Advanced features', () => {
    it('should compile component with multiple state variables', () => {
      const source = `
<script>
  let name = $state('');
  let email = $state('');
  let age = $state(0);
</script>

<template>
  <form>
    <input bind:value={name} />
    <input bind:value={email} />
    <input bind:value={age} />
  </form>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'Form.dce',
        target: 'react'
      });

      expect(result.js.code).toContain('useState');
      expect(result.js.code).toContain('name');
      expect(result.js.code).toContain('email');
      expect(result.js.code).toContain('age');
    });

    it('should compile component with nested control flow', () => {
      const source = `
<script>
  let users = $state([]);
  let showUsers = $state(true);
</script>

<template>
  {#if showUsers}
    {#if users.length > 0}
      {#each users as user}
        <div>{user.name}</div>
      {/each}
    {:else}
      <p>No users</p>
    {/if}
  {/if}
</template>
      `.trim();

      const result = compile(source, {
        filename: 'UserList.dce',
        target: 'react'
      });

      expect(result.js.code).toContain('showUsers');
      expect(result.js.code).toContain('users.length');
      expect(result.js.code).toContain('.map');
    });

    it('should compile component with multiple functions', () => {
      const source = `
<script>
  let count = $state(0);

  function increment() {
    count++;
  }

  function decrement() {
    count--;
  }

  function reset() {
    count = 0;
  }
</script>

<template>
  <div>
    <button on:click={increment}>+</button>
    <span>{count}</span>
    <button on:click={decrement}>-</button>
    <button on:click={reset}>Reset</button>
  </div>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'Counter.dce',
        target: 'react'
      });

      expect(result.js.code).toContain('const increment');
      expect(result.js.code).toContain('const decrement');
      expect(result.js.code).toContain('const reset');
      expect(result.js.code).toContain('setCount');
    });

    it('should compile component with complex derived values', () => {
      const source = `
<script>
  let { items = [] } = $props();
  let filter = $state('');
  let filteredItems = $derived(
    items.filter(item => item.includes(filter))
  );
</script>

<template>
  <div>
    <input bind:value={filter} />
    {#each filteredItems as item}
      <p>{item}</p>
    {/each}
  </div>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'FilteredList.dce',
        target: 'react'
      });

      expect(result.js.code).toContain('useMemo');
      expect(result.js.code).toContain('filteredItems');
      expect(result.js.code).toContain('filter');
    });

    it('should compile component with multiple effects', () => {
      const source = `
<script>
  let count = $state(0);
  let name = $state('');

  $effect(() => {
    document.title = \`Count: \${count}\`;
  });

  $effect(() => {
    console.log('Name changed:', name);
  });
</script>

<template>
  <div>
    <p>{count}</p>
    <p>{name}</p>
  </div>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'MultiEffect.dce',
        target: 'react'
      });

      expect(result.js.code).toContain('useEffect');
      expect(result.js.code).toContain('document.title');
      expect(result.js.code).toContain('console.log');
    });

    it('should compile component with event handlers and parameters', () => {
      const source = `
<script>
  let items = $state([]);

  function addItem(text) {
    items = [...items, text];
  }

  function removeItem(index) {
    items = items.filter((_, i) => i !== index);
  }
</script>

<template>
  <div>
    {#each items as item, index}
      <div>
        {item}
        <button on:click={() => removeItem(index)}>Remove</button>
      </div>
    {/each}
  </div>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'ItemList.dce',
        target: 'react'
      });

      expect(result.js.code).toContain('const addItem');
      expect(result.js.code).toContain('const removeItem');
    });

    it('should compile component with inline styles', () => {
      const source = `
<template>
  <div>Test</div>
</template>

<style>
  div { color: red; }
</style>
      `.trim();

      const result = compile(source, {
        filename: 'Test.dce',
        target: 'react',
        style: 'inline'
      });

      expect(result.css).toBeDefined();
      expect(result.css?.code).toContain('color: red');
    });

    it('should compile component without styles', () => {
      const source = `
<template>
  <div>No styles</div>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'NoStyles.dce',
        target: 'react'
      });

      expect(result.css).toBeNull();
    });

    it('should compile component with complex expressions', () => {
      const source = `
<script>
  let x = $state(5);
  let y = $state(10);
  let result = $derived(Math.max(x, y) * 2 + 5);
</script>

<template>
  <p>Result: {result}</p>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'Math.dce',
        target: 'react'
      });

      expect(result.js.code).toContain('useMemo');
      expect(result.js.code).toContain('result');
    });

    it('should handle empty template', () => {
      const source = `
<script>
  let count = $state(0);
</script>

<template>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'Empty.dce',
        target: 'react'
      });

      expect(result.js.code).toBeDefined();
      expect(result.js.code).toContain('export function Empty');
    });

    it('should preserve metadata', () => {
      const source = `
<script>
  let { name, age = 18 } = $props();
</script>

<template>
  <p>{name} - {age}</p>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'User.dce',
        target: 'react'
      });

      expect(result.meta).toBeDefined();
      expect(result.meta?.name).toBe('User');
      expect(result.meta?.props).toContain('name');
      expect(result.meta?.props).toContain('age');
    });
  });

  describe('Edge cases', () => {
    it('should handle components with only template', () => {
      const source = '<template><div>Static content</div></template>';

      const result = compile(source, {
        filename: 'Static.dce',
        target: 'react'
      });

      expect(result.js.code).toContain('export function Static');
    });

    it('should handle components with whitespace', () => {
      const source = `

<script>
  let x = 1;
</script>


<template>
  <div>Test</div>
</template>


      `;

      const result = compile(source, {
        filename: 'Whitespace.dce',
        target: 'react'
      });

      expect(result.js.code).toBeDefined();
    });

    it('should handle special characters in content', () => {
      const source = `
<template>
  <p>Special: &lt; &gt; &amp; "quotes"</p>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'Special.dce',
        target: 'react'
      });

      expect(result.js.code).toBeDefined();
    });

    it('should handle self-closing elements', () => {
      const source = `
<template>
  <div>
    <input />
    <br />
    <img />
  </div>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'SelfClosing.dce',
        target: 'react'
      });

      expect(result.js.code).toContain('<input');
      expect(result.js.code).toContain('<br');
      expect(result.js.code).toContain('<img');
    });

    it('should handle boolean attributes', () => {
      const source = `
<template>
  <input disabled />
  <input checked />
</template>
      `.trim();

      const result = compile(source, {
        filename: 'Boolean.dce',
        target: 'react'
      });

      expect(result.js.code).toBeDefined();
    });
  });
});
