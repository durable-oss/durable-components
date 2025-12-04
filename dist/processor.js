"use strict";
/**
 * Durable Component Processor
 *
 * This is the unified.js processor for durable components.
 * It orchestrates the parse-transform-compile pipeline using plugins.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.durableComponentProcessor = durableComponentProcessor;
const unified_1 = require("unified");
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
function durableComponentProcessor() {
    return (0, unified_1.unified)();
}
