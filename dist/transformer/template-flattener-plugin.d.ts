/**
 * Template Flattener Plugin for unified.js
 *
 * This plugin integrates template flattening into the compilation pipeline.
 * It replaces component usage with inline template content.
 */
import type { Plugin } from 'unified';
import type { DurableComponentIR } from '../types/ir';
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
export declare const durableTemplateFlatten: Plugin<[TemplateFlatteningOptionsWithFilename?], DurableComponentIR>;
export default durableTemplateFlatten;
