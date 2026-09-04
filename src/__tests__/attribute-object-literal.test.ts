/**
 * Regression tests for object literals in attribute position.
 *
 * `parseExpression` parsed the mustache body in statement position and only
 * retried it parenthesized when the bare parse threw. `{ color: 'red' }` parses
 * cleanly as a block containing a labeled statement, so no error was raised,
 * the wrong AST was kept, and `extractExpression` found no expression to
 * serialize — `style={{ color: 'red' }}` compiled to `style={{}}`.
 *
 * `{ a: 1, b: 2 }` did throw (a comma at statement level), which is why the
 * multi-key case behaved differently from the single-key one.
 */
import { describe, it, expect } from 'vitest';
import { compile } from '../index';
import { parseTemplate } from '../parser/template-parser';

const TARGETS = ['react', 'solid', 'svelte', 'vue'] as const;

function source(attribute: string): string {
  return `
<script>
  let { c = 'red' } = $props();
</script>
<template>
  <div ${attribute}></div>
</template>
  `.trim();
}

describe('object literals in attributes', () => {
  it('parses the mustache body as an expression, not a block', () => {
    const [element] = parseTemplate(`<div style={{ color: 'red' }}></div>`) as any[];
    const program = element.attributes[0].value[0].expression;

    expect(program.body[0].type).toBe('ExpressionStatement');
    expect(program.body[0].expression.type).toBe('ObjectExpression');
  });

  for (const target of TARGETS) {
    describe(target, () => {
      it('keeps a single-key object literal', () => {
        const { code } = compile(source(`style={{ color: c }}`), {
          target,
          filename: 'A.dce'
        }).js;

        expect(code).toContain('color');
        // The bug emitted an empty object.
        expect(code).not.toMatch(/style\s*=\s*["']?\{\{\}\}/);
      });

      it('keeps a multi-key object literal', () => {
        const { code } = compile(source(`style={{ color: c, margin: 0 }}`), {
          target,
          filename: 'A.dce'
        }).js;

        expect(code).toContain('color');
        expect(code).toContain('margin');
      });
    });
  }

  it('does not route an object-valued style through the React helper', () => {
    const { code } = compile(source(`style={{ color: c }}`), {
      target: 'react',
      filename: 'A.dce'
    }).js;

    expect(code).not.toContain('__dceStyle');
  });

  it('still parses a genuine block body as a block', () => {
    const blockBody = `
<script>
  let n = $state(0);
</script>
<template>
  <button on:click={() => { n = n + 1; }}>go</button>
</template>
    `.trim();

    const { code } = compile(blockBody, { target: 'react', filename: 'A.dce' }).js;

    expect(code).toContain('n + 1');
  });
});
