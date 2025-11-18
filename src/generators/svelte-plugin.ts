/**
 * Svelte Compiler Plugin
 *
 * A unified compiler plugin that transforms the component tree (IR)
 * into Svelte component code.
 */

import type { Plugin } from 'unified';
import type { DurableComponentIR } from '../types/ir';
import { generateSvelte } from './svelte';

/**
 * Svelte compiler plugin options
 */
export interface SvelteCompilerOptions {
  /** Include scoped styles in output */
  includeStyles?: boolean;
}

/**
 * Svelte compiler plugin
 *
 * This plugin compiles the component tree into Svelte component code.
 *
 * @example
 * ```js
 * import { unified } from 'unified';
 * import { durableParser } from '@durable/compiler/parser';
 * import { durableSvelteCompiler } from '@durable/compiler/generators';
 *
 * const processor = unified()
 *   .use(durableParser)
 *   .use(durableSvelteCompiler);
 *
 * const result = processor.processSync(source);
 * console.log(result.value); // Svelte code
 * ```
 */
export const durableSvelteCompiler: Plugin<[SvelteCompilerOptions?], DurableComponentIR, string> =
  function (options = {}) {
    const compiler = (tree: DurableComponentIR): string => {
      const result = generateSvelte(tree);
      return result.code;
    };

    // @ts-ignore - unified types are complex, but this is the correct pattern
    this.compiler = compiler;
  };
