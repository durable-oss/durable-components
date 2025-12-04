"use strict";
/**
 * Svelte Compiler Plugin
 *
 * A unified compiler plugin that transforms the component tree (IR)
 * into Svelte component code.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.durableSvelteCompiler = void 0;
const svelte_1 = require("./svelte");
/**
 * Svelte compiler plugin
 *
 * This plugin compiles the component tree into Svelte component code.
 *
 * @example
 * ```js
 * import { unified } from 'unified';
 * import { durableParser } from '@durable/compiler/parser';
 * import { durableSvelteCompiler } from '@durable/compiler/generators';
 *
 * const processor = unified()
 *   .use(durableParser)
 *   .use(durableSvelteCompiler);
 *
 * const result = processor.processSync(source);
 * console.log(result.value); // Svelte code
 * ```
 */
const durableSvelteCompiler = function (options = {}) {
    const compiler = (tree) => {
        const result = (0, svelte_1.generateSvelte)(tree);
        return result.code;
    };
    // @ts-ignore - unified types are complex, but this is the correct pattern
    this.compiler = compiler;
};
exports.durableSvelteCompiler = durableSvelteCompiler;
