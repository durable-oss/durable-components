/**
 * Component Flattener Plugin for unified.js
 *
 * This plugin integrates component reference flattening into the compilation pipeline.
 */
import type { Plugin } from 'unified';
import type { DurableComponentIR } from '../types/ir';
import type { CompilerTarget, StyleMode } from '../types/compiler';
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
export declare const durableComponentFlattener: Plugin<[ComponentFlattenerOptions?], DurableComponentIR>;
export default durableComponentFlattener;
