/**
 * Regression tests for object-literal `$derived` bodies.
 *
 * React, Solid, and Vue all emit the derived expression as a concise arrow
 * body: `useMemo(() => EXPR, [...])`, `createMemo(() => EXPR)`,
 * `computed(() => EXPR)`. When EXPR starts with `{` the brace is parsed as a
 * block statement, so `$derived({ a: 1 })` became `useMemo(() => { a: 1 }, [])`
 * — a labeled statement in a block that returns undefined, or a syntax error
 * once the object has more than one key.
 *
 * Svelte is unaffected: it emits `$derived(EXPR)`, where a brace is
 * unambiguously an object literal.
 */
import { describe, it, expect } from 'vitest';
import { parse as parseJS } from '@babel/parser';
import { compile } from '../index';

const SOURCE = `
<script>
  let { width = 10, height = 20 } = $props();
  let sizeVars = $derived({ '--du-skeleton-w': width, '--du-skeleton-h': height });
</script>
<template>
  <div></div>
</template>
`.trim();

/** Object literals with a single key still silently evaluated to undefined. */
const SINGLE_KEY = `
<script>
  let { width = 10 } = $props();
  let sizeVars = $derived({ '--du-skeleton-w': width });
</script>
<template>
  <div></div>
</template>
`.trim();

describe('object-literal $derived', () => {
  for (const [target, wrapper] of [
    ['react', 'useMemo'],
    ['solid', 'createMemo']
  ] as const) {
    describe(target, () => {
      it('parenthesizes a multi-key object body', () => {
        const { code } = compile(SOURCE, { target, filename: 'Skeleton.dce' }).js;

        expect(() =>
          parseJS(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] })
        ).not.toThrow();
        expect(code).toContain(`${wrapper}(() => ({`);
        // The bug emitted a block body.
        expect(code).not.toMatch(new RegExp(`${wrapper}\\(\\(\\) => \\{\\s*['"]`));
      });

      it('parenthesizes a single-key object body', () => {
        const { code } = compile(SINGLE_KEY, { target, filename: 'Skeleton.dce' }).js;

        expect(code).toContain(`${wrapper}(() => ({`);
      });
    });
  }

  describe('vue', () => {
    it('parenthesizes an object body', () => {
      const { code } = compile(SOURCE, { target: 'vue', filename: 'Skeleton.dce' }).js;

      expect(code).toContain('computed(() => ({');
      expect(code).not.toMatch(/computed\(\(\) => \{\s*['"]/);
    });
  });

  describe('svelte', () => {
    it('leaves the object literal as a plain call argument', () => {
      const { code } = compile(SOURCE, { target: 'svelte', filename: 'Skeleton.dce' }).js;

      expect(code).toContain('$derived({');
    });
  });

  it('does not parenthesize a non-object body', () => {
    const source = `
<script>
  let { n = 1 } = $props();
  let doubled = $derived(n * 2);
</script>
<template>
  <div></div>
</template>
    `.trim();

    const { code } = compile(source, { target: 'react', filename: 'N.dce' }).js;

    expect(code).toMatch(/useMemo\(\(\) => n \* 2,/);
  });
});
