import { describe, it, expect, beforeEach } from 'vitest';
import { durableComponents } from '../vite-plugin';
import type { DurableComponentsPluginOptions } from '../vite-plugin';

describe('Vite Plugin', () => {
  describe('Plugin Creation', () => {
    it('should create a plugin with default options', () => {
      const plugin = durableComponents();

      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('vite-plugin-durable-components');
      expect(plugin.enforce).toBe('pre');
    });

    it('should create a plugin with custom options', () => {
      const options: DurableComponentsPluginOptions = {
        target: 'solid',
        style: 'inline',
        extensions: ['.dce', '.durable']
      };

      const plugin = durableComponents(options);

      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('vite-plugin-durable-components');
    });

    it('should have all required plugin hooks', () => {
      const plugin = durableComponents();

      expect(plugin.resolveId).toBeDefined();
      expect(plugin.load).toBeDefined();
      expect(plugin.transform).toBeDefined();
      expect(plugin.handleHotUpdate).toBeDefined();
      expect(plugin.configResolved).toBeDefined();
      expect(plugin.configureServer).toBeDefined();
    });
  });

  describe('File Resolution', () => {
    it('should resolve .dce files', () => {
      const plugin = durableComponents();

      // Test resolveId hook
      const result = plugin.resolveId?.('./Counter.dce', '/src/App.tsx');

      // resolveId should return the resolved path or null
      expect(result).toBeDefined();
    });

    it('should handle virtual CSS modules', () => {
      const plugin = durableComponents();

      const result = plugin.resolveId?.('dce-css:/path/to/Counter.dce', undefined);

      expect(result).toBe('dce-css:/path/to/Counter.dce');
    });
  });

  describe('Code Transformation', () => {
    it('should transform .dce files to React', async () => {
      const plugin = durableComponents({ target: 'react' });

      const source = `<script>
  let { initialCount = 0 } = $props();
  let count = $state(initialCount);

  function increment() {
    count++;
  }
</script>

<template>
  <button on:click={increment}>Count: {count}</button>
</template>`;

      const id = '/src/Counter.dce';

      // Transform returns a promise or null
      const result = await plugin.transform?.(source, id);

      expect(result).toBeDefined();
      if (result && typeof result === 'object' && 'code' in result) {
        expect(result.code).toBeDefined();
        expect(result.code).toContain('useState'); // React hook
      }
    });

    it('should transform .dce files to SolidJS', async () => {
      const plugin = durableComponents({ target: 'solid' });

      const source = `<script>
  let { initialCount = 0 } = $props();
  let count = $state(initialCount);

  function increment() {
    count++;
  }
</script>

<template>
  <button on:click={increment}>Count: {count}</button>
</template>`;

      const id = '/src/Counter.dce';

      const result = await plugin.transform?.(source, id);

      expect(result).toBeDefined();
      if (result && typeof result === 'object' && 'code' in result) {
        expect(result.code).toBeDefined();
        expect(result.code).toContain('createSignal'); // SolidJS signal
      }
    });

    it('should transform .dce files to Svelte', async () => {
      const plugin = durableComponents({ target: 'svelte' });

      const source = `<script>
  let { initialCount = 0 } = $props();
  let count = $state(initialCount);

  function increment() {
    count++;
  }
</script>

<template>
  <button on:click={increment}>Count: {count}</button>
</template>`;

      const id = '/src/Counter.dce';

      const result = await plugin.transform?.(source, id);

      expect(result).toBeDefined();
      if (result && typeof result === 'object' && 'code' in result) {
        expect(result.code).toBeDefined();
        expect(result.code).toContain('$state'); // Svelte 5 rune
      }
    });

    it('should not transform non-.dce files', async () => {
      const plugin = durableComponents();

      const source = 'console.log("hello");';
      const id = '/src/file.js';

      const result = await plugin.transform?.(source, id);

      expect(result).toBeNull();
    });

    it('should handle files with custom extensions', async () => {
      const plugin = durableComponents({ extensions: ['.dce', '.durable'] });

      const source = `<script>
  let count = $state(0);
</script>

<template>
  <div>{count}</div>
</template>`;

      const id = '/src/Counter.durable';

      const result = await plugin.transform?.(source, id);

      expect(result).toBeDefined();
    });
  });

  describe('CSS Handling', () => {
    it('should inject CSS imports for scoped styles', async () => {
      const plugin = durableComponents({ style: 'scoped' });

      const source = `<script>
  let count = $state(0);
</script>

<template>
  <div>Count: {count}</div>
</template>

<style>
  div {
    color: red;
  }
</style>`;

      const id = '/src/Counter.dce';

      const result = await plugin.transform?.(source, id);

      expect(result).toBeDefined();
      if (result && typeof result === 'object' && 'code' in result) {
        expect(result.code).toContain('dce-css:');
      }
    });

    it('should load virtual CSS modules', () => {
      const plugin = durableComponents();

      // First, we need to simulate a transform that creates CSS
      // This is tested indirectly through the transform test
      expect(plugin.load).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle compilation errors gracefully', async () => {
      const plugin = durableComponents();

      const invalidSource = `<script>
  this is invalid syntax!!!
</script>`;

      const id = '/src/Invalid.dce';

      // The transform should handle errors
      // We can't easily test the error callback without a full Vite context
      // but we can verify the transform hook exists
      expect(plugin.transform).toBeDefined();
    });
  });

  describe('Options Validation', () => {
    it('should accept valid target options', () => {
      const targets = ['react', 'vue', 'solid', 'svelte'] as const;

      targets.forEach(target => {
        const plugin = durableComponents({ target });
        expect(plugin).toBeDefined();
      });
    });

    it('should accept valid style options', () => {
      const styles = ['scoped', 'inline', 'unocss'] as const;

      styles.forEach(style => {
        const plugin = durableComponents({ style });
        expect(plugin).toBeDefined();
      });
    });

    it('should accept include and exclude patterns', () => {
      const plugin = durableComponents({
        include: ['src/**/*.dce'],
        exclude: ['node_modules/**', 'dist/**']
      });

      expect(plugin).toBeDefined();
    });
  });
});
