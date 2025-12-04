/**
 * IR Transformer Plugin Interface
 *
 * This module provides a unified interface for creating custom IR transformation plugins.
 * IR transformers operate on the DurableComponentIR and can modify it in arbitrary ways.
 */
import type { Plugin } from 'unified';
import type { VFile } from 'vfile';
import type { DurableComponentIR } from '../types/ir';
/**
 * Transform function that operates on the IR
 *
 * @param tree - The component IR to transform
 * @param file - The VFile being processed
 * @returns The transformed IR (can be the same object if mutated, or a new IR)
 */
export type IRTransformer = (tree: DurableComponentIR, file: VFile) => DurableComponentIR | void | Promise<DurableComponentIR | void>;
/**
 * Base options that all IR transformer plugins can use
 */
export interface IRTransformerOptions {
    /**
     * Whether this transformer is enabled (default: true)
     * Useful for conditional transformations
     */
    enabled?: boolean;
    /**
     * Priority/order hint for the transformer (lower runs first)
     * This is advisory - actual order is determined by .use() call order
     */
    priority?: number;
}
/**
 * Helper to create an IR transformer plugin
 *
 * This factory function makes it easy to create plugins that transform
 * the DurableComponentIR in the unified.js pipeline.
 *
 * @param transformer - The transformation function
 * @param options - Optional plugin configuration
 * @returns A unified.js plugin
 *
 * @example
 * ```ts
 * // Simple transformer that logs component name
 * const logComponentName = createIRTransformerPlugin((tree, file) => {
 *   console.log(`Processing component: ${tree.name}`);
 *   return tree;
 * });
 *
 * // Use it in a processor
 * const processor = durableComponentProcessor()
 *   .use(durableParser)
 *   .use(logComponentName)
 *   .use(durableReactCompiler);
 * ```
 *
 * @example
 * ```ts
 * // Transformer with options
 * interface MyTransformerOptions extends IRTransformerOptions {
 *   prefix?: string;
 * }
 *
 * const addPrefixToComponentName = createIRTransformerPlugin<MyTransformerOptions>(
 *   (tree, file, options) => {
 *     const prefix = options?.prefix || 'Durable';
 *     tree.name = `${prefix}${tree.name}`;
 *     return tree;
 *   }
 * );
 *
 * // Use with custom options
 * processor.use(addPrefixToComponentName, { prefix: 'My' });
 * ```
 */
export declare function createIRTransformerPlugin<TOptions extends IRTransformerOptions = IRTransformerOptions>(transformer: (tree: DurableComponentIR, file: VFile, options?: TOptions) => DurableComponentIR | void | Promise<DurableComponentIR | void>, defaultOptions?: TOptions): Plugin<[TOptions?], DurableComponentIR>;
/**
 * Type guard to check if a value is a DurableComponentIR
 */
export declare function isDurableComponentIR(value: any): value is DurableComponentIR;
/**
 * Visitor pattern for traversing template nodes
 *
 * @example
 * ```ts
 * import { visitTemplateNodes } from './ir-transformer-plugin';
 *
 * const countElements = createIRTransformerPlugin((tree) => {
 *   let count = 0;
 *   visitTemplateNodes(tree.template, (node) => {
 *     if (node.type === 'element') count++;
 *   });
 *   console.log(`Found ${count} elements`);
 *   return tree;
 * });
 * ```
 */
export declare function visitTemplateNodes(node: any, visitor: (node: any) => void | boolean): void;
/**
 * Helper to deep clone an IR tree
 * Useful when you want to return a modified copy instead of mutating
 */
export declare function cloneIR(tree: DurableComponentIR): DurableComponentIR;
