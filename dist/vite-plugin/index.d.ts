/**
 * Vite Plugin for Durable Components
 *
 * This plugin integrates .dce files into the Vite build pipeline,
 * compiling them to the target framework during development and build.
 */
import type { Plugin } from 'vite';
import type { CompilerTarget, StyleMode } from '../types/compiler';
export interface DurableComponentsPluginOptions {
    /**
     * Target framework to compile to
     * @default 'react'
     */
    target?: CompilerTarget;
    /**
     * Style generation mode
     * @default 'scoped'
     */
    style?: StyleMode;
    /**
     * File extensions to process
     * @default ['.dce']
     */
    extensions?: string[];
    /**
     * Enable development mode (more readable output, better errors)
     * @default true in dev, false in build
     */
    dev?: boolean;
    /**
     * Include file patterns (glob)
     * @default undefined (all .dce files)
     */
    include?: string | string[];
    /**
     * Exclude file patterns (glob)
     * @default ['node_modules/**']
     */
    exclude?: string | string[];
}
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
export declare function durableComponents(options?: DurableComponentsPluginOptions): Plugin;
export default durableComponents;
