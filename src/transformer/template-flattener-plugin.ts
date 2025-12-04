/**
 * Template Flattener Plugin for unified.js
 *
 * This plugin integrates template flattening into the compilation pipeline.
 * It replaces component usage with inline template content.
 */

import type { Plugin } from 'unified';
import type { VFile } from 'vfile';
import type { DurableComponentIR } from '../types/ir';
import { flattenComponentTemplates } from './template-flattener';

/**
 * Options for the template flattener plugin
 */
export interface TemplateFlatteningOptions {
  /** Whether to enable template flattening (default: false) */
  enabled?: boolean;
  /** Maximum recursion depth (default: 10) */
  maxDepth?: number;
}

/**
 * Extended options that include filename
 */
export interface TemplateFlatteningOptionsWithFilename extends TemplateFlatteningOptions {
  /** Source filename (passed from main compile function) */
  filename?: string;
}

/**
 * Template flattener plugin
 *
 * This plugin flattens component templates by inlining referenced components.
 *
 * @param options - Plugin options
 * @returns unified.js plugin
 *
 * @example
 * ```ts
 * const processor = unified()
 *   .use(durableParser)
 *   .use(durableTreeStorage)
 *   .use(durableTemplateFlatten, { enabled: true, filename: 'App.dce' })
 *   .use(durableReactCompiler);
 * ```
 */
export const durableTemplateFlatten: Plugin<[TemplateFlatteningOptionsWithFilename?], DurableComponentIR> =
  function (options: TemplateFlatteningOptionsWithFilename = {}) {
    const { enabled = false, maxDepth = 10, filename } = options;

    // Only run if explicitly enabled
    if (!enabled) {
      return;
    }

    // Add a transformer to the pipeline
    return (tree, file) => {
      // Get the source file path from options, file, or tree metadata
      const sourcePath = filename || file.path || file.history?.[0] || tree.meta?.sourceFile;

      if (!sourcePath) {
        console.warn('Template flattener: no source path available, skipping flattening');
        return tree;
      }

      try {
        // Flatten the component templates
        const flattened = flattenComponentTemplates(tree, {
          sourcePath,
          maxDepth
        });

        console.log(`Flattened templates in ${tree.name}`);

        return flattened;
      } catch (error) {
        console.error('Template flattener error:', error);
        // Don't fail the compilation, just log the error
        return tree;
      }
    };
  };

export default durableTemplateFlatten;
