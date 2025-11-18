# Durable Component Compiler: Architecture Documentation

## Executive Summary

The Durable Component Compiler is a **framework-agnostic component compiler** that eliminates framework lock-in by allowing developers to write components once in a clear, Svelte 5-inspired DSL and compile them to any major framework (React, Vue, SolidJS, Svelte, Web Components).

This project directly implements the architectural plan outlined in the specification, delivering a production-ready "Tracer Bullet" (Phase 1 Milestone) with full React compilation support.

## Philosophy & Principles

Every architectural decision maps directly to the [Durable Programming Principles](https://durableprogramming.com):

| Principle | Implementation |
|-----------|---------------|
| **Technical Flexibility** | Pluggable multi-target backend via canonical JSON IR |
| **Clarity over Cleverness** | Explicit Svelte 5 Rune-based DSL (no compiler magic) |
| **Pragmatic Approach** | Common-subset DSL focused on portable, verifiable features |
| **Archaeological Expertise** | JSON IR as the "artifact" capturing component intent |
| **Incremental Planning** | Phased implementation: IR → React → Additional targets |
| **Business-Centric Decisions** | Multiple output modes (native frameworks + Web Components) |

## Three-Phase Compiler Architecture

```
.dce Source → [Parser] → D-AST → [Transformer] → JSON IR → [Generator] → Target Code
```

### Phase 1: Frontend (Parser)

**Location:** `src/parser/`

**Purpose:** Parse `.dce` files into a Durable Component AST (D-AST)

**Process:**
1. Extract `<script>`, `<template>`, `<style>` blocks
2. Parse `<script>` with Acorn (JavaScript AST)
3. Parse `<template>` with custom HTML+directive parser
4. Parse `<style>` as plain CSS string

**Key Files:**
- `parser/index.ts` - Main parser entry point
- `parser/template-parser.ts` - Template syntax parser

### Phase 2: Mid-end (Transformer)

**Location:** `src/transformer/`

**Purpose:** Convert D-AST into framework-agnostic JSON IR

**This is the "Durable Core"** - it performs:
- Rune extraction ($state, $props, $derived, $effect)
- Dependency analysis
- Template tree transformation
- Creation of the canonical IR

**Key Files:**
- `transformer/index.ts` - Main transformation orchestrator
- `transformer/script-analyzer.ts` - Extract runes and functions from JS AST
- `transformer/template-transformer.ts` - Convert template AST to IR nodes

**IR Schema:** `src/types/ir.ts` - **This is the frozen v1.0 schema**

### Phase 3: Backend (Generators)

**Location:** `src/generators/`, `src/styles/`

**Purpose:** Generate target-specific code from IR

**Current Generators:**
- ✅ **React** (`generators/react.ts`) - Full implementation with Hooks
- 🚧 **Vue** - Planned
- 🚧 **SolidJS** - Planned
- 🚧 **Svelte** - Planned
- 🚧 **Web Components** - Planned

**Style Generators:**
- ✅ **Scoped** (`styles/scoped.ts`) - Svelte/Vue-style scoped CSS
- 🚧 **Inline** - Planned
- 🚧 **UnoCSS** - Planned

## The Canonical JSON IR (v1.0)

The JSON Intermediate Representation is the **"source of truth"** that enables multi-target compilation.

### IR Structure

```typescript
interface DurableComponentIR {
  '@version': string;
  name: string;
  props: PropDefinition[];
  state: StateDefinition[];
  derived: DerivedDefinition[];
  effects: EffectDefinition[];
  functions: FunctionDefinition[];
  template: TemplateNode;
  styles?: string;
  meta?: { sourceFile: string; originalSource: string };
}
```

### Example IR

```json
{
  "@version": "1.0.0",
  "name": "Counter",
  "props": [{ "name": "initialCount", "defaultValue": "0" }],
  "state": [{ "name": "count", "initialValue": "initialCount" }],
  "derived": [{ "name": "doubled", "expression": "count * 2", "dependencies": ["count"] }],
  "functions": [{ "name": "increment", "body": "{ count++; }" }],
  "template": { "type": "element", "name": "div", "children": [...] }
}
```

## DSL Syntax

### Single-File Component (.dce)

```html
<script>
  let { initialCount = 0 } = $props();
  let count = $state(initialCount);
  let doubled = $derived(count * 2);

  function increment() {
    count++;
  }

  $effect(() => {
    console.log('Count:', count);
  });
</script>

<template>
  <button on:click={increment}>
    Count: {count}, Doubled: {doubled}
  </button>
</template>

<style>
  button {
    padding: 1rem;
    background: blue;
  }
</style>
```

### Reactivity Model (Svelte 5 Runes)

- `$state(value)` - Reactive state
- `$props()` - Component props
- `$derived(expression)` - Computed values
- `$effect(() => {...})` - Side effects

### Template Syntax

- `{expression}` - Dynamic text
- `{#if condition}...{:else}...{/if}` - Conditionals
- `{#each items as item}...{/each}` - Lists
- `on:event={handler}` - Event handlers
- `bind:value={variable}` - Two-way binding

## IR-to-Framework Translation Matrix

| IR Construct | React | Vue 3 | SolidJS | Svelte 5 | Web Component |
|--------------|-------|-------|---------|----------|---------------|
| **props** | `function(props)` | `defineProps()` | `function(props)` | `$props()` | `observedAttributes` |
| **state** | `useState()` | `ref()` | `createSignal()` | `$state()` | Internal property |
| **derived** | `useMemo()` | `computed()` | `createMemo()` | `$derived()` | Getter |
| **effects** | `useEffect()` | `watchEffect()` | `createEffect()` | `$effect()` | Lifecycle callback |
| **functions** | Arrow functions | Functions | Arrow functions | Functions | Methods |
| **template** | JSX | `<template>` | JSX | Svelte template | `innerHTML` |

## Public API

### Library Usage

```typescript
import { compile } from '@durable/compiler';

const result = compile(source, {
  filename: 'MyComponent.dce',
  target: 'react',  // 'react' | 'vue' | 'solid' | 'svelte' | 'wc'
  style: 'scoped'   // 'scoped' | 'inline' | 'unocss'
});

console.log(result.js.code);  // Generated JavaScript
console.log(result.css.code); // Generated CSS (if applicable)
```

### CLI Usage

```bash
# Compile to React
dcc compile Counter.dce --target react -o Counter.jsx

# Show compiler info
dcc info
```

## Testing Strategy

**Location:** `src/__tests__/`

**Coverage:**
- ✅ Basic component compilation
- ✅ Props with defaults
- ✅ Reactive state
- ✅ Derived values
- ✅ Effects
- ✅ Conditional rendering
- ✅ List rendering
- ✅ Scoped CSS generation
- ✅ Error handling

**Test Command:** `npm test`

## Implementation Status

### ✅ Phase 1 Milestone (Tracer Bullet) - **COMPLETE**

- [x] JSON IR Schema v1.0 (frozen)
- [x] Parser (DSL → D-AST)
- [x] Transformer (D-AST → IR)
- [x] React Generator
- [x] Scoped Style Generator
- [x] `compile()` API
- [x] CLI tool (`dcc`)
- [x] Comprehensive tests (9/9 passing)
- [x] Example components

### 🚧 Phase 2: Additional Generators

- [ ] Vue 3 Generator
- [ ] SolidJS Generator
- [ ] Svelte 5 Generator
- [ ] Web Component Generator
- [ ] Inline Style Generator
- [ ] UnoCSS Integration

### 🚧 Phase 3: Tooling & Ecosystem

- [ ] Vite plugin
- [ ] Webpack loader
- [ ] VS Code extension
- [ ] ESLint plugin
- [ ] Prettier plugin
- [ ] Component library examples

## Project Structure

```
src/
├── types/
│   ├── ir.ts           # IR schema (FROZEN v1.0)
│   ├── ast.ts          # D-AST types
│   └── compiler.ts     # Public API types
├── parser/
│   ├── index.ts        # Main parser
│   └── template-parser.ts
├── transformer/
│   ├── index.ts        # Main transformer
│   ├── script-analyzer.ts
│   └── template-transformer.ts
├── generators/
│   └── react.ts        # React generator
├── styles/
│   └── scoped.ts       # Scoped CSS generator
├── utils/
│   ├── string.ts
│   └── code-gen.ts
├── cli/
│   └── index.ts        # CLI tool
└── index.ts            # Public API exports

examples/
├── Counter.dce         # Counter component
└── TodoList.dce        # Todo list component
```

## Development

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

## Contributing

When adding new generators:

1. Create `src/generators/{target}.ts`
2. Implement the IR → Target transformation
3. Follow the Translation Matrix above
4. Add tests in `src/__tests__/`
5. Update this documentation

## License

MIT

## References

- [Durable Programming Principles](https://durableprogramming.com)
- [Svelte 5 Runes](https://svelte.dev/blog/runes)
- [Mitosis (Inspiration)](https://mitosis.builder.io)
