/**
 * Regression tests for the DCE compiler wishlist (TODO.md).
 *
 * Each block here pins down a gap that previously made a real interactive
 * component (CsvImportDialog.dce) compile to output that would not run:
 *   1. inline arrow event handlers that take the event
 *   2. {:else if} / {:else} chains
 *   3. interpolation inside a literal attribute value
 *   4. unquoted attribute expressions on the Svelte target
 *   6. async event handlers
 *   Vue: expression literals must not collide with the attribute delimiter
 *        (the documented "known remaining gap").
 */

import { compile } from '../index';
import { compile as compileSvelte } from 'svelte/compiler';
import { parse as parseBabel } from '@babel/parser';

function compileTo(source: string, target: 'react' | 'svelte' | 'solid' | 'vue'): string {
  return compile(source.trim(), { filename: 'Wishlist.dce', target }).js.code;
}

/** Assert the generated Svelte actually parses + compiles under Svelte 5 runes. */
function expectSvelteCompiles(code: string): void {
  expect(() => compileSvelte(code, { generate: 'client', runes: true })).not.toThrow();
}

/**
 * Assert the generated React actually parses (bug A produced un-parseable JSX).
 * The generator may emit a TS prop interface, so enable both jsx and typescript.
 */
function expectReactParses(code: string): void {
  expect(() => parseBabel(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] })).not.toThrow();
}

/**
 * Assert no HTML attribute value in `code` contains its own delimiter unescaped.
 * This is the invariant the Vue quoting bug violated: a double-quoted expression
 * dropped into a double-quoted attribute (`v-if="x === "y""`) makes the HTML
 * parser end the attribute early. Scans `name="..."` and `name='...'` pairs.
 */
function expectNoDelimiterCollision(code: string): void {
  // Match an attribute name followed by a quoted value, capturing the delimiter
  // and the (lazily matched) value up to the next matching delimiter.
  const attrRe = /[:@a-zA-Z][\w:.\-]*=(["'])(.*?)\1/g;
  let m: RegExpExecArray | null;
  while ((m = attrRe.exec(code)) !== null) {
    const [, delimiter, value] = m;
    expect(value.includes(delimiter)).toBe(false);
  }
}

describe('Wishlist: inline arrow event handlers (item 1)', () => {
  const source = `
<script>
  let value = $state('');
  function setValue(v) { value = v; }
</script>

<template>
  <input on:input={(e) => setValue(e.target.value)} />
</template>
  `;

  it('React keeps the arrow parameter list', () => {
    const code = compileTo(source, 'react');
    expect(code).toContain('onInput={(e) => setValue(e.target.value)}');
    // The bug emitted onInput={() => setValue(e.target.value)} (param dropped).
    expect(code).not.toContain('onInput={() => setValue(e.target.value)}');
  });

  it('Svelte emits a handler, not an immediate call', () => {
    const code = compileTo(source, 'svelte');
    expect(code).toContain('oninput={(e) => setValue(e.target.value)}');
    // The bug emitted oninput={setValue(e.target.value)} (called on render).
    expect(code).not.toMatch(/oninput=\{setValue\(e\.target\.value\)\}/);
    expectSvelteCompiles(code);
  });

  it('handles multiple parameters', () => {
    const multi = `
<script>
  function set(key, value) { /* ... */ }
</script>

<template>
  <input on:change={(e) => set('k', e.target.checked)} />
</template>
    `;
    expect(compileTo(multi, 'react')).toContain("onChange={(e) => set(\"k\", e.target.checked)}");
  });

  it('still prefixes/resolves a bare function reference', () => {
    const bare = `
<script>
  function increment() { /* ... */ }
</script>

<template>
  <button on:click={increment}>+</button>
</template>
    `;
    expect(compileTo(bare, 'react')).toContain('onClick={increment}');
    expect(compileTo(bare, 'svelte')).toContain('onclick={increment}');
  });
});

describe('Wishlist: {:else if} chains (item 2)', () => {
  const source = `
<script>
  let kind = $state('a');
</script>

<template>
  <div>
    {#if kind === 'a'}
      <span>A</span>
    {:else if kind === 'b'}
      <span>B</span>
    {:else}
      <span>C</span>
    {/if}
  </div>
</template>
  `;

  it('React compiles to a flat ternary cascade (no object literal in JSX slot)', () => {
    const code = compileTo(source, 'react');
    // The fixed form chains ` : cond ? (` rather than nesting `: ( {cond ? `.
    expect(code).toMatch(/\) : kind === "b" \? \(/);
    expect(code).not.toMatch(/\) : \(\s*\{kind === "b"/);
  });

  it('Svelte uses native {:else if} and compiles', () => {
    const code = compileTo(source, 'svelte');
    expect(code).toContain('{:else if kind === "b"}');
    // Exactly one {/if} closes the whole chain.
    expect(code.match(/\{\/if\}/g)?.length).toBe(1);
    expectSvelteCompiles(code);
  });

  it('Solid compiles to a flat ternary cascade', () => {
    const code = compileTo(source, 'solid');
    expect(code).toMatch(/\) : kind\(\) === "b" \? \(/);
  });
});

describe('Wishlist: attribute interpolation (item 3)', () => {
  const source = `
<script>
  let active = $state(true);
</script>

<template>
  <span class="base {active ? 'on' : 'off'}">x</span>
</template>
  `;

  it('React compiles the mixed value to a template literal', () => {
    const code = compileTo(source, 'react');
    expect(code).toMatch(/className=\{`base \$\{active \? "on" : "off"\}`\}/);
    // The bug left the braces literal inside the string.
    expect(code).not.toContain("className=\"base {active");
  });

  it('Svelte compiles the mixed value to a braced template literal', () => {
    const code = compileTo(source, 'svelte');
    expect(code).toMatch(/class=\{`base \$\{active \? "on" : "off"\}`\}/);
    expectSvelteCompiles(code);
  });
});

describe('Wishlist: unquoted attribute expressions on Svelte (item 4)', () => {
  const source = `
<script>
  let current = $state('x');
</script>

<template>
  <select>
    {#each ['x', 'y'] as o}
      <option value={o} selected={o === current}>{o}</option>
    {/each}
  </select>
</template>
  `;

  it('Svelte keeps braces around expression attributes', () => {
    const code = compileTo(source, 'svelte');
    expect(code).toContain('value={o}');
    expect(code).toContain('selected={o === current}');
    // The bug emitted value=o and selected=o === current (invalid Svelte).
    expect(code).not.toMatch(/value=o\b/);
    expect(code).not.toMatch(/selected=o /);
    expectSvelteCompiles(code);
  });
});

describe('Wishlist: async handlers (item 6)', () => {
  const source = `
<script>
  let controller = $state(null);
  async function commit() { await controller.commit(); }
</script>

<template>
  <button on:click={commit}>Go</button>
</template>
  `;

  it('React preserves the async keyword', () => {
    const code = compileTo(source, 'react');
    expect(code).toContain('const commit = async (');
    expect(code).toContain('await controller.commit()');
  });

  it('Svelte preserves the async keyword and compiles', () => {
    const code = compileTo(source, 'svelte');
    expect(code).toContain('async function commit()');
    expectSvelteCompiles(code);
  });
});

describe('Wishlist: multi-statement $state assignment in a named function (item A)', () => {
  const source = `
<script>
  let a = $state(0);
  let b = $state(0);
  function setBoth() { a = 1; b = 2; }
</script>

<template>
  <button on:click={setBoth}>x</button>
</template>
  `;

  it('React rewrites each assignment to its own terminated setter call', () => {
    const code = compileTo(source, 'react');
    expect(code).toContain('setA(1); setB(2);');
    // The bug collapsed the body into setA(1; setB(2)); — un-parseable.
    expect(code).not.toContain('setA(1;');
    expectReactParses(code);
  });
});

describe('Wishlist: $state assignment inside inline arrow handlers (item B)', () => {
  const source = `
<script>
  let a = $state(0);
  let b = $state(0);
</script>

<template>
  <button on:click={() => { a = 1; b = 2; }}>both</button>
  <button on:click={() => a = 5}>one</button>
</template>
  `;

  it('React rewrites assignments inside block and expression arrow bodies', () => {
    const code = compileTo(source, 'react');
    expect(code).toContain('onClick={() => { setA(1); setB(2); }}');
    expect(code).toContain('onClick={() => setA(5)}');
    // The bug passed the raw assignment through, so React never re-rendered.
    expect(code).not.toMatch(/onClick=\{\(\) => \{ a = 1/);
    expect(code).not.toContain('onClick={() => a = 5}');
    expectReactParses(code);
  });
});

describe('Wishlist: inline arrow handler body is not truncated (item C)', () => {
  const source = `
<script>
  let busy = $state(false);
  async function work() { /* ... */ }
</script>

<template>
  <button on:click={async () => { busy = true; await work(); }}>Go</button>
</template>
  `;

  it('React keeps every statement, the async keyword, and rewrites the setter', () => {
    const code = compileTo(source, 'react');
    expect(code).toContain('onClick={async () => { setBusy(true); await work(); }}');
    // The bug dropped `await work();` (no AwaitExpression case in the serializer)
    // and double-wrapped the async arrow in another `() =>`.
    expect(code).toContain('await work()');
    expect(code).not.toContain('() => async () =>');
    expectReactParses(code);
  });

  it('Svelte keeps every statement and compiles', () => {
    const code = compileTo(source, 'svelte');
    expect(code).toContain('await work()');
    expectSvelteCompiles(code);
  });
});

describe('Wishlist: combined interactive component', () => {
  // A condensed CsvImportDialog: arrow handlers, an else-if chain, attribute
  // interpolation, expression attributes, and an async handler all at once.
  const source = `
<script>
  let { controller } = $props();
  let snap = $state(controller.snapshot());
  function setSource(id) { controller.setSource(id); }
  function setOpt(key, value) { controller.setSourceOption(key, value); }
  async function commit() { await controller.commit(); }
</script>

<template>
  <div class="dcid">
    <span class="step {snap.step === 'upload' ? 'active' : ''}">Upload</span>
    <select on:change={(e) => setSource(e.target.value)}>
      {#each snap.sources as src}
        <option value={src.id} selected={src.id === snap.sourceId}>{src.label}</option>
      {/each}
    </select>
    {#each snap.options as opt}
      {#if opt.type === 'boolean'}
        <input type="checkbox" checked={snap.values[opt.key]} on:change={(e) => setOpt(opt.key, e.target.checked)} />
      {:else if opt.type === 'select'}
        <select on:change={(e) => setOpt(opt.key, e.target.value)}>
          <option value="a">A</option>
        </select>
      {:else}
        <input type="text" value={snap.values[opt.key]} on:input={(e) => setOpt(opt.key, e.target.value)} />
      {/if}
    {/each}
    <button on:click={commit}>Import</button>
  </div>
</template>
  `;

  it('compiles to valid Svelte 5', () => {
    expectSvelteCompiles(compileTo(source, 'svelte'));
  });

  it('compiles to parseable React', () => {
    const code = compileTo(source, 'react');
    expect(code).toContain('onChange={(e) => setSource(e.target.value)}');
    expect(code).toMatch(/className=\{`step \$\{/);
    expect(code).toContain('const commit = async (');
    expectReactParses(code);
  });

  it('compiles to Vue without colliding attribute delimiters', () => {
    expectNoDelimiterCollision(compileTo(source, 'vue'));
  });
});

describe('Wishlist: Vue attribute quoting (known remaining gap)', () => {
  it('switches v-if/:class to single quotes when the value holds a string literal', () => {
    const source = `
<script>
  let snap = $state({ step: 'upload' });
</script>

<template>
  <div>
    <span class="step {snap.step === 'upload' ? 'active' : ''}">Upload</span>
    {#if snap.step === 'upload'}
      <p>uploading</p>
    {:else if snap.step === 'map'}
      <p>mapping</p>
    {:else}
      <p>done</p>
    {/if}
  </div>
</template>
    `;
    const code = compileTo(source, 'vue');

    // The bug produced v-if="snap.step === "upload"" — delimiter collision.
    expect(code).toContain(`v-if='snap.step === "upload"'`);
    expect(code).toContain(`v-else-if='snap.step === "map"'`);
    expect(code).toContain(`:class='\`step \${snap.step === "upload" ? "active" : ""}\`'`);
    expect(code).not.toMatch(/v-if="[^"]*"[^>]*"/);
    expectNoDelimiterCollision(code);
  });

  it('keeps double quotes when the value has none of its own', () => {
    const source = `
<script>
  function setSource(id) {}
</script>

<template>
  <select on:change={(e) => setSource(e.target.value)}>
    <option value="a">A</option>
  </select>
</template>
    `;
    const code = compileTo(source, 'vue');
    expect(code).toContain('@change="(e) => setSource(e.target.value)"');
    expectNoDelimiterCollision(code);
  });

  it('escapes embedded quotes as &quot; when the value contains both kinds', () => {
    const source = `
<script>
  let label = $state('x');
</script>

<template>
  <div>
    {#if label === "it's a test"}
      <p>matched</p>
    {/if}
  </div>
</template>
    `;
    const code = compileTo(source, 'vue');
    expect(code).toContain(`v-if="label === &quot;it's a test&quot;"`);
    expectNoDelimiterCollision(code);
  });
});
