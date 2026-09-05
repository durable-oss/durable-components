/**
 * Tests for `dce:*` behavior primitives used inside an `{#each}`.
 *
 * A primitive normally compiles to one component-level mount/unmount effect.
 * Inside a loop that is wrong when the effect reads the loop binding: hoisting
 * it to component scope leaves the binding undefined and the component throws
 * a ReferenceError on mount. Such an effect is emitted per item instead —
 * as a child component on React and Solid, an action on Svelte, and a custom
 * directive on Vue.
 */
import { describe, it, expect } from 'vitest';
import { parse as parseJS } from '@babel/parser';
import { compile } from '../index';

const TARGETS = ['react', 'solid', 'svelte', 'vue'] as const;
type Target = (typeof TARGETS)[number];

const LOOP = `
<script>
  let { items, dismiss } = $props();
</script>
<template>
  <div>
    {#each items as item}
      <span>{item.id}</span>
      <dce:timer after={item.duration} on:elapsed={dismiss} />
    {/each}
  </div>
</template>
`.trim();

function build(source: string, target: Target): string {
  return compile(source.trim(), { target, filename: 'Loop.dce' }).js.code;
}

/** The JS half of an output, so Svelte and Vue markup doesn't reach the parser. */
function script(code: string): string {
  const match = code.match(/<script[^>]*>([\s\S]*?)<\/script>/);
  return match ? match[1] : code;
}

describe('behavior primitives inside {#each}', () => {
  for (const target of TARGETS) {
    describe(target, () => {
      it('does not run the effect at component scope', () => {
        const code = build(LOOP, target);

        // The whole bug: the effect hoisted to component scope, where `item`
        // does not exist. Its call must not appear in any of the hooks that
        // run once per component.
        expect(code).not.toMatch(/useEffect\(\(\) => __dceTimer\([^)]*\), \[\]\)/);
        expect(code).not.toMatch(/\$effect\(\(\) => __dceTimer\(/);
        // Solid's per-item component reads through `props.`, so a bare `item`
        // here would mean the effect was hoisted.
        expect(code).not.toMatch(/onCleanup\(__dceTimer\(item\./);
        expect(code).not.toMatch(/onMounted\(\(\) => \{\s*__dceTeardowns\.push\(__dceTimer\(/);
      });

      it('still emits the timer helper', () => {
        expect(build(LOOP, target)).toContain('__dceTimer');
      });

      it('passes the loop binding into the per-item construct', () => {
        const code = build(LOOP, target);

        // `item` reaches the effect as data, not as a free variable.
        expect(code).toMatch(/item\.duration/);
      });

      it('keeps a primitive that ignores the loop at component scope', () => {
        const code = build(
          `
<script>
  let { items } = $props();
</script>
<template>
  <div>
    {#each items as item}
      <span>{item.id}</span>
      <dce:scroll-lock />
    {/each}
  </div>
</template>
          `,
          target
        );

        // Nothing is captured, so one component-level effect is both correct
        // and cheaper than one per item.
        expect(code).toContain('__dceScrollLock');
        expect(code).not.toContain('display: contents');
      });
    });
  }

  it('emits a per-item component on React', () => {
    const code = build(LOOP, 'react');

    expect(() =>
      parseJS(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] })
    ).not.toThrow();
    expect(code).toContain('function Loop__timer_0(');
    expect(code).toContain('useEffect(() => __dceTimer(item.duration, dismiss), [item, dismiss]);');
    expect(code).toContain('<Loop__timer_0 item={item} dismiss={dismiss} />');
  });

  it('reads props reactively in the Solid per-item component', () => {
    const code = build(LOOP, 'solid');

    expect(() =>
      parseJS(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] })
    ).not.toThrow();
    expect(code).toContain('function Loop__timer_0(props: any)');
    // Destructuring a Solid props object would freeze the value at creation.
    expect(code).toContain('__dceTimer(props.item.duration, props.dismiss)');
    expect(code).toContain('onCleanup(');
  });

  it('emits a per-item action on Svelte', () => {
    const code = build(LOOP, 'svelte');

    expect(code).toContain('function __dceScoped_timer_0(__dceNode, [item, dismiss])');
    expect(code).toContain('use:__dceScoped_timer_0={[item, dismiss]}');
    // The action's destroy runs when that one item leaves the list.
    expect(code).toContain('destroy()');
  });

  it('emits a per-item directive on Vue', () => {
    const code = build(LOOP, 'vue');

    expect(code).toContain('const vDcetimer_0 = {');
    expect(code).toContain('mounted(__dceNode, __dceBinding)');
    expect(code).toContain('unmounted(__dceNode)');
    expect(code).toContain('v-dcetimer-0="[item, dismiss]"');
  });

  it('iterates a multi-root Vue loop body as a whole', () => {
    const code = build(LOOP, 'vue');

    // With v-for on only the first root, the directive span would fall outside
    // the loop and `item` would be undefined there.
    expect(code).toContain('<template v-for="item in items">');
  });

  it('scopes each level of a nested loop separately', () => {
    const code = build(
      `
<script>
  let { rows, onClose } = $props();
</script>
<template>
  <div>
    {#each rows as row}
      <p>{row.id}</p>
      <dce:timer after={row.ms} on:elapsed={onClose} />
      {#each row.cells as cell}
        <b>{cell.v}</b>
        <dce:timer after={cell.ms} on:elapsed={onClose} />
      {/each}
    {/each}
  </div>
</template>
      `,
      'react'
    );

    expect(code).toMatch(/function \w+\(\{ row, onClose \}: any\)/);
    expect(code).toMatch(/function \w+\(\{ cell, onClose \}: any\)/);
    expect(code).toContain('__dceTimer(row.ms, onClose)');
    expect(code).toContain('__dceTimer(cell.ms, onClose)');
  });

  it('captures the loop index when the effect reads it', () => {
    const code = build(
      `
<script>
  let { items, dismiss } = $props();
</script>
<template>
  <div>
    {#each items as item, i}
      <span>{item.id}</span>
      <dce:timer after={i} on:elapsed={dismiss} />
    {/each}
  </div>
</template>
      `,
      'react'
    );

    expect(code).toMatch(/function \w+\(\{ i, dismiss \}: any\)/);
    expect(code).toContain('__dceTimer(i, dismiss)');
  });

  it('gives each primitive in one loop its own construct', () => {
    const code = build(
      `
<script>
  let { items, dismiss, onEsc } = $props();
</script>
<template>
  <div>
    {#each items as item}
      <span>{item.id}</span>
      <dce:timer after={item.a} on:elapsed={dismiss} />
      <dce:timer after={item.b} on:elapsed={onEsc} />
    {/each}
  </div>
</template>
      `,
      'react'
    );

    expect(code).toContain('function Loop__timer_0(');
    expect(code).toContain('function Loop__timer_1(');
  });

  it('produces parseable script on every target', () => {
    for (const target of TARGETS) {
      expect(() =>
        parseJS(script(build(LOOP, target)), {
          sourceType: 'module',
          plugins: ['jsx', 'typescript']
        })
      ).not.toThrow();
    }
  });
});
