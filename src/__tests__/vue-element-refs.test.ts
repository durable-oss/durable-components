/**
 * Regression tests for `bind:this` on Vue.
 *
 * Vue emitted `v-model:this="dialog"` — not a real directive, so the reference
 * was never populated — and never declared the ref variable at all, so script
 * code referring to it hit an undefined identifier.
 */
import { describe, it, expect } from 'vitest';
import { compile } from '../index';

const SOURCE = `
<script>
  let dialog;
</script>
<template>
  <div bind:this={dialog}>x</div>
</template>
`.trim();

function vue(source: string): string {
  return compile(source.trim(), { target: 'vue', filename: 'A.dce' }).js.code;
}

describe('Vue element refs', () => {
  it('uses the ref attribute, not v-model:this', () => {
    const code = vue(SOURCE);

    expect(code).toContain('ref="dialog"');
    expect(code).not.toContain('v-model:this');
  });

  it('declares the ref in the script', () => {
    const code = vue(SOURCE);

    expect(code).toContain('const dialog = ref(null);');
  });

  it('reaches the element through .value in script scope', () => {
    const code = vue(`
<script>
  let dialog;
  $effect(() => { console.log(dialog); });
</script>
<template>
  <div bind:this={dialog}>x</div>
</template>
    `);

    expect(code).toContain('dialog.value');
  });

  it('leaves a real two-way binding alone', () => {
    const code = vue(`
<script>
  let name = $state('');
</script>
<template>
  <input bind:value={name} />
</template>
    `);

    expect(code).toContain('v-model="name"');
  });
});
