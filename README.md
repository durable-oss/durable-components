# Durable Component Compiler

> **Write once, compile anywhere.** Eliminate framework lock-in forever.

[![Tests](https://img.shields.io/badge/tests-53%2F53%20passing-brightgreen)]()
[![License](https://img.shields.io/badge/license-MIT-blue)]()
[![Status](https://img.shields.io/badge/status-Phase%201%20Complete-success)]()

A production-ready component compiler that lets you write components once in a clear, Svelte 5-inspired DSL and compile them to **any major framework**: React, Vue, SolidJS, Svelte, or Web Components.

## 🚀 Quick Start

**1. Write a component in `.dce` format:**

```html
<script>
  let { initialCount = 0 } = $props();
  let count = $state(initialCount);
  let doubled = $derived(count * 2);

  function increment() {
    count++;
  }
</script>

<template>
  <div class="counter">
    <button on:click={increment}>
      Count: {count} | Doubled: {doubled}
    </button>
  </div>
</template>

<style>
  .counter { padding: 2rem; }
  button {
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
  }
</style>
```

**2. Compile to your target framework:**

```bash
# Compile to React
npx dcc compile Counter.dce --target react -o Counter.jsx

# Compile to SolidJS
npx dcc compile Counter.dce --target solid -o Counter.jsx

# Compile to Svelte 5
npx dcc compile Counter.dce --target svelte -o Counter.svelte
```

**3. Use in your app:**

```jsx
// React
import { Counter } from './Counter';
import './Counter.css';
<Counter initialCount={5} />
```

```svelte
<!-- Svelte 5 -->
<script>
  import Counter from './Counter.svelte';
</script>
<Counter initialCount={5} />
```

## ✨ Why Durable Components?

### The Problem

Framework churn creates **massive technical debt**:
- Component libraries locked to aging frameworks
- Expensive, risky rewrites every few years
- Shrinking talent pool for legacy frameworks
- **Cost of waiting compounds annually**

### The Solution

**Write once, compile to any framework.** Your components become **portable assets** that can:
- ✅ Target React today, Vue tomorrow, without rewrites
- ✅ Generate both native framework code AND standard Web Components
- ✅ Survive framework churn with zero migration cost
- ✅ Integrate seamlessly with existing codebases

Built on **[Durable Programming Principles](https://durableprogramming.com)** for long-term stability.

## 🎯 Features

### ✅ Current (Phase 1-2 Complete)

- **React Compilation** - Full support with Hooks (useState, useMemo, useEffect)
- **SolidJS Compilation** - Native Signals output (createSignal, createMemo, createEffect)
- **Svelte 5 Compilation** - Native Runes output (reverse transformation)
- **Scoped CSS** - Svelte/Vue-style scoped styles with attribute selectors
- **Explicit Reactivity** - Svelte 5 Runes ($state, $props, $derived, $effect)
- **Vue 3 Compilation** - Composition API output (`<script setup>`, ref, computed)
- **Template Directives** - {#if}, {#each}, on:event, bind:value
- **Behavior Primitives** - Focus trap, Escape, scroll lock, and auto-dismiss timers, portable across every target
- **Component Flattening** - Automatic recursive compilation of DCE component dependencies
- **CLI Tool** - Simple `dcc` command for compilation
- **Programmatic API** - `compile()` function for build tools
- **Vite Plugin** - Seamless integration with Vite build tool
- **TypeScript Support** - Full type definitions included
- **Comprehensive Test Coverage** - Generated output is verified against each framework's real compiler

### 🚧 Roadmap (Phase 3+)

- Web Components (standards-based)
- UnoCSS integration
- Webpack plugin
- VS Code extension

## 📚 Documentation

- **[Quick Start Guide](QUICKSTART.md)** - Get up and running in 5 minutes
- **[Architecture Documentation](ARCHITECTURE.md)** - Deep dive into compiler internals
- **[Component Flattening Guide](COMPONENT_FLATTENING.md)** - Automatic dependency resolution
- **[Vite Plugin Guide](VITE_PLUGIN.md)** - Vite integration setup
- **[Examples](examples/)** - Real-world component examples

## 🏗️ Architecture

```
.dce Source → Parser → D-AST → Transformer → JSON IR → Generator → React/Vue/etc.
```

### Three-Phase Design

1. **Parser** - Converts `.dce` files into a Durable AST (D-AST)
2. **Transformer** - Creates a framework-agnostic JSON Intermediate Representation (IR)
3. **Generator** - Produces target-specific code from IR

The **JSON IR** is the "source of truth" - a canonical representation that maps 1:1 to all major frameworks' reactive primitives.

## 🎓 DSL Syntax

Based on **Svelte 5 Runes** for explicit, portable reactivity:

```javascript
// Reactive state
let count = $state(0);

// Props with defaults
let { name = 'World' } = $props();

// Computed values
let doubled = $derived(count * 2);

// Side effects
$effect(() => {
  console.log('Count changed:', count);
});

// Event handlers (plain functions)
function increment() {
  count++;
}
```

### Behavior Primitives

Interaction behaviors that every framework needs but none spells the same way.
Each compiles to a mount/unmount effect — `useEffect` on React,
`onMount`/`onCleanup` on Solid, `onMounted`/`onUnmounted` on Vue, `$effect` on
Svelte — with the teardown wired in, so nothing leaks when the component
unmounts.

| Primitive | Purpose |
|---|---|
| `<dce:focus-trap for={el} />` | Confine Tab navigation to an element; restores focus on teardown |
| `<dce:escape on:escape={fn} />` | Run a handler on the Escape key |
| `<dce:scroll-lock />` | Prevent the page behind from scrolling; nested locks are reference-counted |
| `<dce:timer after={ms} on:elapsed={fn} />` | Auto-dismiss timer; a non-positive delay disables it |

```html
<script>
  let { onClose } = $props();
  let dialog;
</script>

<template>
  <div class="overlay">
    <dce:scroll-lock />
    <dce:escape on:escape={onClose} />
    <dce:timer after={5000} on:elapsed={onClose} />
    <dce:focus-trap for={dialog} />

    <div bind:this={dialog} role="dialog">
      <slot />
    </div>
  </div>
</template>
```

The helper implementations are emitted inline alongside the component, so
generated output stays standalone with no runtime dependency. Only the helpers
a component actually uses are included.

The focus trap honours `[autofocus]`, skips hidden and disabled elements, and
cycles in both directions. The scroll lock compensates for scrollbar width so
the page does not shift when it engages.

## 📦 Installation

```bash
npm install @durable/compiler
```

## 🔨 Usage

### Vite Plugin (Recommended)

The easiest way to use Durable Components in your project is with the Vite plugin:

```bash
npm install @durable/compiler
```

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { durableComponents } from '@durable/compiler/vite-plugin';

export default defineConfig({
  plugins: [
    react(), // or solid(), svelte(), etc.
    durableComponents({
      target: 'react', // 'react' | 'solid' | 'svelte' | 'vue'
      style: 'scoped'  // 'scoped' | 'inline' | 'unocss'
    })
  ]
});
```

Then just import `.dce` files directly in your code:

```tsx
// App.tsx
import Counter from './Counter.dce';

function App() {
  return <Counter initialCount={5} />;
}
```

**Features:**
- ✅ Hot Module Replacement (HMR)
- ✅ Automatic CSS extraction and injection
- ✅ TypeScript support
- ✅ Dev mode with better error messages

See [examples/vite-demo](examples/vite-demo) for complete examples with React, SolidJS, and Svelte.

### CLI

```bash
# Compile to React
dcc compile Counter.dce --target react -o Counter.jsx

# Compile to SolidJS
dcc compile Counter.dce --target solid -o Counter.jsx

# Compile to Svelte 5
dcc compile Counter.dce --target svelte -o Counter.svelte

# Show available targets
dcc info
```

### Programmatic API

```typescript
import { compile } from '@durable/compiler';
import fs from 'fs';

const source = fs.readFileSync('Counter.dce', 'utf-8');

const result = compile(source, {
  filename: 'Counter.dce',
  target: 'react',  // 'react' | 'vue' | 'solid' | 'svelte' | 'wc'
  style: 'scoped'   // 'scoped' | 'inline' | 'unocss'
});

fs.writeFileSync('Counter.jsx', result.js.code);
fs.writeFileSync('Counter.css', result.css?.code || '');
```

## 🧪 Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Watch mode
npm run dev

# Compile examples
npm run build && node dist/cli/index.js compile examples/Counter.dce --target react
```

## 📊 IR-to-Framework Translation Matrix

| DSL Construct | React | Vue 3 | SolidJS | Svelte 5 |
|---------------|-------|-------|---------|----------|
| `$state(0)` | `useState(0)` | `ref(0)` | `createSignal(0)` | `$state(0)` |
| `$derived(x*2)` | `useMemo(()=>x*2,[x])` | `computed(()=>x*2)` | `createMemo(()=>x*2)` | `$derived(x*2)` |
| `$effect(...)` | `useEffect(...,[deps])` | `watchEffect(...)` | `createEffect(...)` | `$effect(...)` |
| `$props()` | `function(props)` | `defineProps()` | `function(props)` | `$props()` |

## 🌟 Philosophy

Built on **[Durable Programming Principles](https://durableprogramming.com)**:

- **Technical Flexibility** - Pluggable architecture, never bound to one framework
- **Clarity over Cleverness** - Explicit reactivity, no magic
- **Pragmatic Approach** - Common subset of features that work everywhere
- **Business-Centric** - Reduces technical debt, increases component lifespan

## 🤝 Contributing

Contributions welcome! To add a new generator:

1. Create `src/generators/{target}.ts`
2. Implement IR → Target transformation (see `generators/react.ts`)
3. Add tests
4. Update documentation

## 📄 License

MIT

---

**Built with ❤️ by the Durable Programming community**

[Report Bug](https://github.com/durableprogramming/durable-components/issues) ·
[Request Feature](https://github.com/durableprogramming/durable-components/issues) ·
[Documentation](ARCHITECTURE.md)
