/**
 * Compiler API Types
 *
 * These types define the public API of the @durable/compiler package,
 * modeled on svelte/compiler and @babel/core.
 */
/**
 * Target framework for code generation
 */
export type CompilerTarget = 'react' | 'vue' | 'solid' | 'svelte' | 'wc';
/**
 * Style generation mode
 */
export type StyleMode = 'scoped' | 'inline' | 'unocss';
/**
 * Source map for debugging
 */
export interface SourceMap {
    version: number;
    sources: string[];
    names: string[];
    mappings: string;
    sourcesContent?: string[];
}
/**
 * Compiler options
 */
export interface CompileOptions {
    /** Source filename (used for error messages and component naming) */
    filename: string;
    /** Target framework */
    target: CompilerTarget;
    /** Style generation mode */
    style?: StyleMode;
    /** Custom element tag name (used only when target is 'wc') */
    customElementTagName?: string;
    /** Generate source maps */
    sourcemap?: boolean;
    /** Development mode (more readable output, better errors) */
    dev?: boolean;
    /**
     * Include referenced components (recursively compile all referenced DCE components)
     * When enabled, the compiler will analyze the component's imports, resolve
     * referenced .dce files, and recursively compile them, returning all components
     * in the result.
     * @default false
     */
    includeReferences?: boolean;
    /**
     * Maximum recursion depth for component reference inclusion
     * @default 50
     */
    maxReferenceDepth?: number;
    /**
     * Flatten component templates (inline component usage into parent templates)
     * When enabled, component tags are replaced with their template content inline.
     * For example, <Button>OK</Button> becomes the Button component's template
     * with "OK" substituted for {children}.
     * @default false
     */
    flatten?: boolean;
}
/**
 * Compiled JavaScript output
 */
export interface CompiledJS {
    /** Generated JavaScript code */
    code: string;
    /** Source map (if sourcemap option was true) */
    map?: SourceMap;
}
/**
 * Compiled CSS output
 */
export interface CompiledCSS {
    /** Generated CSS code */
    code: string;
    /** Source map (if sourcemap option was true) */
    map?: SourceMap;
}
/**
 * Included component result (from includeReferences option)
 */
export interface IncludedComponent {
    /** Component source file path */
    path: string;
    /** Component name */
    name: string;
    /** Compiled JavaScript output */
    js: CompiledJS;
    /** Compiled CSS output (null if no styles) */
    css: CompiledCSS | null;
}
/**
 * Result of compilation
 */
export interface CompileResult {
    /** JavaScript output */
    js: CompiledJS;
    /** CSS output (null if no styles or inline mode) */
    css: CompiledCSS | null;
    /** Warnings generated during compilation */
    warnings?: CompilerWarning[];
    /** Component metadata */
    meta?: {
        /** Component name */
        name: string;
        /** Exported props */
        props: string[];
    };
    /**
     * Included components (only present when includeReferences option is enabled)
     * Array of all recursively compiled DCE components referenced by this component.
     * Components are ordered by dependency (leaves first, root last).
     */
    components?: IncludedComponent[];
}
/**
 * Compiler warning
 */
export interface CompilerWarning {
    /** Warning message */
    message: string;
    /** Source location (if available) */
    start?: {
        line: number;
        column: number;
    };
    end?: {
        line: number;
        column: number;
    };
    /** Warning code (for filtering) */
    code?: string;
}
/**
 * Compiler error
 */
export declare class CompilerError extends Error {
    start?: {
        line: number;
        column: number;
    } | undefined;
    end?: {
        line: number;
        column: number;
    } | undefined;
    code?: string | undefined;
    constructor(message: string, start?: {
        line: number;
        column: number;
    } | undefined, end?: {
        line: number;
        column: number;
    } | undefined, code?: string | undefined);
}
/**
 * Parse options
 */
export interface ParseOptions {
    /** Source filename */
    filename?: string;
}
