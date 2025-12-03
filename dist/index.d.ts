/**
 * Durable Component Compiler
 *
 * Public API exports - now using the unified.js collective framework
 */
import type { CompileOptions, CompileResult } from './types/compiler';
/**
 * Main compile function
 *
 * Compiles a .dce source file into target framework code.
 * This is the primary API for the @durable/compiler package.
 *
 * Now uses the unified.js collective framework for component tree transformation.
 */
export declare function compile(source: string, options: CompileOptions): CompileResult;
/**
 * Export types for consumers
 */
export type { CompileOptions, CompileResult, IncludedComponent, ParseOptions, CompilerTarget, StyleMode } from './types/compiler';
export type { DurableComponentIR } from './types/ir';
/**
 * Export unified.js plugins for advanced usage
 */
export { durableComponentProcessor } from './processor';
export { durableParser } from './parser/plugin';
export { durableTreeStorage } from './transformer/plugin';
export { durableScopedStyles } from './styles/scoped-plugin';
export { durableComponentFlattener } from './transformer/flattener-plugin';
export { durableTemplateFlatten } from './transformer/template-flattener-plugin';
export { durableReactCompiler } from './generators/react-plugin';
export { durableSolidCompiler } from './generators/solid-plugin';
export { durableSvelteCompiler } from './generators/svelte-plugin';
export { durableVueCompiler } from './generators/vue-plugin';
/**
 * Export legacy APIs for backward compatibility
 */
export { parse } from './parser';
export { transform } from './transformer';
export { CompilerError } from './types/compiler';
