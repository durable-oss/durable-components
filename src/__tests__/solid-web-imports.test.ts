/**
 * Regression test for Solid's import module.
 *
 * `Dynamic` and `Portal` are exported from `solid-js/web`, not the package
 * root. The generator imported every primitive from `solid-js`, so a component
 * using `<dce:element>` or `<dce:head>` got an undefined import.
 */
import { describe, it, expect } from 'vitest';
import { compile } from '../index';

function solid(source: string): string {
  return compile(source.trim(), { target: 'solid', filename: 'A.dce' }).js.code;
}

const DYNAMIC = `
<script>
  let { tag = 'div' } = $props();
</script>
<template>
  <dce:element this={tag}>x</dce:element>
</template>
`;

describe('Solid imports', () => {
  it('imports Dynamic from solid-js/web', () => {
    const code = solid(DYNAMIC);

    expect(code).toContain("import { Dynamic } from 'solid-js/web';");
    expect(code).not.toContain("import { Dynamic } from 'solid-js';");
  });

  it('keeps reactive primitives on the package root', () => {
    const code = solid(`
<script>
  let n = $state(0);
</script>
<template>
  <div>{n}</div>
</template>
    `);

    expect(code).toContain("import { createSignal } from 'solid-js';");
    expect(code).not.toContain('solid-js/web');
  });

  it('splits a mixed set across both modules', () => {
    const code = solid(`
<script>
  let { tag = 'div' } = $props();
  let n = $state(0);
</script>
<template>
  <dce:element this={tag}>{n}</dce:element>
</template>
    `);

    expect(code).toContain("from 'solid-js';");
    expect(code).toContain("from 'solid-js/web';");
    // Each primitive appears in exactly one import.
    expect(code.match(/createSignal/g)?.length).toBeGreaterThanOrEqual(1);
    expect(code).toMatch(/import \{ Dynamic \} from 'solid-js\/web';/);
  });
});
