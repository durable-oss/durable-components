/**
 * Regression tests for `<dce:element>` tag names and attributes.
 *
 * Two bugs, both only visible on dce:* elements because ordinary elements route
 * their attributes through `bindings` while dce:* elements use the `attributes`
 * array:
 *
 * 1. React emitted the tag expression directly as the JSX tag name, so
 *    `<dce:element this={tag}>` became `<tag>` — a lowercase JSX name is a host
 *    element, not the variable.
 * 2. Regular attributes were emitted verbatim: interpolation was never applied
 *    (`style="width: {w}px"` stayed literal), Solid dropped them entirely, Vue
 *    emitted an expression as a static attribute, and Svelte double-quoted it.
 */
import { describe, it, expect } from 'vitest';
import { parse as parseJS } from '@babel/parser';
import { compile } from '../index';

const SOURCE = `
<script>
  let { tag = 'div', w = 1 } = $props();
</script>
<template>
  <dce:element this={tag} id="static" style="width: {w}px">x</dce:element>
</template>
`.trim();

function build(target: 'react' | 'solid' | 'svelte' | 'vue'): string {
  return compile(SOURCE, { target, filename: 'A.dce' }).js.code;
}

describe('dce:element tag name', () => {
  it('binds the tag expression to a capitalized local for React', () => {
    const code = build('react');

    expect(() =>
      parseJS(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] })
    ).not.toThrow();
    expect(code).toMatch(/const DceTag1 = tag;/);
    expect(code).toContain('<DceTag1');
    // The bug emitted a lowercase host element.
    expect(code).not.toMatch(/<tag[\s/>]/);
  });

  it('reuses one alias for a repeated tag expression', () => {
    const source = `
<script>
  let { tag = 'div' } = $props();
</script>
<template>
  <div>
    <dce:element this={tag}>a</dce:element>
    <dce:element this={tag}>b</dce:element>
  </div>
</template>
    `.trim();

    const code = compile(source, { target: 'react', filename: 'A.dce' }).js.code;

    expect(code.match(/const DceTag\d = /g)).toHaveLength(1);
    expect(code.match(/<DceTag1/g)).toHaveLength(2);
  });

  it('passes the tag as a value on the other targets', () => {
    expect(build('solid')).toContain('component={tag}');
    expect(build('vue')).toContain(':is="tag"');
    expect(build('svelte')).toContain('this={tag}');
  });
});

describe('dce:element attributes', () => {
  it('applies interpolation on every target', () => {
    // React converts the CSS string to an object at runtime; the others accept
    // the template literal directly.
    expect(build('react')).toContain('`width: ${w}px`');
    expect(build('solid')).toContain('style={`width: ${w}px`}');
    expect(build('vue')).toContain(':style="`width: ${w}px`"');
    expect(build('svelte')).toContain('style={`width: ${w}px`}');
  });

  it('keeps a plain static attribute static', () => {
    expect(build('react')).toContain('id="static"');
    expect(build('solid')).toContain('id="static"');
    expect(build('vue')).toContain('id="static"');
    // The bug double-quoted this as id=""static"".
    expect(build('svelte')).toContain('id="static"');
    expect(build('svelte')).not.toContain('id=""static""');
  });

  it('does not drop regular attributes on Solid', () => {
    const code = build('solid');

    expect(code).toContain('id=');
    expect(code).toContain('style=');
  });
});
