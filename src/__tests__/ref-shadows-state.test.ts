/**
 * Tests for a name that is both `$state` and a `bind:this` target.
 *
 * `bind:this={panel}` declares `panel` itself, so writing
 * `let panel = $state(null)` alongside it names the same binding twice. Every
 * target used to emit both declarations into one scope, which is a syntax
 * error rather than merely redundant. The ref wins, the state declaration is
 * dropped, and a warning reports it.
 */
import { describe, it, expect } from 'vitest';
import { parse as parseJS } from '@babel/parser';
import { compile } from '../index';

const TARGETS = ['react', 'solid', 'svelte', 'vue'] as const;
type Target = (typeof TARGETS)[number];

const SHADOWED = `
<script>
  let panel = $state(null);
  function focus() { panel.focus(); }
</script>
<template>
  <div bind:this={panel} on:click={focus}>hi</div>
</template>
`.trim();

function build(source: string, target: Target) {
  return compile(source.trim(), { target, filename: 'Panel.dce' });
}

/** The JS half of an output, so Svelte and Vue markup doesn't reach the parser. */
function script(code: string): string {
  const match = code.match(/<script[^>]*>([\s\S]*?)<\/script>/);
  return match ? match[1] : code;
}

/** How many times `name` is declared with let/const in the emitted code. */
function declarationsOf(code: string, name: string): number {
  const pattern = new RegExp(
    `(?:const|let)\\s+(?:\\[\\s*${name}\\b|${name}\\b)`,
    'g'
  );
  return (code.match(pattern) ?? []).length;
}

describe('bind:this on a $state name', () => {
  for (const target of TARGETS) {
    describe(target, () => {
      it('declares the binding exactly once', () => {
        const code = build(SHADOWED, target).js.code;

        expect(declarationsOf(code, 'panel')).toBe(1);
      });

      it('produces parseable script', () => {
        const code = build(SHADOWED, target).js.code;

        expect(() =>
          parseJS(script(code), {
            sourceType: 'module',
            plugins: ['jsx', 'typescript']
          })
        ).not.toThrow();
      });

      it('keeps the binding usable from the template and script', () => {
        const code = build(SHADOWED, target).js.code;

        expect(code).toContain('panel');
      });

      it('warns that the state declaration was dropped', () => {
        const { warnings } = build(SHADOWED, target);

        expect(warnings).toBeDefined();
        expect(warnings).toHaveLength(1);
        expect(warnings![0].code).toBe('REF_SHADOWS_STATE');
        expect(warnings![0].message).toContain('panel');
      });

      it('leaves unrelated state alone', () => {
        const { js, warnings } = build(
          `
<script>
  let count = $state(0);
  let panel;
</script>
<template>
  <div bind:this={panel}>{count}</div>
</template>
          `,
          target
        );

        expect(warnings).toBeUndefined();
        expect(js.code).toContain('count');
        expect(declarationsOf(js.code, 'panel')).toBe(1);
      });
    });
  }

  it('emits no warning when there is no collision', () => {
    for (const target of TARGETS) {
      const { warnings } = build(
        `
<script>
  let panel;
</script>
<template>
  <div bind:this={panel}>hi</div>
</template>
        `,
        target
      );

      expect(warnings).toBeUndefined();
    }
  });

  it('declares a plain bind:this target on Svelte', () => {
    // Svelte previously emitted no declaration at all for a ref, leaving the
    // emitted component referencing an undeclared name.
    const code = build(
      `
<script>
  let panel;
  function focus() { panel.focus(); }
</script>
<template>
  <div bind:this={panel} on:click={focus}>hi</div>
</template>
      `,
      'svelte'
    ).js.code;

    expect(code).toContain('let panel;');
    // A DOM handle is not reactive state, so it takes no rune.
    expect(code).not.toContain('let panel = $state');
  });

  it('reports every shadowed name', () => {
    const { warnings } = build(
      `
<script>
  let head = $state(null);
  let foot = $state(null);
</script>
<template>
  <div>
    <p bind:this={head}>h</p>
    <p bind:this={foot}>f</p>
  </div>
</template>
      `,
      'react'
    );

    expect(warnings).toHaveLength(2);
    expect(warnings!.map((warning) => warning.message).join(' ')).toContain('head');
    expect(warnings!.map((warning) => warning.message).join(' ')).toContain('foot');
  });
});
