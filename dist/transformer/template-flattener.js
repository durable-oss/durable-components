"use strict";
/**
 * Template Flattener
 *
 * This module implements template flattening - the process of inlining
 * component templates directly into the parent component's template.
 *
 * Example:
 *   <Button>OK!</Button>
 * becomes:
 *   <button class="m-2">OK!</button>
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
exports.flattenComponentTemplates = flattenComponentTemplates;
const parser_1 = require("../parser");
const index_1 = require("./index");
const path_resolver_1 = require("../utils/path-resolver");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Flatten component templates in the IR
 *
 * This function walks the template tree and replaces component usage
 * with the actual template content from the component files.
 *
 * @param ir - The component IR to flatten
 * @param options - Flattening options
 * @returns Modified IR with flattened templates
 */
function flattenComponentTemplates(ir, options) {
    const { sourcePath, maxDepth = 10 } = options;
    const baseDir = path.dirname(sourcePath);
    // Build a map of component names to their source paths
    const componentMap = buildComponentMap(ir);
    // Recursively flatten the template
    const flattenedTemplate = flattenTemplateNode(ir.template, componentMap, baseDir, 0, maxDepth);
    return {
        ...ir,
        template: flattenedTemplate
    };
}
/**
 * Build a map of component names to their import sources
 */
function buildComponentMap(ir) {
    const map = new Map();
    if (!ir.imports) {
        return map;
    }
    for (const imp of ir.imports) {
        // Only consider relative imports (DCE components)
        if (!imp.source.startsWith('./') && !imp.source.startsWith('../')) {
            continue;
        }
        for (const spec of imp.specifiers) {
            // Only consider components (uppercase first letter)
            const localName = spec.local;
            if (!/^[A-Z]/.test(localName)) {
                continue;
            }
            map.set(localName, {
                localName,
                source: imp.source,
                isDefault: spec.type === 'default'
            });
        }
    }
    return map;
}
/**
 * Recursively flatten a template node
 */
function flattenTemplateNode(node, componentMap, baseDir, depth, maxDepth) {
    // Prevent infinite recursion
    if (depth >= maxDepth) {
        console.warn(`Template flattening max depth (${maxDepth}) reached, stopping recursion`);
        return node;
    }
    // Handle text nodes
    if (node.type === 'text' || node.type === 'expression') {
        return node;
    }
    // Handle element nodes
    if (node.type === 'element') {
        const componentRef = componentMap.get(node.name);
        // If this is a component reference, flatten it
        if (componentRef) {
            return flattenComponent(node, componentRef, componentMap, baseDir, depth, maxDepth);
        }
        // Otherwise, recursively flatten children
        return {
            ...node,
            children: node.children.map(child => flattenTemplateNode(child, componentMap, baseDir, depth, maxDepth))
        };
    }
    return node;
}
/**
 * Flatten a component usage into its template
 */
function flattenComponent(node, componentRef, componentMap, baseDir, depth, maxDepth) {
    try {
        // Resolve the component file path
        const componentPath = (0, path_resolver_1.resolveComponentPath)(componentRef.source, {
            baseDir,
            extensions: ['.dce'],
            checkExists: true
        });
        if (!componentPath) {
            console.warn(`Could not resolve component ${componentRef.localName} from ${componentRef.source}`);
            return node;
        }
        // Read and parse the component
        const componentSource = fs.readFileSync(componentPath, 'utf-8');
        const componentAST = (0, parser_1.parse)(componentSource, { filename: componentPath });
        const componentIR = (0, index_1.transform)(componentAST);
        // Get the component's template
        let componentTemplate = componentIR.template;
        // Substitute props
        componentTemplate = substituteProps(componentTemplate, node.attributes || []);
        // Substitute children
        componentTemplate = substituteChildren(componentTemplate, node.children);
        // Recursively flatten the component's template
        const newComponentMap = buildComponentMap(componentIR);
        const newBaseDir = path.dirname(componentPath);
        componentTemplate = flattenTemplateNode(componentTemplate, newComponentMap, newBaseDir, depth + 1, maxDepth);
        return componentTemplate;
    }
    catch (error) {
        console.error(`Error flattening component ${componentRef.localName}:`, error instanceof Error ? error.message : String(error));
        return node;
    }
}
/**
 * Substitute prop values in a template
 */
function substituteProps(template, attributes) {
    // Create a map of prop values
    const propValues = new Map();
    for (const attr of attributes) {
        propValues.set(attr.name, attr.value);
    }
    // Walk the template and replace prop references
    return walkAndReplace(template, (node) => {
        if (node.type === 'expression') {
            const exprNode = node;
            const expr = exprNode.expression;
            // Handle simple prop references like {propName}
            const match = expr.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)$/);
            if (match) {
                const propName = match[1];
                if (propValues.has(propName)) {
                    const value = propValues.get(propName);
                    // Return as text node with the value
                    return {
                        type: 'text',
                        content: value
                    };
                }
            }
        }
        return node;
    });
}
/**
 * Substitute children in a template
 */
function substituteChildren(template, children) {
    return walkAndReplace(template, (node) => {
        if (node.type === 'expression') {
            const exprNode = node;
            if (exprNode.expression === 'children') {
                // Replace {children} with the actual children
                // If there's only one child, return it directly
                if (children.length === 1) {
                    return children[0];
                }
                // If there are multiple children, we need to wrap them somehow
                // For now, we'll return a fragment-like structure
                // This will need to be handled by the code generator
                return {
                    type: 'element',
                    name: 'fragment',
                    attributes: [],
                    children
                };
            }
        }
        return node;
    });
}
/**
 * Walk a template tree and replace nodes based on a transformer function
 */
function walkAndReplace(node, transformer) {
    // First transform this node
    const transformed = transformer(node);
    // If the node was replaced, return the replacement
    if (transformed !== node) {
        return transformed;
    }
    // Otherwise, recursively transform children
    if (node.type === 'element') {
        return {
            ...node,
            children: node.children.map(child => walkAndReplace(child, transformer))
        };
    }
    return node;
}
