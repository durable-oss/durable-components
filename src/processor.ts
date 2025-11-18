/**
 * Durable Component Processor
 *
 * This is the unified.js processor for durable components.
 * It orchestrates the parse-transform-compile pipeline using plugins.
 */

import { unified } from 'unified';
import type { Processor } from 'unified';
import type { DurableComponentIR } from './types/ir';

/**
 * Create a new durable component processor
 *
 * Returns a unified processor configured for durable components.
 * Plugins can be added via .use() to customize the pipeline.
 *
 * @example
 * ```js
 * const processor = durableComponentProcessor()
 *   .use(durableParser)
 *   .use(durableTransformer)
 *   .use(durableReactCompiler);
 *
 * const result = processor.processSync(source);
 * ```
 */
export function durableComponentProcessor(): Processor {
  return unified();
}
