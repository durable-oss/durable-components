"use strict";
/**
 * React Compiler Plugin
 *
 * A unified compiler plugin that transforms the component tree (IR)
 * into React component code.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.durableReactCompiler = void 0;
const react_1 = require("./react");
/**
 * React compiler plugin
 *
 * This plugin compiles the component tree into React component code.
 *
 * @example
 * ```js
 * import { unified } from 'unified';
 * import { durableParser } from '@durable/compiler/parser';
 * import { durableReactCompiler } from '@durable/compiler/generators';
 *
 * const processor = unified()
 *   .use(durableParser)
 *   .use(durableReactCompiler);
 *
 * const result = processor.processSync(source);
 * console.log(result.value); // React code
 * ```
 */
const durableReactCompiler = function (options = {}) {
    const compiler = (tree) => {
        const result = (0, react_1.generateReact)(tree);
        return result.code;
    };
    // @ts-ignore - unified types are complex, but this is the correct pattern
    this.compiler = compiler;
};
exports.durableReactCompiler = durableReactCompiler;
