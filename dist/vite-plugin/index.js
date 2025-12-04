"use strict";
/**
 * Vite Plugin for Durable Components
 *
 * This plugin integrates .dce files into the Vite build pipeline,
 * compiling them to the target framework during development and build.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.durableComponents = durableComponents;
const index_1 = require("../index");
const path = __importStar(require("path"));
/**
 * Vite plugin for Durable Components
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import { defineConfig } from 'vite';
 * import { durableComponents } from '@durable/compiler/vite-plugin';
 *
 * export default defineConfig({
 *   plugins: [
 *     durableComponents({
 *       target: 'react',
 *       style: 'scoped'
 *     })
 *   ]
 * });
 * ```
 */
function durableComponents(options = {}) {
    const { target = 'react', style = 'scoped', extensions = ['.dce'], dev, include, exclude = ['node_modules/**'] } = options;
    // Track CSS files generated during compilation
    const cssMap = new Map();
    // Track component dependencies for HMR
    const componentDeps = new Map();
    let server;
    let isDev = false;
    return {
        name: 'vite-plugin-durable-components',
        // Run before other plugins that might transform JS
        enforce: 'pre',
        configResolved(config) {
            isDev = config.command === 'serve' || dev === true;
        },
        configureServer(_server) {
            server = _server;
        },
        resolveId(source, importer) {
            // Handle virtual CSS modules
            if (source.startsWith('dce-css:')) {
                return source;
            }
            // Handle .dce file imports
            if (extensions.some(ext => source.endsWith(ext))) {
                // Resolve relative imports
                if (importer && source.startsWith('.')) {
                    const resolved = path.resolve(path.dirname(importer), source);
                    return resolved;
                }
            }
            return null;
        },
        load(id) {
            // Serve virtual CSS modules
            if (id.startsWith('dce-css:')) {
                const actualId = id.slice('dce-css:'.length);
                const css = cssMap.get(actualId);
                if (css) {
                    return {
                        code: css,
                        map: null
                    };
                }
            }
            return null;
        },
        async transform(code, id) {
            // Only process files with the configured extensions
            const isTargetFile = extensions.some(ext => id.endsWith(ext));
            if (!isTargetFile) {
                return null;
            }
            // Check exclude patterns
            if (exclude) {
                const excludePatterns = Array.isArray(exclude) ? exclude : [exclude];
                for (const pattern of excludePatterns) {
                    if (minimatch(id, pattern)) {
                        return null;
                    }
                }
            }
            // Check include patterns
            if (include) {
                const includePatterns = Array.isArray(include) ? include : [include];
                let matched = false;
                for (const pattern of includePatterns) {
                    if (minimatch(id, pattern)) {
                        matched = true;
                        break;
                    }
                }
                if (!matched) {
                    return null;
                }
            }
            try {
                const filename = path.basename(id);
                // Compile the .dce file
                const result = (0, index_1.compile)(code, {
                    filename,
                    target,
                    style,
                    dev: isDev
                });
                let transformedCode = result.js.code;
                // Handle CSS output
                if (result.css && result.css.code) {
                    // Store CSS for later retrieval
                    cssMap.set(id, result.css.code);
                    // Inject CSS import into the component
                    // This creates a virtual module that Vite will process
                    const cssImport = `import 'dce-css:${id}';\n`;
                    transformedCode = cssImport + transformedCode;
                }
                // Track dependencies for HMR
                if (server && isDev) {
                    const deps = componentDeps.get(id) || new Set();
                    // Add self to deps
                    deps.add(id);
                    // If there's CSS, track it too
                    if (result.css) {
                        deps.add(`dce-css:${id}`);
                    }
                    componentDeps.set(id, deps);
                }
                return {
                    code: transformedCode,
                    map: null // TODO: Support source maps
                };
            }
            catch (error) {
                // Format compiler errors nicely
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.error({
                    message: `Failed to compile ${path.basename(id)}: ${errorMessage}`,
                    id
                });
                return null;
            }
        },
        handleHotUpdate({ file, server: _server }) {
            // Handle HMR for .dce files
            if (extensions.some(ext => file.endsWith(ext))) {
                // Clear CSS cache for this file
                cssMap.delete(file);
                // Get all modules that depend on this component
                const deps = componentDeps.get(file);
                if (deps) {
                    const modules = Array.from(deps)
                        .map(id => _server.moduleGraph.getModuleById(id))
                        .filter((m) => m !== undefined);
                    // Invalidate all dependent modules
                    modules.forEach(mod => {
                        _server.moduleGraph.invalidateModule(mod);
                    });
                    return modules;
                }
            }
            return undefined;
        },
        // Clean up on build end
        buildEnd() {
            cssMap.clear();
            componentDeps.clear();
        }
    };
}
/**
 * Simple glob pattern matcher (minimal implementation)
 * For production use, consider using a library like 'micromatch'
 */
function minimatch(file, pattern) {
    // Simple implementation - converts glob to regex
    const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '.');
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(file);
}
exports.default = durableComponents;
