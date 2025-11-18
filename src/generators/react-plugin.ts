/**
 * React Compiler Plugin
 *
 * A unified compiler plugin that transforms the component tree (IR)
 * into React component code.
 */

import type { Plugin } from 'unified';
import type { DurableComponentIR } from '../types/ir';
import { generateReact } from './react';

/**
 * React compiler plugin options
 */
export interface ReactCompilerOptions {
  /** Include scoped styles in output */
  includeStyles?: boolean;
}

/**
 * React compiler plugin
 *
 * This plugin compiles the component tree into React component code.
 *
 * @example
 * ```js
 * import { unified } from 'unified';
 * import { durableParser } from '@durable/compiler/parser';
 * import { durableReactCompiler } from '@durable/compiler/generators';
 *
 * const processor = unified()
 *   .use(durableParser)
 *   .use(durableReactCompiler);
 *
 * const result = processor.processSync(source);
 * console.log(result.value); // React code
 * ```
 */
export const durableReactCompiler: Plugin<[ReactCompilerOptions?], DurableComponentIR, string> =
  function (options = {}) {
    const compiler = (tree: DurableComponentIR): string => {
      const result = generateReact(tree);
      return result.code;
    };

    // @ts-ignore - unified types are complex, but this is the correct pattern
    this.compiler = compiler;
  };
