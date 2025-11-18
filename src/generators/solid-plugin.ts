/**
 * Solid Compiler Plugin
 *
 * A unified compiler plugin that transforms the component tree (IR)
 * into Solid component code.
 */

import type { Plugin } from 'unified';
import type { DurableComponentIR } from '../types/ir';
import { generateSolid } from './solid';

/**
 * Solid compiler plugin options
 */
export interface SolidCompilerOptions {
  /** Include scoped styles in output */
  includeStyles?: boolean;
}

/**
 * Solid compiler plugin
 *
 * This plugin compiles the component tree into Solid component code.
 *
 * @example
 * ```js
 * import { unified } from 'unified';
 * import { durableParser } from '@durable/compiler/parser';
 * import { durableSolidCompiler } from '@durable/compiler/generators';
 *
 * const processor = unified()
 *   .use(durableParser)
 *   .use(durableSolidCompiler);
 *
 * const result = processor.processSync(source);
 * console.log(result.value); // Solid code
 * ```
 */
export const durableSolidCompiler: Plugin<[SolidCompilerOptions?], DurableComponentIR, string> =
  function (options = {}) {
    const compiler = (tree: DurableComponentIR): string => {
      const result = generateSolid(tree);
      return result.code;
    };

    // @ts-ignore - unified types are complex, but this is the correct pattern
    this.compiler = compiler;
  };
