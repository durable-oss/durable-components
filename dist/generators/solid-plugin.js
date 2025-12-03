"use strict";
/**
 * Solid Compiler Plugin
 *
 * A unified compiler plugin that transforms the component tree (IR)
 * into Solid component code.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.durableSolidCompiler = void 0;
const solid_1 = require("./solid");
/**
 * Solid compiler plugin
 *
 * This plugin compiles the component tree into Solid component code.
 *
 * @example
 * ```js
 * import { unified } from 'unified';
 * import { durableParser } from '@durable/compiler/parser';
 * import { durableSolidCompiler } from '@durable/compiler/generators';
 *
 * const processor = unified()
 *   .use(durableParser)
 *   .use(durableSolidCompiler);
 *
 * const result = processor.processSync(source);
 * console.log(result.value); // Solid code
 * ```
 */
const durableSolidCompiler = function (options = {}) {
    const compiler = (tree) => {
        const result = (0, solid_1.generateSolid)(tree);
        return result.code;
    };
    // @ts-ignore - unified types are complex, but this is the correct pattern
    this.compiler = compiler;
};
exports.durableSolidCompiler = durableSolidCompiler;
