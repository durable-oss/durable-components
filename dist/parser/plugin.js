"use strict";
/**
 * Durable Component Parser Plugin
 *
 * A unified plugin that parses .dce source into a D-AST,
 * then immediately transforms it into the component tree (IR).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.durableParser = void 0;
const index_1 = require("./index");
const transformer_1 = require("../transformer");
/**
 * Durable component parser plugin
 *
 * This plugin parses .dce source files into the component tree (IR).
 * It combines the parsing and initial transformation phases.
 *
 * @example
 * ```js
 * import { unified } from 'unified';
 * import { durableParser } from '@durable/compiler/parser';
 *
 * const processor = unified().use(durableParser, { filename: 'Counter.dce' });
 * ```
 */
const durableParser = function (options = {}) {
    const parser = (doc, file) => {
        const source = String(doc);
        const filename = options.filename || 'Component.dce';
        // Set the file path so other plugins can access it
        if (filename && file) {
            file.path = filename;
        }
        // Phase 1: Parse source into D-AST
        const ast = (0, index_1.parse)(source, { filename });
        // Phase 2: Transform D-AST into component tree (IR)
        const tree = (0, transformer_1.transform)(ast);
        return tree;
    };
    // @ts-ignore - unified types are complex, but this is the correct pattern
    this.parser = parser;
};
exports.durableParser = durableParser;
