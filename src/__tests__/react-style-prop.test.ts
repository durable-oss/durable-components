/**
 * Regression tests for the React `style` prop.
 *
 * React's style prop takes an object keyed by camelCased CSS properties. Every
 * other target accepts a CSS declaration string, so the generator used to emit
 * one for React too — `style={`width: 100%`}` — which throws at runtime:
 * "The `style` prop expects a mapping from style properties to values".
 */
import { describe, it, expect } from 'vitest';
import { parse as parseJS } from '@babel/parser';
import { transformSync } from 'esbuild';
import { compile } from '../index';

/** Parse generated output as JSX/TSX, surfacing a syntax error as a failure. */
function expectParses(code: string): void {
  expect(() =>
    parseJS(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] })
  ).not.toThrow();
}

function react(source: string): string {
  return compile(source.trim(), { target: 'react', filename: 'Styled.dce' }).js.code;
}

describe('React style prop', () => {
  it('converts a static style string to an object literal', () => {
    const code = react(`
<script>
</script>
<template>
  <div style="width: 100%; background-color: red"></div>
</template>
    `);

    expectParses(code);
    expect(code).toMatch(/"width":\s*"100%"/);
    expect(code).toMatch(/"backgroundColor":\s*"red"/);
    // The bug emitted the raw CSS string.
    expect(code).not.toContain('style="width: 100%');
  });

  it('preserves custom properties verbatim rather than camelCasing them', () => {
    const code = react(`
<script>
</script>
<template>
  <div style="--du-skeleton-w: 10px"></div>
</template>
    `);

    expectParses(code);
    expect(code).toContain('"--du-skeleton-w"');
    expect(code).not.toContain('duSkeletonW');
  });

  it('routes an interpolated style through the runtime helper', () => {
    const code = react(`
<script>
  let { width = 10 } = $props();
</script>
<template>
  <div style="width: {width}%"></div>
</template>
    `);

    expectParses(code);
    expect(code).toContain('__dceStyle(');
    // The helper has to be emitted alongside the component that calls it.
    expect(code).toContain('function __dceStyle');
  });

  it('passes an object-valued style through the helper unchanged at runtime', () => {
    const code = react(`
<script>
  let { width = 10 } = $props();
  let sizeVars = $derived({ '--du-skeleton-w': width });
</script>
<template>
  <div style={sizeVars}></div>
</template>
    `);

    expectParses(code);
    expect(code).toContain('__dceStyle(sizeVars)');
  });

  it('emits the helper only when something dynamic needs it', () => {
    const code = react(`
<script>
</script>
<template>
  <div style="color: red"></div>
</template>
    `);

    expect(code).not.toContain('__dceStyle');
  });

});

describe('__dceStyle runtime behavior', () => {
  /** Evaluate the emitted helper so the runtime semantics are actually tested. */
  function helper(): (value: unknown) => unknown {
    const code = react(`
<script>
  let { w = 1 } = $props();
</script>
<template>
  <div style="width: {w}px"></div>
</template>
    `);

    const source = code.slice(code.indexOf('function __dceStyle'));
    const declaration = source.slice(0, source.indexOf('\n}') + 2);
    // The emitted helper is TypeScript; strip its annotations to run it here.
    const body = transformSync(declaration, { loader: 'ts' }).code;

    return new Function(`${body}; return __dceStyle;`)();
  }

  it('camelCases standard properties', () => {
    expect(helper()('background-color: red')).toEqual({ backgroundColor: 'red' });
  });

  it('keeps custom properties as-is', () => {
    expect(helper()('--du-skeleton-w: 10px')).toEqual({ '--du-skeleton-w': '10px' });
  });

  it('tolerates a trailing semicolon and extra whitespace', () => {
    expect(helper()('  width : 100% ;  ')).toEqual({ width: '100%' });
  });

  it('returns non-string values untouched', () => {
    const style = { color: 'red' };
    expect(helper()(style)).toBe(style);
    expect(helper()(undefined)).toBe(undefined);
  });
});
