/**
 * Phase 1: Parser
 *
 * Parses .dce source files into a D-AST (Durable AST).
 * This phase separates <script>, <template>, and <style> blocks
 * and parses each into their respective AST representations.
 */
import type { DurableComponentAST } from '../types/ast';
import type { ParseOptions } from '../types/compiler';
import { filenameToComponentName } from '../utils/string';
/**
 * Main parse function
 *
 * Converts .dce source string into D-AST
 */
export declare function parse(source: string, options?: ParseOptions): DurableComponentAST;
/**
 * Convenience export
 */
export { filenameToComponentName };
