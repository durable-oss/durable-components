import { describe, it, expect } from 'vitest';
import { compile } from '../../index';
import { wrapReact } from '../../showcase/wrappers/react';
import { wrapVue } from '../../showcase/wrappers/vue';
import { wrapSvelte } from '../../showcase/wrappers/svelte';
import { wrapSolid } from '../../showcase/wrappers/solid';
import { wrapBuildOnly } from '../../showcase/wrappers/build-only';
import { buildPreviewHtml } from '../../showcase/wrappers/index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function compileFor(template: string, target: 'react' | 'vue' | 'svelte' | 'solid') {
  const source = `<template>${template}</template>`;
  // Vue and Solid need browserSafe:true to emit plain JS instead of an SFC/JSX string
  const browserSafe = target !== 'react';
  return compile(source, { filename: '__showcase_Default.dce', target, browserSafe });
}

function compileComponent(dce: string, target: 'react' | 'vue' | 'svelte' | 'solid') {
  return compile(dce, { filename: 'Counter.dce', target });
}

// ---------------------------------------------------------------------------
// React wrapper
// ---------------------------------------------------------------------------

describe('wrapReact', () => {
  it('returns a full HTML document', async () => {
    const { js } = compileFor('<p>Hello</p>', 'react');
    const html = await wrapReact(js.code, null, {});
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html>');
    expect(html).toContain('<div id="root">');
  });

  it('injects CSS into <head>', async () => {
    const { js } = compileFor('<p>Hello</p>', 'react');
    const html = await wrapReact(js.code, '.btn { color: red; }', {});
    expect(html).toContain('<style>.btn { color: red; }</style>');
  });

  it('includes React and ReactDOM CDN scripts', async () => {
    const { js } = compileFor('<p>Hello</p>', 'react');
    const html = await wrapReact(js.code, null, {});
    expect(html).toContain('react');
    expect(html).toContain('react-dom');
  });

  it('bundles successfully with a simple counter', async () => {
    const dce = `<script>
let count = $state(0);
function increment() { count++; }
</script>
<template><button on:click={increment}>{count}</button></template>`;
    const { js } = compile(dce, { filename: '__showcase_Default.dce', target: 'react' });
    const html = await wrapReact(js.code, null, {});
    expect(html).toContain('<script>');
    // bundled output should include runtime code
    expect(html.length).toBeGreaterThan(500);
  });

  it('includes componentSource when provided', async () => {
    const scenarioDce = '<template><p>Hello</p></template>';
    const { js: scenarioJs } = compile(scenarioDce, { filename: '__showcase_Default.dce', target: 'react' });
    const componentDce = `<script>let { label = 'x' } = $props();</script><template><span>{label}</span></template>`;
    const { js: componentJs } = compile(componentDce, { filename: 'Label.dce', target: 'react' });
    const html = await wrapReact(scenarioJs.code, null, {}, componentJs.code);
    expect(html).toContain('<script>');
  });

  it('passes paramValues through JSON serialisation', async () => {
    const { js } = compileFor('<p>Hello</p>', 'react');
    // wrapReact serialises paramValues — just verify no throw with non-trivial values
    const html = await wrapReact(js.code, null, { label: 'Test', count: 5, active: true });
    expect(html).toContain('<!DOCTYPE html>');
  });
});

// ---------------------------------------------------------------------------
// Vue wrapper
// ---------------------------------------------------------------------------

describe('wrapVue', () => {
  it('returns a full HTML document', async () => {
    const { js } = compileFor('<p>Hello</p>', 'vue');
    const html = await wrapVue(js.code, null, {});
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<div id="app">');
  });

  it('injects CSS into <head>', async () => {
    const { js } = compileFor('<p>Hello</p>', 'vue');
    const html = await wrapVue(js.code, '.text { color: blue; }', {});
    expect(html).toContain('<style>.text { color: blue; }</style>');
  });

  it('includes Vue CDN script', async () => {
    const { js } = compileFor('<p>Hello</p>', 'vue');
    const html = await wrapVue(js.code, null, {});
    expect(html).toContain('vue');
  });

  it('bundles successfully with a reactive component', async () => {
    const dce = `<script>
let count = $state(0);
function inc() { count++; }
</script>
<template><button on:click={inc}>{count}</button></template>`;
    const { js } = compile(dce, { filename: '__showcase_Default.dce', target: 'vue', browserSafe: true });
    const html = await wrapVue(js.code, null, {});
    expect(html.length).toBeGreaterThan(500);
  });
});

// ---------------------------------------------------------------------------
// Svelte wrapper
// ---------------------------------------------------------------------------

describe('wrapSvelte', () => {
  it('returns a full HTML document', async () => {
    const { js } = compileFor('<p>Hello</p>', 'svelte');
    const html = await wrapSvelte(js.code, null, null, {});
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<div id="root">');
  });

  it('injects CSS into <head>', async () => {
    const { js } = compileFor('<p>Hello</p>', 'svelte');
    const html = await wrapSvelte(js.code, null, '.cls { color: red; }', {});
    expect(html).toContain('<style>.cls { color: red; }</style>');
  });

  it('bundles Svelte runtime code into output', async () => {
    const { js } = compileFor('<p>Hello</p>', 'svelte');
    const html = await wrapSvelte(js.code, null, null, {});
    // bundled output should be non-trivial
    expect(html.length).toBeGreaterThan(1000);
  });

  it('bundles a scenario with state and events', async () => {
    const dce = `<script>
let count = $state(0);
function inc() { count++; }
</script>
<template><button on:click={inc}>{count}</button></template>`;
    const { js } = compile(dce, { filename: '__showcase_Default.dce', target: 'svelte' });
    const html = await wrapSvelte(js.code, null, null, {});
    expect(html.length).toBeGreaterThan(1000);
  });

  it('bundles scenario + component without duplicate import errors', async () => {
    const componentDce = `<script>
let { label = 'Click' } = $props();
let n = $state(0);
function inc() { n++; }
</script>
<template><button on:click={inc}>{label}: {n}</button></template>`;

    const { js: componentSfc } = compile(componentDce, { filename: 'Counter.dce', target: 'svelte' });
    const scenarioDce = '<template><Counter label="Test" /></template>';
    const { js: scenarioSfc } = compile(scenarioDce, { filename: '__showcase_Default.dce', target: 'svelte' });

    const html = await wrapSvelte(scenarioSfc.code, componentSfc.code, null, {});
    expect(html).toContain('<!DOCTYPE html>');
    expect(html.length).toBeGreaterThan(1000);
  });

  it('handles scenario without a script block', async () => {
    const scenarioDce = '<template><div class="card"><p>Static</p></div></template>';
    const { js } = compile(scenarioDce, { filename: '__showcase_Default.dce', target: 'svelte' });
    const html = await wrapSvelte(js.code, null, null, {});
    expect(html).toContain('<!DOCTYPE html>');
  });
});

// ---------------------------------------------------------------------------
// Solid wrapper
// ---------------------------------------------------------------------------

describe('wrapSolid', () => {
  it('returns a full HTML document', async () => {
    const { js } = compileFor('<p>Hello</p>', 'solid');
    const html = await wrapSolid(js.code, null, {});
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<div id="root">');
  });

  it('injects CSS into <head>', async () => {
    const { js } = compileFor('<p>Hello</p>', 'solid');
    const html = await wrapSolid(js.code, '.box { margin: 0; }', {});
    expect(html).toContain('<style>.box { margin: 0; }</style>');
  });

  it('bundles solid-js runtime into output', async () => {
    const { js } = compileFor('<p>Hello</p>', 'solid');
    const html = await wrapSolid(js.code, null, {});
    expect(html.length).toBeGreaterThan(1000);
  });

  it('transforms JSX correctly via Babel', async () => {
    const dce = `<script>
let count = $state(0);
function inc() { count++; }
</script>
<template><button on:click={inc}>{count}</button></template>`;
    const { js } = compile(dce, { filename: '__showcase_Default.dce', target: 'solid' });
    // Would throw if JSX wasn't transformed
    const html = await wrapSolid(js.code, null, {});
    expect(html).toContain('<script>');
  });

  it('bundles scenario + component correctly', async () => {
    const componentDce = `<script>
let { label = 'Click' } = $props();
let n = $state(0);
function inc() { n++; }
</script>
<template><button on:click={inc}>{label}: {n}</button></template>`;

    const { js: componentJs } = compile(componentDce, { filename: 'Counter.dce', target: 'solid' });
    const scenarioDce = '<template><p>Wrapped</p></template>';
    const { js: scenarioJs } = compile(scenarioDce, { filename: '__showcase_Default.dce', target: 'solid' });

    const html = await wrapSolid(scenarioJs.code, null, {}, componentJs.code);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html.length).toBeGreaterThan(1000);
  });
});

// ---------------------------------------------------------------------------
// wrapBuildOnly
// ---------------------------------------------------------------------------

describe('wrapBuildOnly', () => {
  it('returns a valid HTML document', () => {
    const html = wrapBuildOnly('svelte', null);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html>');
    expect(html).toContain('</html>');
  });

  it('mentions the target name', () => {
    const html = wrapBuildOnly('solid', null);
    expect(html.toLowerCase()).toContain('solid');
  });

  it('injects CSS when provided', () => {
    const html = wrapBuildOnly('svelte', '.btn { color: red; }');
    expect(html).toContain('<style>.btn { color: red; }</style>');
  });

  it('does not include a style tag when css is null', () => {
    const html = wrapBuildOnly('svelte', null);
    expect(html).not.toContain('<style></style>');
  });

  it('capitalises the target label', () => {
    const html = wrapBuildOnly('svelte', null);
    expect(html).toContain('Svelte');
  });
});

// ---------------------------------------------------------------------------
// buildPreviewHtml dispatcher
// ---------------------------------------------------------------------------

describe('buildPreviewHtml', () => {
  it('dispatches to react wrapper for react target', async () => {
    const { js } = compileFor('<p>Hello</p>', 'react');
    const html = await buildPreviewHtml(js.code, null, 'react', {});
    expect(html).toContain('react');
  });

  it('dispatches to vue wrapper for vue target', async () => {
    const { js } = compileFor('<p>Hello</p>', 'vue');
    const html = await buildPreviewHtml(js.code, null, 'vue', {});
    expect(html).toContain('vue');
  });

  it('dispatches to svelte wrapper for svelte target', async () => {
    const { js } = compileFor('<p>Hello</p>', 'svelte');
    const html = await buildPreviewHtml(js.code, null, 'svelte', {});
    expect(html).toContain('<!DOCTYPE html>');
  });

  it('dispatches to solid wrapper for solid target', async () => {
    const { js } = compileFor('<p>Hello</p>', 'solid');
    const html = await buildPreviewHtml(js.code, null, 'solid', {});
    expect(html).toContain('<!DOCTYPE html>');
  });

  it('returns unsupported-target message for unknown target', async () => {
    const html = await buildPreviewHtml('', null, 'wc' as any, {});
    expect(html).toContain('wc');
  });

  it('passes componentSource through to react wrapper', async () => {
    const scenarioDce = '<template><p>Hi</p></template>';
    const { js: scenarioJs } = compile(scenarioDce, { filename: '__showcase_Default.dce', target: 'react' });
    const html = await buildPreviewHtml(scenarioJs.code, null, 'react', {}, { componentSource: '' });
    expect(html).toContain('<!DOCTYPE html>');
  });

  it('passes componentDce through to svelte wrapper', async () => {
    const { js } = compileFor('<p>Hello</p>', 'svelte');
    const html = await buildPreviewHtml(js.code, null, 'svelte', {}, { componentDce: undefined });
    expect(html).toContain('<!DOCTYPE html>');
  });
});
