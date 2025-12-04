/**
 * Utility functions for Parsimmon parsers
 */

import * as P from 'parsimmon';
import { parse as acornParse } from 'acorn';
import { CompilerError } from '../../types/compiler';

/**
 * Strip TypeScript type annotations from an expression
 * Handles common patterns like (param: Type), variable: Type, <Type>value, etc.
 */
function stripTypeAnnotations(expr: string): string {
  let result = expr;

  // Remove type annotations from arrow function parameters: (e: Event) => ... → (e) => ...
  // Also handles multiple params: (a: string, b: number) => ...
  result = result.replace(/\(([^)]+)\)\s*=>/g, (match, params) => {
    const cleanedParams = params
      .split(',')
      .map((param: string) => {
        // Remove type annotation after colon
        const colonIndex = param.indexOf(':');
        if (colonIndex !== -1) {
          return param.substring(0, colonIndex).trim();
        }
        return param.trim();
      })
      .join(', ');
    return `(${cleanedParams}) =>`;
  });

  // Remove type annotations from regular function parameters: function(e: Event)
  result = result.replace(/function\s*\(([^)]+)\)/g, (match, params) => {
    const cleanedParams = params
      .split(',')
      .map((param: string) => {
        const colonIndex = param.indexOf(':');
        if (colonIndex !== -1) {
          return param.substring(0, colonIndex).trim();
        }
        return param.trim();
      })
      .join(', ');
    return `function(${cleanedParams})`;
  });

  // Remove return type annotations: (): Type => ... → () => ...
  result = result.replace(/\)\s*:\s*[A-Za-z_$][\w$]*(?:<[^>]+>)?(?:\[\])*\s*=>/g, ') =>');

  // Remove type assertions: value as Type → value
  result = result.replace(/\s+as\s+[A-Za-z_$][\w$]*(?:<[^>]+>)?(?:\[\])*(?=\s|$|[;,)\]}])/g, '');

  // Remove generic type parameters: Array<string> → Array (simple version, doesn't handle nested)
  // We keep this simple to avoid breaking valid code

  return result;
}

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
    // Strip TypeScript type annotations before parsing
    const cleanedExpr = stripTypeAnnotations(trimmedExpr);

    // Try to parse as-is first
    let ast;
    try {
      ast = acornParse(cleanedExpr, {
        ecmaVersion: 2022,
        sourceType: 'module'
      });
    } catch (firstError) {
      // If it starts with { and ends with }, it might be an object literal
      // Try wrapping in parentheses to make it a valid expression
      if (cleanedExpr.startsWith('{') && cleanedExpr.endsWith('}')) {
        ast = acornParse(`(${cleanedExpr})`, {
          ecmaVersion: 2022,
          sourceType: 'module'
        });
      } else {
        throw firstError;
      }
    }

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
