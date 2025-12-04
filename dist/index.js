"use strict";
/**
 * Durable Component Compiler
 *
 * Public API exports - now using the unified.js collective framework
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompilerError = exports.transform = exports.parse = exports.durableVueCompiler = exports.durableSvelteCompiler = exports.durableSolidCompiler = exports.durableReactCompiler = exports.durableTemplateFlatten = exports.durableComponentFlattener = exports.durableScopedStyles = exports.durableTreeStorage = exports.durableParser = exports.durableComponentProcessor = void 0;
exports.compile = compile;
const processor_1 = require("./processor");
const plugin_1 = require("./parser/plugin");
const plugin_2 = require("./transformer/plugin");
const scoped_plugin_1 = require("./styles/scoped-plugin");
const react_plugin_1 = require("./generators/react-plugin");
const solid_plugin_1 = require("./generators/solid-plugin");
const svelte_plugin_1 = require("./generators/svelte-plugin");
const vue_plugin_1 = require("./generators/vue-plugin");
const flattener_plugin_1 = require("./transformer/flattener-plugin");
const template_flattener_plugin_1 = require("./transformer/template-flattener-plugin");
const compiler_1 = require("./types/compiler");
const react_1 = require("./generators/react");
const vue_1 = require("./generators/vue");
const solid_1 = require("./generators/solid");
const svelte_1 = require("./generators/svelte");
/**
 * Main compile function
 *
 * Compiles a .dce source file into target framework code.
 * This is the primary API for the @durable/compiler package.
 *
 * Now uses the unified.js collective framework for component tree transformation.
 */
function compile(source, options) {
    // Defensive: validate inputs
    if (typeof source !== 'string') {
        throw new TypeError('compile: source must be a string');
    }
    if (!options || typeof options !== 'object') {
        throw new TypeError('compile: options must be an object');
    }
    if (!options.target || typeof options.target !== 'string') {
        throw new compiler_1.CompilerError('compile: options.target is required and must be a string', undefined, undefined, 'INVALID_OPTIONS');
    }
    // Defensive: validate target value
    const validTargets = ['react', 'vue', 'solid', 'svelte', 'wc'];
    if (!validTargets.includes(options.target)) {
        throw new compiler_1.CompilerError(`Unknown target: ${options.target}. Valid targets are: ${validTargets.join(', ')}`, undefined, undefined, 'UNKNOWN_TARGET');
    }
    // Defensive: validate filename if provided
    if (options.filename !== undefined && typeof options.filename !== 'string') {
        throw new TypeError('compile: options.filename must be a string');
    }
    // Defensive: validate style mode if provided
    if (options.style !== undefined) {
        const validStyleModes = ['scoped', 'inline', 'unocss'];
        if (!validStyleModes.includes(options.style)) {
            throw new compiler_1.CompilerError(`Invalid style mode: ${options.style}. Valid modes are: ${validStyleModes.join(', ')}`, undefined, undefined, 'INVALID_STYLE_MODE');
        }
    }
    try {
        // Build the processor pipeline
        const styleMode = options.style || 'scoped';
        const includeReferencesEnabled = options.includeReferences || false;
        const flattenEnabled = options.flatten || false;
        // Start with parser
        const baseProcessor = (0, processor_1.durableComponentProcessor)()
            .use(plugin_1.durableParser, { filename: options.filename })
            .use(plugin_2.durableTreeStorage); // Store tree in file.data
        // Add template flattener if enabled (must run before styles)
        const templateFlattenedProcessor = flattenEnabled
            ? baseProcessor.use(template_flattener_plugin_1.durableTemplateFlatten, { enabled: true, maxDepth: 10, filename: options.filename })
            : baseProcessor;
        // Add style transformer if needed
        const styledProcessor = styleMode === 'scoped' || styleMode === 'inline'
            ? templateFlattenedProcessor.use(scoped_plugin_1.durableScopedStyles, { mode: styleMode })
            : templateFlattenedProcessor;
        // Add component reference includer if enabled
        const flattenedProcessor = includeReferencesEnabled
            ? styledProcessor.use(flattener_plugin_1.durableComponentFlattener, {
                target: options.target,
                style: styleMode,
                enabled: true,
                maxDepth: options.maxReferenceDepth || 50
            })
            : styledProcessor;
        // Add compiler based on target
        let finalProcessor;
        switch (options.target) {
            case 'react':
                finalProcessor = flattenedProcessor.use(react_plugin_1.durableReactCompiler);
                break;
            case 'vue':
                finalProcessor = flattenedProcessor.use(vue_plugin_1.durableVueCompiler);
                break;
            case 'solid':
                finalProcessor = flattenedProcessor.use(solid_plugin_1.durableSolidCompiler);
                break;
            case 'svelte':
                finalProcessor = flattenedProcessor.use(svelte_plugin_1.durableSvelteCompiler);
                break;
            case 'wc':
                throw new compiler_1.CompilerError('Web Component generator not yet implemented', undefined, undefined, 'NOT_IMPLEMENTED');
            default:
                throw new compiler_1.CompilerError(`Unknown target: ${options.target}`, undefined, undefined, 'UNKNOWN_TARGET');
        }
        // Process the source through the unified pipeline
        // Create a VFile with the filename if provided
        const file = options.filename
            ? finalProcessor.processSync({ value: source, path: options.filename })
            : finalProcessor.processSync(source);
        // The tree is stored in file.data by the durableTreeStorage plugin
        const tree = file.data.tree;
        const flattenResult = file.data.flatten;
        // Defensive: validate tree
        if (!tree || typeof tree !== 'object') {
            throw new compiler_1.CompilerError('compile: processor returned invalid tree', undefined, undefined, 'INVALID_IR');
        }
        if (typeof tree.name !== 'string') {
            throw new compiler_1.CompilerError('compile: tree missing valid name', undefined, undefined, 'INVALID_IR');
        }
        if (!Array.isArray(tree.props)) {
            throw new compiler_1.CompilerError('compile: tree props must be an array', undefined, undefined, 'INVALID_IR');
        }
        // The code is already generated by the compiler plugin
        const js = { code: String(file) };
        // Extract CSS from tree data if available
        let css = null;
        if (tree?.data?.scopedCSS) {
            css = tree.data.scopedCSS;
        }
        else if (tree?.data?.inlineCSS) {
            css = { code: tree.data.inlineCSS };
        }
        // Defensive: validate props for metadata
        const propNames = tree.props.map((p) => {
            if (!p || typeof p !== 'object' || typeof p.name !== 'string') {
                return 'unknown';
            }
            return p.name;
        });
        // Compile included components if enabled
        let includedComponents;
        if (includeReferencesEnabled && flattenResult) {
            includedComponents = [];
            // Compile each component in dependency order
            for (const componentPath of flattenResult.dependencyOrder) {
                const compiled = flattenResult.components.get(componentPath);
                if (!compiled)
                    continue;
                // Generate code for this component using the appropriate generator
                let componentCode = '';
                let componentCSS = null;
                switch (options.target) {
                    case 'react':
                        componentCode = (0, react_1.generateReact)(compiled.ir).code;
                        break;
                    case 'vue':
                        componentCode = (0, vue_1.generateVue)(compiled.ir).code;
                        break;
                    case 'solid':
                        componentCode = (0, solid_1.generateSolid)(compiled.ir).code;
                        break;
                    case 'svelte':
                        componentCode = (0, svelte_1.generateSvelte)(compiled.ir).code;
                        break;
                    default:
                        continue; // Skip if target not supported
                }
                // Extract CSS if available
                if (compiled.ir.styles && compiled.ir.styles.trim()) {
                    // Apply scoped styles if needed
                    if (styleMode === 'scoped') {
                        // For now, just use the raw styles
                        // TODO: Apply scoping logic
                        componentCSS = compiled.ir.styles;
                    }
                    else if (styleMode === 'inline') {
                        componentCSS = compiled.ir.styles;
                    }
                }
                includedComponents.push({
                    path: componentPath,
                    name: compiled.ir.name,
                    js: { code: componentCode },
                    css: componentCSS ? { code: componentCSS } : null
                });
            }
        }
        const result = {
            js,
            css,
            meta: {
                name: tree.name,
                props: propNames
            }
        };
        if (includedComponents) {
            result.components = includedComponents;
        }
        return result;
    }
    catch (error) {
        if (error instanceof compiler_1.CompilerError) {
            throw error;
        }
        // Defensive: handle various error types
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new compiler_1.CompilerError(`Compilation failed: ${errorMessage}`, undefined, undefined, 'COMPILATION_ERROR');
    }
}
/**
 * Export unified.js plugins for advanced usage
 */
var processor_2 = require("./processor");
Object.defineProperty(exports, "durableComponentProcessor", { enumerable: true, get: function () { return processor_2.durableComponentProcessor; } });
var plugin_3 = require("./parser/plugin");
Object.defineProperty(exports, "durableParser", { enumerable: true, get: function () { return plugin_3.durableParser; } });
var plugin_4 = require("./transformer/plugin");
Object.defineProperty(exports, "durableTreeStorage", { enumerable: true, get: function () { return plugin_4.durableTreeStorage; } });
var scoped_plugin_2 = require("./styles/scoped-plugin");
Object.defineProperty(exports, "durableScopedStyles", { enumerable: true, get: function () { return scoped_plugin_2.durableScopedStyles; } });
var flattener_plugin_2 = require("./transformer/flattener-plugin");
Object.defineProperty(exports, "durableComponentFlattener", { enumerable: true, get: function () { return flattener_plugin_2.durableComponentFlattener; } });
var template_flattener_plugin_2 = require("./transformer/template-flattener-plugin");
Object.defineProperty(exports, "durableTemplateFlatten", { enumerable: true, get: function () { return template_flattener_plugin_2.durableTemplateFlatten; } });
var react_plugin_2 = require("./generators/react-plugin");
Object.defineProperty(exports, "durableReactCompiler", { enumerable: true, get: function () { return react_plugin_2.durableReactCompiler; } });
var solid_plugin_2 = require("./generators/solid-plugin");
Object.defineProperty(exports, "durableSolidCompiler", { enumerable: true, get: function () { return solid_plugin_2.durableSolidCompiler; } });
var svelte_plugin_2 = require("./generators/svelte-plugin");
Object.defineProperty(exports, "durableSvelteCompiler", { enumerable: true, get: function () { return svelte_plugin_2.durableSvelteCompiler; } });
var vue_plugin_2 = require("./generators/vue-plugin");
Object.defineProperty(exports, "durableVueCompiler", { enumerable: true, get: function () { return vue_plugin_2.durableVueCompiler; } });
/**
 * Export legacy APIs for backward compatibility
 */
var parser_1 = require("./parser");
Object.defineProperty(exports, "parse", { enumerable: true, get: function () { return parser_1.parse; } });
var transformer_1 = require("./transformer");
Object.defineProperty(exports, "transform", { enumerable: true, get: function () { return transformer_1.transform; } });
var compiler_2 = require("./types/compiler");
Object.defineProperty(exports, "CompilerError", { enumerable: true, get: function () { return compiler_2.CompilerError; } });
