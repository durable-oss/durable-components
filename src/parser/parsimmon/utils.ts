/**
 * Utility functions for Parsimmon parsers
 */

import * as P from 'parsimmon';
import { parse as acornParse } from 'acorn';
import { CompilerError } from '../../types/compiler';

/**
 * Parse JavaScript expression using Acorn
 */
export function parseExpression(expr: string): any {
  if (typeof expr !== 'string') {
    throw new TypeError('parseExpression: expr must be a string');
  }

  const trimmedExpr = expr.trim();

  if (trimmedExpr.length === 0) {
    throw new CompilerError(
      'parseExpression: expression cannot be empty',
      undefined,
      undefined,
      'INVALID_EXPRESSION'
    );
  }

  const MAX_EXPRESSION_LENGTH = 10000;
  if (trimmedExpr.length > MAX_EXPRESSION_LENGTH) {
    throw new CompilerError(
      `parseExpression: expression too long (${trimmedExpr.length} > ${MAX_EXPRESSION_LENGTH})`,
      undefined,
      undefined,
      'INVALID_EXPRESSION'
    );
  }

  try {
    const ast = acornParse(trimmedExpr, {
      ecmaVersion: 2022,
      sourceType: 'module'
    });

    if (!ast || typeof ast !== 'object') {
      throw new CompilerError(
        `parseExpression: failed to parse expression "${trimmedExpr}"`,
        undefined,
        undefined,
        'INVALID_EXPRESSION'
      );
    }

    return ast;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new CompilerError(
      `Invalid expression: ${trimmedExpr} - ${errorMessage}`,
      undefined,
      undefined,
      'INVALID_EXPRESSION'
    );
  }
}

/**
 * Helper type for parsers that track position
 */
export type IndexedParser<T> = P.Parser<T & { start: number; end: number }>;

/**
 * Wrap a parser to track start and end positions
 */
export function indexed<T>(parser: P.Parser<T>): IndexedParser<T> {
  return P.seq(
    P.index,
    parser,
    P.index
  ).map(([start, value, end]) => ({ ...value as any, start, end } as T & { start: number; end: number }));
}
