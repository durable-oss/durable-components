/**
 * Durable Component Parser Plugin
 *
 * A unified plugin that parses .dce source into a D-AST,
 * then immediately transforms it into the component tree (IR).
 */

import type { Plugin } from 'unified';
import type { DurableComponentIR } from '../types/ir';
import { parse } from './index';
import { transform } from '../transformer';

/**
 * Options for the durable parser plugin
 */
export interface DurableParserOptions {
  filename?: string;
}

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
export const durableParser: Plugin<[DurableParserOptions?], string, DurableComponentIR> = function (
  options = {}
) {
  const parser = (doc: string, file: any): DurableComponentIR => {
    const source = String(doc);
    const filename = options.filename || 'Component.dce';

    // Set the file path so other plugins can access it
    if (filename && file) {
      file.path = filename;
    }

    // Phase 1: Parse source into D-AST
    const ast = parse(source, { filename });

    // Phase 2: Transform D-AST into component tree (IR)
    const tree = transform(ast);

    return tree;
  };

  // @ts-ignore - unified types are complex, but this is the correct pattern
  this.parser = parser;
};
