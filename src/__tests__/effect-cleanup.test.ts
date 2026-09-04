/**
 * Regression tests for effect teardown and Solid's setter transform.
 *
 * `$effect(() => { ...; return () => cleanup(); })` is the DSL's way to undo
 * work on unmount. React and Svelte honour a returned function natively; Vue's
 * watchEffect and Solid's createEffect both DISCARD it, so every listener,
 * timer, and observer an effect set up leaked. Both now route the teardown
 * through their framework's onCleanup.
 *
 * Separately, Solid's setter transform ran only over function bodies, so an
 * assignment inside an effect came out as `open() = false` — not a valid
 * assignment target.
 */
import { describe, it, expect } from 'vitest';
import { parse as parseJS } from '@babel/parser';
import { compile } from '../index';
import { returnsTeardown } from '../utils/effect-cleanup';

const WITH_CLEANUP = `
<script>
  let open = $state(true);
  $effect(() => {
    const onKey = (e) => { open = false; };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });
</script>
<template><div>{open}</div></template>
`.trim();

const WITHOUT_CLEANUP = `
<script>
  let n = $state(0);
  $effect(() => { console.log(n); });
</script>
<template><div>{n}</div></template>
`.trim();

function build(source: string, target: 'react' | 'solid' | 'svelte' | 'vue'): string {
  return compile(source, { target, filename: 'A.dce' }).js.code;
}

describe('effect cleanup', () => {
  it('routes a Vue teardown through onCleanup', () => {
    const code = build(WITH_CLEANUP, 'vue');

    // watchEffect ignores a returned value; the teardown has to be registered.
    expect(code).toContain('watchEffect((onCleanup) =>');
    expect(code).toContain('onCleanup(__cleanup)');
  });

  it('routes a Solid teardown through onCleanup', () => {
    const code = build(WITH_CLEANUP, 'solid');

    expect(code).toContain('onCleanup(__cleanup)');
    expect(code).toContain("from 'solid-js'");
    expect(() =>
      parseJS(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] })
    ).not.toThrow();
  });

  it('leaves React and Svelte teardown untouched', () => {
    // Both honour a returned function natively, so no wrapper is needed.
    expect(build(WITH_CLEANUP, 'react')).not.toContain('__cleanup');
    expect(build(WITH_CLEANUP, 'svelte')).not.toContain('__cleanup');
  });

  it('does not wrap an effect that returns nothing', () => {
    for (const target of ['vue', 'solid'] as const) {
      const code = build(WITHOUT_CLEANUP, target);
      expect(code).not.toContain('__cleanup');
    }
  });
});

describe('Solid setter transform in effects', () => {
  it('rewrites an assignment nested inside a callback', () => {
    const code = build(WITH_CLEANUP, 'solid');

    expect(code).toContain('setOpen(false)');
    // The bug produced `open() = false`, which does not parse.
    expect(code).not.toContain('open() =');
  });

  it('still rewrites assignments in function bodies', () => {
    const code = build(`
<script>
  let n = $state(0);
  function bump() { n = n + 1; }
</script>
<template><div>{n}</div></template>
    `.trim(), 'solid');

    expect(code).toContain('setN(');
  });
});

describe('returnsTeardown', () => {
  it('detects a return at the effect body level', () => {
    expect(returnsTeardown('{ return () => {}; }')).toBe(true);
  });

  it('ignores a return nested inside a callback', () => {
    expect(returnsTeardown('{ items.map((x) => { return x; }); }')).toBe(false);
  });

  it('ignores the word return inside a string', () => {
    expect(returnsTeardown('{ log("return value"); }')).toBe(false);
  });

  it('is false for a body with no return', () => {
    expect(returnsTeardown('{ console.log(1); }')).toBe(false);
  });

  it('does not match an identifier ending in return', () => {
    expect(returnsTeardown('{ earlyreturn(); }')).toBe(false);
  });
});
