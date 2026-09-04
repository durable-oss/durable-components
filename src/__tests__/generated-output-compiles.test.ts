/**
 * Compile the generated output with each target's real compiler.
 *
 * String assertions confirm that codegen produced the text we expected; they do
 * not confirm the result is valid code. Two shipped bugs were invisible to them:
 * a slot fallback emitted `props.header ?? {cond && (...)}` (an object literal
 * in expression position), and a compound assignment emitted `count() += 1`
 * (an invalid assignment target). Both are syntax errors that only a parser
 * catches, so these tests run the output through babel for the JSX targets and
 * through the Svelte compiler for Svelte.
 */
import { describe, it, expect } from 'vitest';
import { compile } from '../index';
import { compile as svelteCompile } from 'svelte/compiler';
import * as babel from '@babel/core';

const JSX_TARGETS = ['react', 'solid'] as const;
const ALL_TARGETS = [...JSX_TARGETS, 'svelte', 'vue'] as const;

/** Compile generated JSX with babel, surfacing a syntax error as a test failure. */
function expectJsxCompiles(code: string): void {
  expect(() =>
    babel.transformSync(code, {
      presets: [
        ['babel-preset-solid'],
        ['@babel/preset-typescript', { isTSX: true, allExtensions: true }]
      ],
      filename: 'Component.tsx',
      configFile: false,
      babelrc: false
    })
  ).not.toThrow();
}

/** Compile generated Svelte source with the Svelte compiler. */
function expectSvelteCompiles(code: string): void {
  expect(() => svelteCompile(code, { filename: 'Component.svelte' })).not.toThrow();
}

/** Run a source file through a target and hand the output to its real compiler. */
function expectCompiles(source: string, target: (typeof ALL_TARGETS)[number]): string {
  const { code } = compile(source, { target, filename: 'Component.dce' }).js;

  if (target === 'react' || target === 'solid') {
    expectJsxCompiles(code);
  } else if (target === 'svelte') {
    expectSvelteCompiles(code);
  }

  return code;
}

const KITCHEN_SINK = `
<script>
  let { label = 'hi', items = [] } = $props();
  let count = $state(0);
  let double = $derived(count * 2);
  function inc() { count += 1; }
</script>
<template>
  <div class="box">
    <button onclick={inc}>{label} {double}</button>
    {#if count > 0}<p>positive</p>{:else}<p>zero</p>{/if}
    {#each items as item}<li>{item}</li>{/each}
    <slot name="footer">{#if count}<b>{count}</b>{/if}</slot>
  </div>
</template>
`.trim();

describe('generated output compiles', () => {
  for (const target of ['react', 'solid', 'svelte'] as const) {
    describe(target, () => {
      it('compiles a component using props, state, derived, control flow and slots', () => {
        expectCompiles(KITCHEN_SINK, target);
      });

      it('compiles a component with no script block', () => {
        expectCompiles(`<template><div><p>static</p></div></template>`, target);
      });

      it('compiles nested control flow', () => {
        const source = `
<script>
  let { rows = [] } = $props();
</script>
<template>
  <table>
    {#each rows as row}
      {#if row.visible}<tr><td>{row.name}</td></tr>{/if}
    {/each}
  </table>
</template>
`.trim();
        expectCompiles(source, target);
      });

      it('compiles a slot whose fallback is a conditional', () => {
        const source = `
<script>
  let { show = false } = $props();
</script>
<template>
  <div><slot>{#if show}<b>fallback</b>{/if}</slot></div>
</template>
`.trim();
        expectCompiles(source, target);
      });

      it('compiles a slot whose fallback is a loop', () => {
        const source = `
<script>
  let { defaults = [] } = $props();
</script>
<template>
  <div><slot>{#each defaults as d}<li>{d}</li>{/each}</slot></div>
</template>
`.trim();
        expectCompiles(source, target);
      });
    });
  }

  describe('state mutation', () => {
    // `count += 1` used to survive codegen untouched. In Solid that produced
    // `count() += 1`, a syntax error. In React it produced `count += 1`, which
    // parses but assigns to the `const` binding from useState rather than
    // scheduling a render — a silent bug the compiler cannot catch.
    const OPERATORS = ['+=', '-=', '*=', '/=', '%=', '**=', '<<=', '>>=', '&&=', '||=', '??='];

    for (const target of JSX_TARGETS) {
      describe(target, () => {
        for (const op of OPERATORS) {
          it(`routes \`count ${op} 2\` through the setter`, () => {
            const source = `
<script>
  let count = $state(0);
  function update() { count ${op} 2; }
</script>
<template><button onclick={update}>{count}</button></template>
`.trim();
            const code = expectCompiles(source, target);

            expect(code).toContain('setCount(');
            // The raw operator must not survive into the output.
            expect(code).not.toContain(`count ${op}`);
          });
        }

        it('resolves state on both sides of a compound assignment', () => {
          const source = `
<script>
  let count = $state(0);
  let step = $state(5);
  function update() { count += step; }
</script>
<template><button onclick={update}>{count}</button></template>
`.trim();
          const code = expectCompiles(source, target);

          const expected =
            target === 'solid'
              ? 'setCount(count() + step())'
              : 'setCount(count + step)';
          expect(code).toContain(expected);
        });

        it('still handles increment, decrement and plain assignment', () => {
          const source = `
<script>
  let count = $state(0);
  function up() { count++; }
  function down() { count--; }
  function reset() { count = 0; }
</script>
<template><button onclick={up}>{count}</button></template>
`.trim();
          const code = expectCompiles(source, target);

          expect(code).toContain('setCount(count');
          expect(code).toMatch(/setCount\(\s*0\)/);
        });

        it('keeps a comparison operator out of the setter rewrite', () => {
          const source = `
<script>
  let count = $state(0);
  let big = $derived(count >= 10);
</script>
<template><b>{big}</b></template>
`.trim();
          const code = expectCompiles(source, target);

          // `>=` is a comparison, not an assignment; it must survive intact.
          expect(code).toMatch(/count(\(\))? >= 10/);
        });
      });
    }
  });
});

const BEHAVIOR_PRIMITIVES = `
<script>
  let { onClose } = $props();
  let dialog;
  function onResize(e) { console.log(e); }
</script>
<template>
  <div>
    <dce:window on:resize={onResize} />
    <dce:scroll-lock />
    <dce:escape on:escape={onClose} />
    <dce:timer after={5000} on:elapsed={onClose} />
    <dce:focus-trap for={dialog} />
    <div bind:this={dialog} role="dialog"><slot /></div>
  </div>
</template>
`.trim();

describe('behavior primitives compile', () => {
  for (const target of ALL_TARGETS) {
    it(`${target} output compiles`, () => {
      const code = expectCompiles(BEHAVIOR_PRIMITIVES, target);

      // The inline helpers and their lifecycle wiring both have to be present.
      expect(code).toContain('__dceFocusTrap');
      expect(code).toContain("window.addEventListener('resize'");
    });
  }
});
