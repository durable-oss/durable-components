/**
 * Regression tests for Vue's `defineProps` emission.
 *
 * Two bugs, both in the same declaration:
 *
 * 1. `withDefaults(defineProps<{...}>(), {...})` is TypeScript, but it was
 *    emitted regardless of the source language, so a plain-JS component
 *    produced a generic inside a plain `<script setup>` that will not compile.
 *
 * 2. The no-defaults branch built a RUNTIME options object out of TYPE NAMES:
 *    `defineProps({ title: any })`, where `any` is an undefined identifier at
 *    runtime.
 */
import { describe, it, expect } from 'vitest';
import { compile } from '../index';
import { runtimePropType } from '../generators/vue-props';

function vue(source: string): string {
  return compile(source.trim(), { target: 'vue', filename: 'A.dce' }).js.code;
}

const JS_WITH_DEFAULTS = `
<script>
  let { name = 'World', count = 0 } = $props();
</script>
<template>
  <p>{name} {count}</p>
</template>
`;

const JS_WITHOUT_DEFAULTS = `
<script>
  let { title } = $props();
</script>
<template>
  <div>{title}</div>
</template>
`;

const TS_WITH_DEFAULTS = `
<script lang="ts">
  let { name = 'World' } = $props();
</script>
<template>
  <p>{name}</p>
</template>
`;

describe('Vue defineProps form', () => {
  it('uses the runtime form for a JavaScript source', () => {
    const code = vue(JS_WITH_DEFAULTS);

    expect(code).toContain('<script setup>');
    expect(code).not.toContain('lang="ts"');
    // The bug emitted a TypeScript generic here.
    expect(code).not.toContain('withDefaults');
    expect(code).not.toContain('defineProps<');
  });

  it('carries defaults in the runtime descriptor', () => {
    const code = vue(JS_WITH_DEFAULTS);

    expect(code).toContain("name: { default: 'World' }");
    expect(code).toContain('count: { default: 0 }');
  });

  it('never emits a bare type name as a runtime value', () => {
    const code = vue(JS_WITHOUT_DEFAULTS);

    // The bug emitted `title: any`, a ReferenceError at runtime.
    expect(code).not.toMatch(/title:\s*any\b/);
    expect(code).toContain('title: null');
  });

  it('uses a factory for object and array defaults', () => {
    const code = vue(`
<script>
  let { items = [], config = { a: 1 } } = $props();
</script>
<template>
  <div>{items.length}</div>
</template>
    `);

    // Sharing one object across instances is the classic Vue footgun.
    expect(code).toContain('default: () => ([])');
    expect(code).toContain('default: () => ({ a: 1 })');
  });

  it('uses the type form under lang="ts"', () => {
    const code = vue(TS_WITH_DEFAULTS);

    expect(code).toContain('<script setup lang="ts">');
    expect(code).toContain('withDefaults(defineProps<{');
    expect(code).toContain("name: 'World'");
  });
});

describe('runtimePropType', () => {
  it('maps primitive type names to constructors', () => {
    expect(runtimePropType('string')).toBe('String');
    expect(runtimePropType('number')).toBe('Number');
    expect(runtimePropType('boolean')).toBe('Boolean');
  });

  it('maps array and record shapes', () => {
    expect(runtimePropType('string[]')).toBe('Array');
    expect(runtimePropType('Array<number>')).toBe('Array');
    expect(runtimePropType('Record<string, number>')).toBe('Object');
  });

  it('maps a function type', () => {
    expect(runtimePropType('(e: Event) => void')).toBe('Function');
  });

  it('falls back to null for anything unvalidatable', () => {
    expect(runtimePropType('any')).toBe('null');
    expect(runtimePropType(undefined)).toBe('null');
    expect(runtimePropType('Foo | Bar')).toBe('null');
  });

  it('ignores a trailing null or undefined union member', () => {
    expect(runtimePropType('string | undefined')).toBe('String');
    expect(runtimePropType('number | null')).toBe('Number');
  });
});
