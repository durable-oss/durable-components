/**
 * Regression tests for `<dce:window>`.
 *
 * Every generator built the addEventListener strings and then returned '',
 * discarding them — the directive emitted nothing on any of the four targets,
 * so window handlers written in the DSL never fired. Window listeners are
 * mount/unmount effects, so they now route through the same lifecycle path as
 * the behavior primitives.
 */
import { describe, it, expect } from 'vitest';
import { parse as parseJS } from '@babel/parser';
import { compile } from '../index';

const SOURCE = `
<script>
  function onResize(e) { console.log(e); }
</script>
<template>
  <div><dce:window on:resize={onResize} /><p>x</p></div>
</template>
`.trim();

function build(target: 'react' | 'solid' | 'svelte' | 'vue'): string {
  return compile(SOURCE, { target, filename: 'W.dce' }).js.code;
}

describe('dce:window', () => {
  for (const target of ['react', 'solid', 'svelte', 'vue'] as const) {
    describe(target, () => {
      it('registers the listener', () => {
        const code = build(target);

        expect(code).toContain("window.addEventListener('resize'");
      });

      it('removes the listener on unmount', () => {
        const code = build(target);

        expect(code).toContain("window.removeEventListener('resize'");
      });

      it('declares the handler before the lifecycle block uses it', () => {
        const code = build(target);

        // The emitted handler is a `const` on most targets, so referencing it
        // earlier would be a temporal dead zone error.
        expect(code.indexOf('onResize')).toBeLessThan(
          code.indexOf("window.addEventListener('resize'")
        );
      });
    });
  }

  it('produces parseable JSX', () => {
    for (const target of ['react', 'solid'] as const) {
      expect(() =>
        parseJS(build(target), { sourceType: 'module', plugins: ['jsx', 'typescript'] })
      ).not.toThrow();
    }
  });
});
