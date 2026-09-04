/**
 * Regression tests for slot fallback content in the React and Solid generators.
 *
 * Fallback content sits to the right of `??`. That is expression position, but
 * `generateJSX` produces child-position JSX, where a conditional or loop is
 * wrapped in the braces of a JSX expression container. Emitting those braces
 * unchanged produced `props.header ?? {cond && (...)}`, which reads as an
 * object literal and does not parse.
 *
 * Stripping the braces alone is not enough: `??` binds tighter than the `&&`
 * and `?:` that conditionals generate, so the expression also has to be
 * parenthesized or it silently regroups as `(props.header ?? cond) && (...)`.
 */
import { describe, it, expect } from 'vitest';
import { parse as parseJS } from '@babel/parser';
import { compile } from '../index';

const TARGETS = ['react', 'solid'] as const;

/** Parse generated output as JSX/TSX, surfacing a syntax error as a failure. */
function expectParses(code: string): void {
  expect(() =>
    parseJS(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] })
  ).not.toThrow();
}

const IF_IN_SLOT = `
<script>
  let { hasHeading = false } = $props();
</script>
<template>
  <div class="card">
    <slot name="header">
      {#if hasHeading}
        <h2>Default heading</h2>
      {/if}
    </slot>
  </div>
</template>
`.trim();

const IF_ELSE_IN_SLOT = `
<script>
  let { on = false } = $props();
</script>
<template>
  <div><slot>{#if on}<b>Y</b>{:else}<i>N</i>{/if}</slot></div>
</template>
`.trim();

const EACH_IN_SLOT = `
<script>
  let { items = [] } = $props();
</script>
<template>
  <div><slot>{#each items as item}<li>{item}</li>{/each}</slot></div>
</template>
`.trim();

const EXPRESSION_IN_SLOT = `
<script>
  let { label = 'none' } = $props();
</script>
<template>
  <div><slot>{label}</slot></div>
</template>
`.trim();

describe('slot fallback content', () => {
  for (const target of TARGETS) {
    describe(target, () => {
      it('parses when the fallback is an {#if} block', () => {
        const { code } = compile(IF_IN_SLOT, { target, filename: 'Card.dce' }).js;

        expectParses(code);
        // The bug emitted `?? {hasHeading && (`, an object literal.
        expect(code).not.toMatch(/\?\?\s*\{/);
      });

      it('parenthesizes an {#if} fallback so `??` does not capture the condition', () => {
        const { code } = compile(IF_IN_SLOT, { target, filename: 'Card.dce' }).js;

        // Without the parens this regroups as `(props.header ?? hasHeading) && (...)`.
        expect(code).toMatch(/props\.header \?\? \(\s*\n\s*hasHeading &&/);
      });

      it('parenthesizes an {#if}{:else} fallback ternary', () => {
        const { code } = compile(IF_ELSE_IN_SLOT, { target, filename: 'Card.dce' }).js;

        expectParses(code);
        // Without the parens this regroups as `(props.children ?? on) ? ... : ...`.
        expect(code).toMatch(/props\.children \?\? \(\s*\n\s*on \?/);
      });

      it('parses when the fallback is an {#each} block', () => {
        const { code } = compile(EACH_IN_SLOT, { target, filename: 'Card.dce' }).js;

        expectParses(code);
        // `.map()` is a call expression, so it needs no extra parens.
        expect(code).toContain('props.children ?? items.map(');
      });

      it('unwraps an expression fallback', () => {
        const { code } = compile(EXPRESSION_IN_SLOT, { target, filename: 'Card.dce' }).js;

        expectParses(code);
        expect(code).toContain('props.children ?? label');
      });

      it('still emits a plain element fallback unchanged', () => {
        const source = `<template><div><slot name="header"><h2>Hi</h2></slot></div></template>`;
        const { code } = compile(source, { target, filename: 'Card.dce' }).js;

        expectParses(code);
        expect(code).toContain('props.header ?? <h2>');
      });

      it('still emits a text fallback as a string literal', () => {
        const source = `<template><div><slot>Nothing here</slot></div></template>`;
        const { code } = compile(source, { target, filename: 'Card.dce' }).js;

        expectParses(code);
        expect(code).toContain('props.children ?? "Nothing here"');
      });

      it('renders text in a multi-child fallback as text, not a quoted literal', () => {
        const source = `<template><div><slot>Hello <b>there</b></slot></div></template>`;
        const { code } = compile(source, { target, filename: 'Card.dce' }).js;

        expectParses(code);
        // Inside the fragment the text is in child position, so quoting it
        // would render the quote marks.
        expect(code).not.toContain('"Hello"');
        expect(code).toContain('Hello');
      });

      it('keeps child-position braces inside a multi-child fallback fragment', () => {
        const source = `
<script>
  let { on = false } = $props();
</script>
<template>
  <div><slot><span>a</span>{#if on}<b>Y</b>{/if}</slot></div>
</template>
`.trim();
        const { code } = compile(source, { target, filename: 'Card.dce' }).js;

        expectParses(code);
        expect(code).toContain('{on && (');
      });

      it('treats a whitespace-only fallback as no fallback', () => {
        const source = `<template><div><slot>\n  </slot></div></template>`;
        const { code } = compile(source, { target, filename: 'Card.dce' }).js;

        expectParses(code);
        expect(code).toContain('{props.children}');
        expect(code).not.toContain('??');
      });
    });
  }
});
