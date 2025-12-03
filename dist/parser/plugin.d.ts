/**
 * Durable Component Parser Plugin
 *
 * A unified plugin that parses .dce source into a D-AST,
 * then immediately transforms it into the component tree (IR).
 */
import type { Plugin } from 'unified';
import type { DurableComponentIR } from '../types/ir';
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
export declare const durableParser: Plugin<[DurableParserOptions?], string, DurableComponentIR>;
