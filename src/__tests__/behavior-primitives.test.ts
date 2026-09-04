/**
 * Tests for the dce:* behavior primitives.
 *
 * `<dce:focus-trap>`, `<dce:escape>`, `<dce:scroll-lock>`, and `<dce:timer>`
 * compile to a mount/unmount effect rather than to markup, so each generator
 * wires them into its own lifecycle: useEffect on React, onMount/onCleanup on
 * Solid, onMounted/onUnmounted on Vue, $effect on Svelte.
 */
import { describe, it, expect } from 'vitest';
import { parse as parseJS } from '@babel/parser';
import { compile } from '../index';

const TARGETS = ['react', 'solid', 'svelte', 'vue'] as const;
type Target = (typeof TARGETS)[number];

const DIALOG = `
<script>
  let { onClose } = $props();
  let dialog;
</script>
<template>
  <div>
    <dce:scroll-lock />
    <dce:escape on:escape={onClose} />
    <dce:timer after={5000} on:elapsed={onClose} />
    <dce:focus-trap for={dialog} />
    <div bind:this={dialog} role="dialog"><slot /></div>
  </div>
</template>
`.trim();

function build(source: string, target: Target): string {
  return compile(source.trim(), { target, filename: 'Dialog.dce' }).js.code;
}

/** Parse JSX output, surfacing a syntax error as a failure. */
function expectParses(code: string): void {
  expect(() =>
    parseJS(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] })
  ).not.toThrow();
}

describe('behavior primitives', () => {
  for (const target of TARGETS) {
    describe(target, () => {
      it('emits every requested helper', () => {
        const code = build(DIALOG, target);

        expect(code).toContain('__dceScrollLock');
        expect(code).toContain('__dceEscape');
        expect(code).toContain('__dceTimer');
        expect(code).toContain('__dceFocusTrap');
      });

      it('renders no markup for the primitives themselves', () => {
        const code = build(DIALOG, target);

        expect(code).not.toContain('<dce:');
        expect(code).not.toContain('dce-behavior');
      });

      it('passes the timer delay and handler through', () => {
        const code = build(DIALOG, target);

        expect(code).toMatch(/__dceTimer\(5000, [\w.]*onClose\)/);
      });

      it('emits only the helpers a component uses', () => {
        const code = build(`
<script>
  let { onClose } = $props();
</script>
<template>
  <div><dce:escape on:escape={onClose} /></div>
</template>
        `, target);

        expect(code).toContain('__dceEscape');
        expect(code).not.toContain('__dceFocusTrap');
        expect(code).not.toContain('__dceScrollLock');
        expect(code).not.toContain('__dceTimer');
      });
    });
  }

  it('wires React lifecycle with an empty dependency array', () => {
    const code = build(DIALOG, 'react');

    expectParses(code);
    expect(code).toContain('useEffect(() => __dceScrollLock(), []);');
    // A React ref holds the element on .current.
    expect(code).toContain('__dceFocusTrap(dialog.current)');
  });

  it('registers Solid teardown with onCleanup', () => {
    const code = build(DIALOG, 'solid');

    expectParses(code);
    expect(code).toContain('onMount(');
    expect(code).toContain('onCleanup(__dceScrollLock());');
    expect(code).toContain("from 'solid-js'");
  });

  it('splits Vue lifecycle across onMounted and onUnmounted', () => {
    const code = build(DIALOG, 'vue');

    expect(code).toContain('onMounted(');
    expect(code).toContain('onUnmounted(');
    // Props and element refs need their script-scope accessors.
    expect(code).toContain('__dceEscape(props.onClose)');
    expect(code).toContain('__dceFocusTrap(dialog.value)');
  });

  it('uses $effect on Svelte', () => {
    const code = build(DIALOG, 'svelte');

    expect(code).toContain('$effect(() => __dceScrollLock());');
    expect(code).toContain('__dceFocusTrap(dialog)');
  });

  it('declares lifecycle after functions so handlers are initialized', () => {
    const source = `
<script>
  function close() {}
</script>
<template>
  <div><dce:escape on:escape={close} /></div>
</template>
    `.trim();

    for (const target of TARGETS) {
      const code = build(source, target);
      // The emitted handler is a `const` on most targets, so referencing it
      // from the lifecycle block before its declaration is a TDZ error.
      const handler = code.indexOf('close');
      const usage = code.indexOf('__dceEscape(close)');
      expect(handler).toBeLessThan(usage);
    }
  });

  it('omits a primitive that is missing its required attribute', () => {
    // No on:escape handler, so there is nothing to call.
    const code = build(`
<template>
  <div><dce:escape /></div>
</template>
    `, 'react');

    expect(code).not.toContain('__dceEscape');
  });
});
