"use strict";
/**
 * IR Transformer Plugin Interface
 *
 * This module provides a unified interface for creating custom IR transformation plugins.
 * IR transformers operate on the DurableComponentIR and can modify it in arbitrary ways.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createIRTransformerPlugin = createIRTransformerPlugin;
exports.isDurableComponentIR = isDurableComponentIR;
exports.visitTemplateNodes = visitTemplateNodes;
exports.cloneIR = cloneIR;
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
function createIRTransformerPlugin(transformer, defaultOptions) {
    const plugin = function (userOptions) {
        const options = { ...defaultOptions, ...userOptions };
        // Check if transformer is disabled
        if (options.enabled === false) {
            return;
        }
        return (tree, file) => {
            const result = transformer(tree, file, options);
            // Handle both sync and async transformers
            if (result && typeof result.then === 'function') {
                return result.then(r => r || tree);
            }
            // If transformer returns void, it mutated the tree in place
            return result || tree;
        };
    };
    return plugin;
}
/**
 * Type guard to check if a value is a DurableComponentIR
 */
function isDurableComponentIR(value) {
    return (value &&
        typeof value === 'object' &&
        value.type === 'component' &&
        typeof value.name === 'string' &&
        Array.isArray(value.props) &&
        Array.isArray(value.state));
}
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
function visitTemplateNodes(node, visitor) {
    // Call visitor on current node
    const shouldContinue = visitor(node);
    if (shouldContinue === false)
        return;
    // Recursively visit children
    if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
            visitTemplateNodes(child, visitor);
        }
    }
    // Visit consequent/alternate for if nodes
    if (node.type === 'if') {
        if (node.consequent) {
            for (const child of node.consequent) {
                visitTemplateNodes(child, visitor);
            }
        }
        if (node.alternate) {
            for (const child of node.alternate) {
                visitTemplateNodes(child, visitor);
            }
        }
    }
    // Visit fallback for slot nodes
    if (node.type === 'slot' && node.fallback) {
        for (const child of node.fallback) {
            visitTemplateNodes(child, visitor);
        }
    }
}
/**
 * Helper to deep clone an IR tree
 * Useful when you want to return a modified copy instead of mutating
 */
function cloneIR(tree) {
    return JSON.parse(JSON.stringify(tree));
}
