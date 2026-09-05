/**
 * Tests for how script code reaches a `bind:this` element.
 *
 * A ref is a bare identifier in the DSL, but React holds the element on
 * `.current` and Vue on `.value`. Script that touches a ref has to be
 * rewritten, or the emitted component calls a DOM method on the ref container
 * and throws. Solid and Svelte assign the element directly and need no rewrite.
 *
 * Also covers `bind:this` inside an `{#each}`, where one name cannot hold every
 * element the loop renders.
 */
import { describe, it, expect } from 'vitest';
import { compile } from '../index';

const TARGETS = ['react', 'solid', 'svelte', 'vue'] as const;
type Target = (typeof TARGETS)[number];

const REF_IN_FUNCTION = `
<script>
  let panel;
  function focusIt() { panel.focus(); }
</script>
<template>
  <div>
    <p bind:this={panel}>hi</p>
    <button on:click={focusIt}>go</button>
  </div>
</template>
`.trim();

function build(source: string, target: Target) {
  return compile(source.trim(), { target, filename: 'Panel.dce' });
}

describe('ref access in script', () => {
  it('reaches the element through .current on React', () => {
    const code = build(REF_IN_FUNCTION, 'react').js.code;

    // `panel.focus()` would call a DOM method on the ref object itself.
    expect(code).toContain('panel.current.focus()');
    expect(code).not.toMatch(/[^.]panel\.focus\(\)/);
  });

  it('reaches the element through .value on Vue', () => {
    const code = build(REF_IN_FUNCTION, 'vue').js.code;

    expect(code).toContain('panel.value.focus()');
    expect(code).not.toMatch(/[^.]panel\.focus\(\)/);
  });

  for (const target of ['solid', 'svelte'] as const) {
    it(`assigns the element directly on ${target}`, () => {
      const code = build(REF_IN_FUNCTION, target).js.code;

      expect(code).toContain('panel.focus()');
      expect(code).not.toContain('panel.current');
      expect(code).not.toContain('panel.value');
    });
  }

  it('does not rewrite a property that shares the ref name', () => {
    const code = build(
      `
<script>
  let panel;
  function read(row) { return row.panel; }
</script>
<template>
  <div bind:this={panel}>hi</div>
</template>
      `,
      'react'
    ).js.code;

    expect(code).toContain('row.panel');
    expect(code).not.toContain('row.panel.current');
  });

  it('does not double up an accessor already written', () => {
    const code = build(
      `
<script>
  let panel;
  function focusIt() { panel.current.focus(); }
</script>
<template>
  <div bind:this={panel}>hi</div>
</template>
      `,
      'react'
    ).js.code;

    expect(code).not.toContain('panel.current.current');
  });
});

describe('bind:this inside {#each}', () => {
  const LOOP_REF = `
<script>
  let { rows } = $props();
  let panel;
</script>
<template>
  <div>
    {#each rows as row}
      <p bind:this={panel}>{row.a}</p>
    {/each}
  </div>
</template>
  `.trim();

  for (const target of TARGETS) {
    it(`warns on ${target}`, () => {
      const { warnings } = build(LOOP_REF, target);

      // One name cannot hold every element the loop renders, and each target
      // degrades differently, so the compiler says so rather than picking one.
      expect(warnings).toBeDefined();
      expect(warnings).toHaveLength(1);
      expect(warnings![0].code).toBe('REF_BOUND_IN_LOOP');
      expect(warnings![0].message).toContain('panel');
    });
  }

  it('does not warn for a ref outside any loop', () => {
    const { warnings } = build(REF_IN_FUNCTION, 'react');

    expect(warnings).toBeUndefined();
  });

  it('does not warn for a ref in a plain {#if}', () => {
    const { warnings } = build(
      `
<script>
  let { on } = $props();
  let panel;
</script>
<template>
  <div>
    {#if on}
      <p bind:this={panel}>hi</p>
    {/if}
  </div>
</template>
      `,
      'react'
    );

    expect(warnings).toBeUndefined();
  });

  it('warns for a ref nested deeper inside a loop', () => {
    const { warnings } = build(
      `
<script>
  let { rows, on } = $props();
  let panel;
</script>
<template>
  <div>
    {#each rows as row}
      {#if on}
        <p bind:this={panel}>{row.a}</p>
      {/if}
    {/each}
  </div>
</template>
      `,
      'react'
    );

    expect(warnings).toHaveLength(1);
    expect(warnings![0].code).toBe('REF_BOUND_IN_LOOP');
  });

  it('reports both problems when a loop ref also shadows state', () => {
    const { warnings } = build(
      `
<script>
  let { rows } = $props();
  let panel = $state(null);
</script>
<template>
  <div>
    {#each rows as row}
      <p bind:this={panel}>{row.a}</p>
    {/each}
  </div>
</template>
      `,
      'react'
    );

    const codes = (warnings ?? []).map((warning) => warning.code).sort();
    expect(codes).toEqual(['REF_BOUND_IN_LOOP', 'REF_SHADOWS_STATE']);
  });
});
