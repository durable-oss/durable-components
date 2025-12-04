/**
 * Component Flattener Plugin for unified.js
 *
 * This plugin integrates component reference flattening into the compilation pipeline.
 */

import type { Plugin, Processor } from 'unified';
import type { VFile } from 'vfile';
import type { DurableComponentIR } from '../types/ir';
import type { CompilerTarget, StyleMode } from '../types/compiler';
import { flattenComponentReferences, type FlattenResult } from './component-flattener';

/**
 * Options for the component flattener plugin
 */
export interface ComponentFlattenerOptions {
  /** The target framework */
  target?: CompilerTarget;
  /** Style generation mode */
  style?: StyleMode;
  /** Whether to enable component flattening (default: false) */
  enabled?: boolean;
  /** Maximum recursion depth (default: 50) */
  maxDepth?: number;
}

/**
 * Extended VFile data with flattening result
 */
interface VFileData {
  tree?: DurableComponentIR;
  flatten?: FlattenResult;
}

/**
 * Component flattener plugin
 *
 * This plugin analyzes component references and recursively compiles
 * all referenced DCE components, storing the result in file.data.flatten
 *
 * @param options - Plugin options
 * @returns unified.js plugin
 *
 * @example
 * ```ts
 * const processor = unified()
 *   .use(durableParser)
 *   .use(durableTreeStorage)
 *   .use(durableComponentFlattener, {
 *     target: 'react',
 *     enabled: true
 *   })
 *   .use(durableReactCompiler);
 * ```
 */
export const durableComponentFlattener: Plugin<[ComponentFlattenerOptions?], DurableComponentIR> = function (
  options: ComponentFlattenerOptions = {}
) {
  const {
    target = 'react',
    style = 'scoped',
    enabled = false,
    maxDepth = 50
  } = options;

  // Only run if explicitly enabled
  if (!enabled) {
    return;
  }

  // Add a transformer to the pipeline
  return (tree, file) => {
    const vfile = file as VFile & { data: VFileData };

    // Get the source file path from the file
    const sourcePath = file.path || file.history[0];

    if (!sourcePath) {
      console.warn('Component flattener: no source path available, skipping flattening');
      return tree;
    }

    try {
      // Flatten component references
      const flattenResult = flattenComponentReferences(tree, {
        target,
        style,
        sourcePath,
        maxDepth
      });

      // Store the result in file.data for later use
      vfile.data.flatten = flattenResult;

      // Log flattening results
      if (flattenResult.components.size > 1) {
        console.log(
          `Flattened ${flattenResult.components.size - 1} component reference(s) from ${tree.name}`
        );
      }
    } catch (error) {
      console.error('Component flattener error:', error);
      // Don't fail the compilation, just log the error
    }

    // Return tree unchanged
    return tree;
  };
};

export default durableComponentFlattener;
