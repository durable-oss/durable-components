# Quick Start Guide

## Installation

```bash
npm install @durable/compiler
```

## Your First Component

Create a file `Counter.dce`:

```html
<script>
  let count = $state(0);

  function increment() {
    count++;
  }
</script>

<template>
  <button on:click={increment}>
    Count: {count}
  </button>
</template>

<style>
  button {
    padding: 1rem;
    background: blue;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
</style>
```

## Compile to React

```bash
npx dcc compile Counter.dce --target react -o Counter.jsx
```

This generates:

**Counter.jsx:**
```jsx
import React, { useState } from 'react';

export function Counter() {
  const [count, setCount] = useState(0);

  const increment = () => {
    setCount(count + 1);
  };

  return (
    <button data-dce-abc123="" onClick={increment}>
      Count: {count}
    </button>
  );
}
```

**Counter.css:**
```css
button[data-dce-abc123] {
  padding: 1rem;
  background: blue;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
```

## Use in Your React App

```jsx
import { Counter } from './Counter.jsx';
import './Counter.css';

function App() {
  return <Counter />;
}
```

## Programmatic API

```javascript
import { compile } from '@durable/compiler';
import fs from 'fs';

const source = fs.readFileSync('Counter.dce', 'utf-8');

const result = compile(source, {
  filename: 'Counter.dce',
  target: 'react',
  style: 'scoped'
});

// Write output
fs.writeFileSync('Counter.jsx', result.js.code);
fs.writeFileSync('Counter.css', result.css.code);
```

## Advanced Features

### Props with Defaults

```html
<script>
  let { name = 'World', count = 0 } = $props();
</script>

<template>
  <h1>Hello, {name}! Count: {count}</h1>
</template>
```

Compiles to React with TypeScript interface:

```tsx
interface MyComponentProps {
  name?: any;
  count?: any;
}

export function MyComponent(props: MyComponentProps) {
  const { name = 'World', count = 0 } = props;
  // ...
}
```

### Derived State (Computed Values)

```html
<script>
  let count = $state(0);
  let doubled = $derived(count * 2);
</script>

<template>
  <p>Count: {count}, Doubled: {doubled}</p>
</template>
```

Compiles to React with `useMemo`:

```jsx
const [count, setCount] = useState(0);
const doubled = useMemo(() => count * 2, [count]);
```

### Effects

```html
<script>
  let count = $state(0);

  $effect(() => {
    console.log('Count changed:', count);
    document.title = `Count: ${count}`;
  });
</script>
```

Compiles to React with `useEffect`:

```jsx
useEffect(() => {
  console.log('Count changed:', count);
  document.title = `Count: ${count}`;
}, [count]);
```

### Conditional Rendering

```html
<script>
  let show = $state(true);
</script>

<template>
  {#if show}
    <p>Visible!</p>
  {:else}
    <p>Hidden!</p>
  {/if}
</template>
```

Compiles to React ternary:

```jsx
{show ? (
  <p>Visible!</p>
) : (
  <p>Hidden!</p>
)}
```

### List Rendering

```html
<script>
  let items = $state(['Apple', 'Banana', 'Cherry']);
</script>

<template>
  <ul>
    {#each items as item, index}
      <li>{index + 1}. {item}</li>
    {/each}
  </ul>
</template>
```

Compiles to React `.map()`:

```jsx
<ul>
  {items.map((item, index) => (
    <li>{index + 1}. {item}</li>
  ))}
</ul>
```

### Two-Way Binding

```html
<script>
  let name = $state('');
</script>

<template>
  <input bind:value={name} />
  <p>Hello, {name}!</p>
</template>
```

Compiles to React controlled input:

```jsx
<input value={name} onChange={(e) => setName(e.target.value)} />
<p>Hello, {name}!</p>
```

## Style Modes

### Scoped (Default)

```bash
dcc compile Component.dce --target react --style scoped
```

Generates scoped CSS with attribute selectors (like Svelte/Vue).

### Inline (Coming Soon)

```bash
dcc compile Component.dce --target react --style inline
```

Injects styles directly as `style` attributes.

### UnoCSS (Coming Soon)

```bash
dcc compile Component.dce --target react --style unocss
```

Integrates with UnoCSS for atomic CSS generation.

## CLI Commands

```bash
# Compile a single file
dcc compile <file.dce> --target <framework> -o <output>

# Show available targets and options
dcc info

# Get help
dcc --help
```

## Next Steps

- Explore the [examples/](examples/) directory for more complex components
- Read the [ARCHITECTURE.md](ARCHITECTURE.md) to understand the compiler internals
- Try compiling to different targets (Vue, SolidJS, etc. - coming soon!)
- Star the project on GitHub if you find it useful!

## Troubleshooting

### Parse Errors

Make sure your `.dce` syntax is correct:
- All `{#if}` blocks must have closing `{/if}`
- All `{#each}` blocks must have closing `{/each}`
- Event handlers use `on:event={handler}` syntax
- Bindings use `bind:property={variable}` syntax

### Generated Code Issues

If the generated code has issues:
1. Check the IR with `node -e "console.log(JSON.stringify(require('@durable/compiler').transform(require('@durable/compiler').parse(source))))" > ir.json`
2. File an issue on GitHub with the IR and expected output

## Community

- GitHub: [github.com/durableprogramming/durable-components](https://github.com/durableprogramming/durable-components)
- Issues: Report bugs and request features
- Discussions: Ask questions and share ideas
