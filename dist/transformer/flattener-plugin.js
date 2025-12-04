"use strict";
/**
 * Component Flattener Plugin for unified.js
 *
 * This plugin integrates component reference flattening into the compilation pipeline.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.durableComponentFlattener = void 0;
const component_flattener_1 = require("./component-flattener");
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
const durableComponentFlattener = function (options = {}) {
    const { target = 'react', style = 'scoped', enabled = false, maxDepth = 50 } = options;
    // Only run if explicitly enabled
    if (!enabled) {
        return;
    }
    // Add a transformer to the pipeline
    return (tree, file) => {
        const vfile = file;
        // Get the source file path from the file
        const sourcePath = file.path || file.history[0];
        if (!sourcePath) {
            console.warn('Component flattener: no source path available, skipping flattening');
            return tree;
        }
        try {
            // Flatten component references
            const flattenResult = (0, component_flattener_1.flattenComponentReferences)(tree, {
                target,
                style,
                sourcePath,
                maxDepth
            });
            // Store the result in file.data for later use
            vfile.data.flatten = flattenResult;
            // Log flattening results
            if (flattenResult.components.size > 1) {
                console.log(`Flattened ${flattenResult.components.size - 1} component reference(s) from ${tree.name}`);
            }
        }
        catch (error) {
            console.error('Component flattener error:', error);
            // Don't fail the compilation, just log the error
        }
        // Return tree unchanged
        return tree;
    };
};
exports.durableComponentFlattener = durableComponentFlattener;
exports.default = exports.durableComponentFlattener;
