/**
 * Tests for reported compiler issues
 */

import { compile } from '../index';

describe('Compiler Issue Fixes', () => {
  describe('Complex expressions in $derived', () => {
    it('should handle switch/case statements within arrow functions', () => {
      const source = `
<script>
  let status = $state('active');
  let color = $derived(() => {
    switch (status) {
      case 'active':
        return 'green';
      case 'pending':
        return 'yellow';
      case 'inactive':
        return 'red';
      default:
        return 'gray';
    }
  });
</script>

<template>
  <div>Status color: {color}</div>
</template>
      `.trim();

      expect(() => {
        const result = compile(source, {
          filename: 'SwitchDerived.dce',
          target: 'react'
        });
        expect(result.js.code).toBeDefined();
        expect(result.js.code).toContain('useMemo');
        expect(result.js.code).toContain('switch');
      }).not.toThrow();
    });

    it('should handle nested switch statements in $derived', () => {
      const source = `
<script>
  let type = $state('user');
  let role = $state('admin');
  let permission = $derived(() => {
    switch (type) {
      case 'user':
        switch (role) {
          case 'admin':
            return 'full';
          case 'editor':
            return 'edit';
          default:
            return 'read';
        }
      case 'guest':
        return 'none';
      default:
        return 'read';
    }
  });
</script>

<template>
  <div>Permission: {permission}</div>
</template>
      `.trim();

      expect(() => {
        const result = compile(source, {
          filename: 'NestedSwitch.dce',
          target: 'react'
        });
        expect(result.js.code).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('Dynamic CSS property names', () => {
    it('should handle template literals in style attributes', () => {
      const source = `
<script>
  let position = $state('left');
  let width = $state(2);
</script>

<template>
  <div style:border-{position}={width + 'px solid black'}>
    Dynamic border
  </div>
</template>
      `.trim();

      expect(() => {
        const result = compile(source, {
          filename: 'DynamicCSS.dce',
          target: 'react'
        });
        expect(result.js.code).toBeDefined();
      }).not.toThrow();
    });

    it('should handle multiple dynamic CSS properties', () => {
      const source = `
<script>
  let side = $state('top');
  let color = $state('red');
  let size = $state(10);
</script>

<template>
  <div
    style:margin-{side}={size + 'px'}
    style:border-{side}-color={color}>
    Multi dynamic
  </div>
</template>
      `.trim();

      expect(() => {
        const result = compile(source, {
          filename: 'MultiDynamicCSS.dce',
          target: 'react'
        });
        expect(result.js.code).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('bind:this directive', () => {
    it('should handle bind:this for DOM element references', () => {
      const source = `
<script>
  let inputElement;

  function focusInput() {
    inputElement.current?.focus();
  }
</script>

<template>
  <div>
    <input bind:this={inputElement} />
    <button on:click={focusInput}>Focus Input</button>
  </div>
</template>
      `.trim();

      expect(() => {
        const result = compile(source, {
          filename: 'BindThis.dce',
          target: 'react'
        });
        expect(result.js.code).toBeDefined();
        expect(result.js.code).toContain('useRef');
      }).not.toThrow();
    });

    it('should handle multiple bind:this directives', () => {
      const source = `
<script>
  let firstInput;
  let secondInput;
  let divElement;

  function focusFirst() {
    firstInput.current?.focus();
  }
</script>

<template>
  <div bind:this={divElement}>
    <input bind:this={firstInput} />
    <input bind:this={secondInput} />
    <button on:click={focusFirst}>Focus First</button>
  </div>
</template>
      `.trim();

      expect(() => {
        const result = compile(source, {
          filename: 'MultipleBindThis.dce',
          target: 'react'
        });
        expect(result.js.code).toBeDefined();
      }).not.toThrow();
    });

    it('should handle bind:this with canvas element', () => {
      const source = `
<script>
  let canvas;

  $effect(() => {
    if (canvas.current) {
      const ctx = canvas.current.getContext('2d');
      ctx.fillRect(0, 0, 100, 100);
    }
  });
</script>

<template>
  <canvas bind:this={canvas} width="200" height="200"></canvas>
</template>
      `.trim();

      expect(() => {
        const result = compile(source, {
          filename: 'CanvasBindThis.dce',
          target: 'react'
        });
        expect(result.js.code).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('Complex object manipulation', () => {
    it('should handle Object.entries().map().join() chains', () => {
      const source = `
<script>
  let data = $state({ name: 'John', age: 30, city: 'NYC' });
  let formatted = $derived(
    Object.entries(data)
      .map(([key, value]) => \`\${key}: \${value}\`)
      .join(', ')
  );
</script>

<template>
  <div>{formatted}</div>
</template>
      `.trim();

      expect(() => {
        const result = compile(source, {
          filename: 'ObjectChain.dce',
          target: 'react'
        });
        expect(result.js.code).toBeDefined();
        expect(result.js.code).toContain('Object.entries');
      }).not.toThrow();
    });

    it('should handle complex chained array operations', () => {
      const source = `
<script>
  let users = $state([
    { name: 'Alice', active: true },
    { name: 'Bob', active: false },
    { name: 'Charlie', active: true }
  ]);

  let activeNames = $derived(
    users
      .filter(user => user.active)
      .map(user => user.name.toUpperCase())
      .sort()
      .join(' | ')
  );
</script>

<template>
  <div>Active users: {activeNames}</div>
</template>
      `.trim();

      expect(() => {
        const result = compile(source, {
          filename: 'ChainedOps.dce',
          target: 'react'
        });
        expect(result.js.code).toBeDefined();
      }).not.toThrow();
    });

    it('should handle Object.keys() with reduce', () => {
      const source = `
<script>
  let scores = $state({ math: 90, english: 85, science: 92 });
  let average = $derived(
    Object.values(scores).reduce((sum, score) => sum + score, 0) / Object.keys(scores).length
  );
</script>

<template>
  <div>Average: {average}</div>
</template>
      `.trim();

      expect(() => {
        const result = compile(source, {
          filename: 'ObjectReduce.dce',
          target: 'react'
        });
        expect(result.js.code).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('Combined complex scenarios', () => {
    it('should handle component with all complex features', () => {
      const source = `
<script>
  let canvas;
  let data = $state({ x: 10, y: 20, z: 30 });
  let position = $state('top');

  let summary = $derived(
    Object.entries(data)
      .map(([key, value]) => \`\${key}=\${value}\`)
      .join('; ')
  );

  let status = $derived(() => {
    const total = Object.values(data).reduce((a, b) => a + b, 0);
    switch (true) {
      case total > 50:
        return 'high';
      case total > 20:
        return 'medium';
      default:
        return 'low';
    }
  });

  $effect(() => {
    if (canvas.current) {
      const ctx = canvas.current.getContext('2d');
      ctx.clearRect(0, 0, 200, 200);
    }
  });
</script>

<template>
  <div style:border-{position}="2px solid black">
    <canvas bind:this={canvas} width="200" height="200"></canvas>
    <p>Status: {status}</p>
    <p>Summary: {summary}</p>
  </div>
</template>
      `.trim();

      expect(() => {
        const result = compile(source, {
          filename: 'Complex.dce',
          target: 'react'
        });
        expect(result.js.code).toBeDefined();
      }).not.toThrow();
    });
  });
});
