/**
 * Regression tests for three reported generator bugs:
 *
 * 1. React/Solid emitted a literal `<slot />`, which is not valid JSX. The
 *    parser has no Slot AST node, so `<slot />` reaches the generator as an
 *    ordinary element and never hit the `case 'slot'` branch.
 * 2. Svelte emitted unquoted attribute values (`class=cls`), which Svelte reads
 *    as the literal string "cls" rather than the variable.
 * 3. Vue's `computed()` referenced a bare prop identifier (`variant`) instead of
 *    `props.variant`, which is undefined in script scope.
 */
import { describe, it, expect } from 'vitest';
import { compile } from '../index';

const BUTTON = `
<script>
  let { variant = 'primary', disabled = false } = $props();
  let cls = $derived('btn btn-' + variant);
</script>

<template>
  <button class={cls} {disabled}>
    <slot />
  </button>
</template>
`.trim();

describe('slot emission', () => {
  for (const target of ['react', 'solid'] as const) {
    describe(target, () => {
      it('never emits a literal <slot> tag', () => {
        const { code } = compile(BUTTON, { target, filename: 'Button.dce' }).js;

        expect(code).not.toContain('<slot');
        expect(code).toContain('{props.children}');
      });

      it('maps a default slot to props.children', () => {
        const source = `<template><div><slot /></div></template>`;
        const { code } = compile(source, { target, filename: 'S.dce' }).js;

        expect(code).toContain('{props.children}');
      });

      it('maps a named slot to a prop of that name', () => {
        const source = `<template><div><slot name="header" /></div></template>`;
        const { code } = compile(source, { target, filename: 'S.dce' }).js;

        expect(code).toContain('{props.header}');
        expect(code).not.toContain('<slot');
      });

      it('indexes a named slot whose name is not an identifier', () => {
        const source = `<template><div><slot name="my-slot" /></div></template>`;
        const { code } = compile(source, { target, filename: 'S.dce' }).js;

        expect(code).toContain('{props["my-slot"]}');
      });

      it('quotes text fallback content, which sits in expression position', () => {
        const source = `<template><div><slot>Nothing here</slot></div></template>`;
        const { code } = compile(source, { target, filename: 'S.dce' }).js;

        expect(code).toContain('{props.children ?? "Nothing here"}');
      });

      it('renders element fallback content behind ??', () => {
        const source = `<template><div><slot><span>Empty</span></slot></div></template>`;
        const { code } = compile(source, { target, filename: 'S.dce' }).js;

        expect(code).toContain('props.children ??');
        expect(code).toContain('<span>');
      });

      it('wraps multiple fallback children in a fragment', () => {
        const source = `<template><div><slot><span>a</span><span>b</span></slot></div></template>`;
        const { code } = compile(source, { target, filename: 'S.dce' }).js;

        expect(code).toContain('props.children ?? <>');
      });

      it('combines a named slot with its fallback', () => {
        const source = `<template><div><slot name="footer"><p>None</p></slot></div></template>`;
        const { code } = compile(source, { target, filename: 'S.dce' }).js;

        expect(code).toContain('props.footer ??');
      });
    });
  }

  for (const target of ['svelte', 'vue'] as const) {
    it(`${target} keeps the native <slot> element`, () => {
      const { code } = compile(BUTTON, { target, filename: 'Button.dce' }).js;

      expect(code).toContain('<slot />');
    });
  }
});

describe('svelte attribute quoting', () => {
  it('braces a dynamic binding rather than emitting a bare word', () => {
    const { code } = compile(BUTTON, { target: 'svelte', filename: 'Button.dce' }).js;

    expect(code).toContain('class={cls}');
    expect(code).toContain('disabled={disabled}');
    expect(code).not.toMatch(/class=cls\b/);
    expect(code).not.toMatch(/disabled=disabled\b/);
  });

  it('leaves a static attribute quoted', () => {
    const source = `<template><button class="btn" type="submit">x</button></template>`;
    const { code } = compile(source, { target: 'svelte', filename: 'S.dce' }).js;

    expect(code).toContain('class="btn"');
    expect(code).toContain('type="submit"');
  });
});

describe('vue prop references in script scope', () => {
  it('qualifies a prop used in a computed', () => {
    const { code } = compile(BUTTON, { target: 'vue', filename: 'Button.dce' }).js;

    expect(code).toContain("computed(() => 'btn btn-' + props.variant)");
  });

  it('qualifies a prop used in a function body', () => {
    const source = `
<script>
  let { step = 1 } = $props();
  let count = $state(0);

  function bump() {
    count = count + step;
  }
</script>

<template><button on:click={bump}>{count}</button></template>
`.trim();
    const { code } = compile(source, { target: 'vue', filename: 'C.dce' }).js;

    expect(code).toContain('props.step');
  });

  it('leaves the template unqualified, since <script setup> exposes props by name', () => {
    const source = `
<script>
  let { label = 'Go' } = $props();
</script>

<template><button>{label}</button></template>
`.trim();
    const { code } = compile(source, { target: 'vue', filename: 'L.dce' }).js;

    expect(code).toContain('<template>');
    expect(code.split('<template>')[1]).toContain('{{ label }}');
  });

  it('does not rewrite a same-named property of another object', () => {
    const source = `
<script>
  let { variant = 'a' } = $props();
  let theme = $state({ variant: 'b' });
  let picked = $derived(theme.variant + variant);
</script>

<template><span>{picked}</span></template>
`.trim();
    const { code } = compile(source, { target: 'vue', filename: 'T.dce' }).js;

    expect(code).toContain('theme.value.variant + props.variant');
  });

  it('does not rewrite a matching word inside a string literal', () => {
    const source = `
<script>
  let { variant = 'a' } = $props();
  let label = $derived('variant: ' + variant);
</script>

<template><span>{label}</span></template>
`.trim();
    const { code } = compile(source, { target: 'vue', filename: 'Q.dce' }).js;

    expect(code).toContain("'variant: ' + props.variant");
  });

  it('does not rewrite an object key that shares a prop name', () => {
    const source = `
<script>
  let { variant = 'a' } = $props();
  let payload = $derived({ variant: variant });
</script>

<template><span>{payload}</span></template>
`.trim();
    const { code } = compile(source, { target: 'vue', filename: 'K.dce' }).js;

    expect(code).toContain('variant: props.variant');
  });
});
