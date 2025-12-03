"use strict";
/**
 * Component Reference Flattener
 *
 * Recursively compiles all DCE components referenced by a component,
 * producing a flat output of all required components.
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
exports.flattenComponentReferences = flattenComponentReferences;
exports.getComponentDependencies = getComponentDependencies;
const component_analyzer_1 = require("./component-analyzer");
const path_resolver_1 = require("../utils/path-resolver");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Flattens all DCE component references recursively
 *
 * This function analyzes a component's IR, finds all referenced DCE components,
 * resolves their file paths, parses and analyzes them, and recursively processes
 * their dependencies.
 *
 * @param ir - The root component's intermediate representation
 * @param options - Flattening options
 * @returns Flattening result with all components and dependency order
 */
function flattenComponentReferences(ir, options) {
    const { sourcePath, baseDir = sourcePath ? (0, path_resolver_1.getBaseDir)(sourcePath) : process.cwd(), maxDepth = 50 } = options;
    const components = new Map();
    const visited = new Set();
    const dependencyOrder = [];
    /**
     * Recursively process a component and its dependencies
     */
    function processComponent(componentIR, componentPath, depth) {
        // Check depth limit to prevent infinite recursion
        if (depth > maxDepth) {
            console.warn(`Maximum recursion depth (${maxDepth}) reached for component ${componentIR.name}`);
            return;
        }
        // If we don't have a path, we can't resolve dependencies
        if (!componentPath) {
            return;
        }
        // Normalize the path
        const normalizedPath = path.resolve(componentPath);
        // Skip if already visited
        if (visited.has(normalizedPath)) {
            return;
        }
        visited.add(normalizedPath);
        // Analyze component references
        const allReferences = (0, component_analyzer_1.analyzeComponentReferences)(componentIR);
        const dceReferences = (0, component_analyzer_1.filterDCEComponents)(allReferences);
        // Store this component
        const compiled = {
            sourcePath: normalizedPath,
            ir: componentIR,
            references: dceReferences
        };
        components.set(normalizedPath, compiled);
        // Resolve and process each DCE component reference
        const componentBaseDir = (0, path_resolver_1.getBaseDir)(normalizedPath);
        for (const reference of dceReferences) {
            const resolvedPath = (0, path_resolver_1.resolveComponentPath)(reference.source, {
                baseDir: componentBaseDir,
                extensions: ['.dce'],
                checkExists: true
            });
            if (!resolvedPath) {
                console.warn(`Could not resolve component '${reference.name}' from '${reference.source}' in ${componentIR.name}`);
                continue;
            }
            // Skip if already processed
            if (visited.has(resolvedPath)) {
                continue;
            }
            // Load and parse the referenced component
            try {
                const source = fs.readFileSync(resolvedPath, 'utf-8');
                // We need to parse this component to get its IR
                // For now, we'll use the parser directly (we'll import it in the next step)
                const referencedIR = parseComponentSource(source, resolvedPath);
                // Recursively process this component
                processComponent(referencedIR, resolvedPath, depth + 1);
            }
            catch (error) {
                console.error(`Error loading component from ${resolvedPath}:`, error);
            }
        }
        // Add to dependency order after processing dependencies (post-order)
        dependencyOrder.push(normalizedPath);
    }
    // Start processing from the root component
    processComponent(ir, sourcePath || null, 0);
    return {
        components,
        dependencyOrder
    };
}
/**
 * Parses a component source file to produce its IR
 *
 * This function reuses the existing parser and transformer to convert
 * a component source file into its intermediate representation.
 *
 * @param source - The component source code
 * @param filename - The filename for error messages
 * @returns The component's IR
 */
function parseComponentSource(source, filename) {
    const { parse } = require('../parser');
    const { transform } = require('./index');
    const ast = parse(source, { filename });
    return transform(ast);
}
/**
 * Gets all unique dependencies of a component (transitive closure)
 *
 * @param sourcePath - The source path of the component
 * @param flattenResult - The flatten result containing all components
 * @returns Set of all dependency source paths (excluding the component itself)
 */
function getComponentDependencies(sourcePath, flattenResult) {
    const dependencies = new Set();
    const normalizedPath = path.resolve(sourcePath);
    function collectDeps(compPath) {
        const component = flattenResult.components.get(compPath);
        if (!component)
            return;
        for (const reference of component.references) {
            const resolvedPath = (0, path_resolver_1.resolveComponentPath)(reference.source, {
                baseDir: (0, path_resolver_1.getBaseDir)(compPath),
                extensions: ['.dce'],
                checkExists: false // We already know it exists from flattening
            });
            if (resolvedPath) {
                const normalizedRefPath = path.resolve(resolvedPath);
                if (!dependencies.has(normalizedRefPath)) {
                    dependencies.add(normalizedRefPath);
                    collectDeps(normalizedRefPath);
                }
            }
        }
    }
    collectDeps(normalizedPath);
    return dependencies;
}
