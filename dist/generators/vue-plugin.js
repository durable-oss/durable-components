"use strict";
/**
 * Vue Compiler Plugin
 *
 * A unified compiler plugin that transforms the component tree (IR)
 * into Vue 3 component code.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.durableVueCompiler = void 0;
const vue_1 = require("./vue");
/**
 * Vue compiler plugin
 *
 * This plugin compiles the component tree into Vue 3 component code.
 *
 * @example
 * ```js
 * import { unified } from 'unified';
 * import { durableParser } from '@durable/compiler/parser';
 * import { durableVueCompiler } from '@durable/compiler/generators';
 *
 * const processor = unified()
 *   .use(durableParser)
 *   .use(durableVueCompiler);
 *
 * const result = processor.processSync(source);
 * console.log(result.value); // Vue code
 * ```
 */
const durableVueCompiler = function (options = {}) {
    const compiler = (tree) => {
        const result = (0, vue_1.generateVue)(tree);
        return result.code;
    };
    // @ts-ignore - unified types are complex, but this is the correct pattern
    this.compiler = compiler;
};
exports.durableVueCompiler = durableVueCompiler;
