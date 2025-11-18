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
}

/**
 * Compiler warning
 */
export interface CompilerWarning {
  /** Warning message */
  message: string;

  /** Source location (if available) */
  start?: { line: number; column: number };
  end?: { line: number; column: number };

  /** Warning code (for filtering) */
  code?: string;
}

/**
 * Compiler error
 */
export class CompilerError extends Error {
  constructor(
    message: string,
    public start?: { line: number; column: number },
    public end?: { line: number; column: number },
    public code?: string
  ) {
    super(message);
    this.name = 'CompilerError';
  }
}

/**
 * Parse options
 */
export interface ParseOptions {
  /** Source filename */
  filename?: string;
}
