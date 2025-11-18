/**
 * Vue Compiler Plugin
 *
 * A unified compiler plugin that transforms the component tree (IR)
 * into Vue 3 component code.
 */

import type { Plugin } from 'unified';
import type { DurableComponentIR } from '../types/ir';
import { generateVue } from './vue';

/**
 * Vue compiler plugin options
 */
export interface VueCompilerOptions {
  /** Include scoped styles in output */
  includeStyles?: boolean;
}

/**
 * Vue compiler plugin
 *
 * This plugin compiles the component tree into Vue 3 component code.
 *
 * @example
 * ```js
 * import { unified } from 'unified';
 * import { durableParser } from '@durable/compiler/parser';
 * import { durableVueCompiler } from '@durable/compiler/generators';
 *
 * const processor = unified()
 *   .use(durableParser)
 *   .use(durableVueCompiler);
 *
 * const result = processor.processSync(source);
 * console.log(result.value); // Vue code
 * ```
 */
export const durableVueCompiler: Plugin<[VueCompilerOptions?], DurableComponentIR, string> =
  function (options = {}) {
    const compiler = (tree: DurableComponentIR): string => {
      const result = generateVue(tree);
      return result.code;
    };

    // @ts-ignore - unified types are complex, but this is the correct pattern
    this.compiler = compiler;
  };
