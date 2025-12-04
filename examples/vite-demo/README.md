# Vite Plugin Demo

This example demonstrates how to use the Vite plugin for Durable Components.

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Usage in Different Frameworks

### React

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { durableComponents } from '@durable/compiler/vite-plugin';

export default defineConfig({
  plugins: [
    react(),
    durableComponents({
      target: 'react',
      style: 'scoped'
    })
  ]
});
```

```tsx
// App.tsx
import Counter from './Counter.dce';

function App() {
  return <Counter initialCount={5} />;
}
```

### SolidJS

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import { durableComponents } from '@durable/compiler/vite-plugin';

export default defineConfig({
  plugins: [
    solid(),
    durableComponents({
      target: 'solid',
      style: 'scoped'
    })
  ]
});
```

```tsx
// App.tsx
import Counter from './Counter.dce';

function App() {
  return <Counter initialCount={5} />;
}
```

### Svelte

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { durableComponents } from '@durable/compiler/vite-plugin';

export default defineConfig({
  plugins: [
    svelte(),
    durableComponents({
      target: 'svelte',
      style: 'scoped'
    })
  ]
});
```

```svelte
<!-- App.svelte -->
<script>
  import Counter from './Counter.dce';
</script>

<Counter initialCount={5} />
```

## Features

- ✅ Hot Module Replacement (HMR)
- ✅ CSS extraction and injection
- ✅ Development mode with better errors
- ✅ TypeScript support
- ✅ Scoped styles
- ✅ Framework-agnostic compilation
