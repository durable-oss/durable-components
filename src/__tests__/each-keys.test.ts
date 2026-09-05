/**
 * Tests for `{#each}` list reconciliation.
 *
 * An explicit `{#each items as item (item.id)}` key identifies an item across
 * reorders. React needs that key on the node the map callback returns — the
 * element itself, or the wrapping fragment when the body has several roots.
 * Solid has no `key` prop at all; it reconciles with `<For>`, which matches by
 * item reference.
 */
import { describe, it, expect } from 'vitest';
import { parse as parseJS } from '@babel/parser';
import { compile } from '../index';

const SINGLE_ROOT = `
<script>
  let { rows } = $props();
</script>
<template>
  <div>
    {#each rows as row (row.id)}
      <p class="row">{row.a}</p>
    {/each}
  </div>
</template>
`.trim();

const MULTI_ROOT = `
<script>
  let { rows } = $props();
</script>
<template>
  <div>
    {#each rows as row (row.id)}
      <p>{row.a}</p>
      <b>{row.b}</b>
    {/each}
  </div>
</template>
`.trim();

const UNKEYED = `
<script>
  let { rows } = $props();
</script>
<template>
  <div>
    {#each rows as row}
      <p>{row.a}</p>
    {/each}
  </div>
</template>
`.trim();

function build(source: string, target: 'react' | 'solid' | 'vue' | 'svelte'): string {
  return compile(source.trim(), { target, filename: 'Rows.dce' }).js.code;
}

function expectParses(code: string): void {
  expect(() =>
    parseJS(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] })
  ).not.toThrow();
}

describe('each keys', () => {
  describe('react', () => {
    it('uses the explicit key on a single-root body', () => {
      const code = build(SINGLE_ROOT, 'react');

      expectParses(code);
      expect(code).toContain('key={row.id}');
      // The loop index is the fallback, and using it here would make React
      // reuse the wrong element whenever the list is reordered.
      expect(code).not.toContain('key={index}');
    });

    it('keys the fragment on a multi-root body', () => {
      const code = build(MULTI_ROOT, 'react');

      expectParses(code);
      // React matches list children by the key on the node the callback
      // returns; on an inner element the key is invisible to reconciliation.
      expect(code).toContain('<React.Fragment key={row.id}>');
      expect(code).not.toContain('<p key=');
      expect(code).not.toContain('<b key=');
    });

    it('falls back to the index when no key is given', () => {
      const code = build(UNKEYED, 'react');

      expectParses(code);
      expect(code).toContain('key={index}');
    });

    it('keys each fragment exactly once', () => {
      const code = build(MULTI_ROOT, 'react');

      expect((code.match(/key=/g) ?? [])).toHaveLength(1);
    });
  });

  describe('solid', () => {
    it('reconciles with <For> rather than .map()', () => {
      const code = build(SINGLE_ROOT, 'solid');

      expectParses(code);
      expect(code).toContain('<For each={rows}>{(row) =>');
      expect(code).toContain("import { For } from 'solid-js';");
      expect(code).not.toContain('rows.map(');
    });

    it('emits no key prop, which Solid does not have', () => {
      const code = build(MULTI_ROOT, 'solid');

      expectParses(code);
      // The old output put the same key on every child, which did nothing.
      expect(code).not.toContain('key=');
    });

    it('passes the index as a signal when the loop declares one', () => {
      const code = build(
        `
<script>
  let { rows } = $props();
</script>
<template>
  <div>
    {#each rows as row, i}
      <p>{i}</p>
    {/each}
  </div>
</template>
        `,
        'solid'
      );

      expectParses(code);
      expect(code).toContain('<For each={rows}>{(row, i) =>');
      // <For> hands the index over as an accessor, not a number.
      expect(code).toContain('{i()}');
    });

    it('leaves a property that shares the index name alone', () => {
      const code = build(
        `
<script>
  let { rows } = $props();
</script>
<template>
  <div>
    {#each rows as row, i}
      <p>{row.i}</p>
    {/each}
  </div>
</template>
        `,
        'solid'
      );

      expectParses(code);
      expect(code).toContain('{row.i}');
      expect(code).not.toContain('row.i()');
    });

    it('takes no index parameter when the loop declares none', () => {
      const code = build(SINGLE_ROOT, 'solid');

      expect(code).toContain('{(row) =>');
    });
  });

  it('keeps the key on Svelte and Vue', () => {
    expect(build(SINGLE_ROOT, 'svelte')).toContain('{#each rows as row (row.id)}');
    expect(build(SINGLE_ROOT, 'vue')).toContain(':key="row.id"');
  });
});
