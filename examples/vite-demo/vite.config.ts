import { defineConfig } from 'vite';
import { durableComponents } from '@durable/compiler/vite-plugin';

export default defineConfig({
  plugins: [
    durableComponents({
      // Target framework: 'react', 'vue', 'solid', 'svelte'
      target: 'react',

      // Style mode: 'scoped', 'inline', 'unocss'
      style: 'scoped',

      // File extensions to process (default: ['.dce'])
      extensions: ['.dce'],

      // Include patterns (optional)
      // include: ['src/**/*.dce'],

      // Exclude patterns (default: ['node_modules/**'])
      // exclude: ['node_modules/**', 'dist/**']
    })
  ]
});
