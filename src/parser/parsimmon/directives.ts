/**
 * @ directive parsers ({@render}, {@const}, {@html}, {@debug})
 */

import * as P from 'parsimmon';
import type {
  RenderBlockASTNode,
  ConstTagASTNode,
  HtmlTagASTNode,
  DebugTagASTNode
} from '../../types/ast';
import { indexed, type IndexedParser, parseExpression } from './utils';
import { expression } from './expressions';
import { CompilerError } from '../../types/compiler';

const optWhitespace = P.optWhitespace;

/**
 * {@render snippet()} directive parser
 */
export const renderBlock: IndexedParser<RenderBlockASTNode> = indexed(
  P.string('{@render')
    .then(optWhitespace)
    .then(expression)
    .skip(P.string('}'))
    .map(expr => {
      const trimmedExpr = expr.trim();
      if (!trimmedExpr) {
        throw new CompilerError(
          'Empty @render expression',
          undefined,
          undefined,
          'INVALID_SYNTAX'
        );
      }

      try {
        const parsed = parseExpression(trimmedExpr);
        let snippet = '';
        let args: any[] = [];
        let fullExpression = parsed;

        let actualExpr = parsed;
        if (parsed.type === 'Program' && parsed.body && parsed.body.length > 0) {
          const firstStatement = parsed.body[0];
          if (firstStatement.type === 'ExpressionStatement') {
            actualExpr = firstStatement.expression;
          }
        }

        // Handle optional chaining: children?.()
        if (actualExpr.type === 'ChainExpression') {
          actualExpr = actualExpr.expression;
        }

        if (actualExpr.type === 'CallExpression') {
          // Handle optional call: foo?.()
          let callee = actualExpr.callee;
          if (callee.type === 'Identifier') {
            snippet = callee.name;
          } else if (callee.type === 'MemberExpression') {
            // For member expressions like obj.method(), use the full expression
            snippet = trimmedExpr.split('(')[0].trim().replace(/\?\.$/g, '');
          } else {
            snippet = trimmedExpr.split('(')[0].trim().replace(/\?\.$/g, '');
          }
          args = actualExpr.arguments || [];
        } else if (actualExpr.type === 'Identifier') {
          snippet = actualExpr.name;
        } else {
          throw new Error('Invalid render expression - expected identifier or call expression');
        }

        return {
          type: 'RenderBlock' as const,
          expression: fullExpression,
          snippet,
          args: args.length > 0 ? args : undefined
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new CompilerError(
          `Invalid @render expression: ${expr} - ${errorMessage}`,
          undefined,
          undefined,
          'INVALID_EXPRESSION'
        );
      }
    })
);

/**
 * {@const name = value} directive parser
 */
export const constTag: IndexedParser<ConstTagASTNode> = indexed(
  P.string('{@const')
    .then(optWhitespace)
    .then(expression)
    .skip(P.string('}'))
    .map(declaration => {
      const equalsIndex = declaration.indexOf('=');
      if (equalsIndex === -1) {
        throw new CompilerError(
          `Invalid @const declaration: ${declaration}`,
          undefined,
          undefined,
          'INVALID_SYNTAX'
        );
      }

      const name = declaration.substring(0, equalsIndex).trim();
      const expressionStr = declaration.substring(equalsIndex + 1).trim();

      if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)) {
        throw new CompilerError(
          `Invalid variable name in @const: ${name}`,
          undefined,
          undefined,
          'INVALID_SYNTAX'
        );
      }

      return {
        type: 'ConstTag' as const,
        name,
        expression: parseExpression(expressionStr)
      };
    })
);

/**
 * {@html expression} directive parser
 */
export const htmlTag: IndexedParser<HtmlTagASTNode> = indexed(
  P.string('{@html')
    .then(optWhitespace)
    .then(expression)
    .skip(P.string('}'))
    .map(expr => {
      if (!expr || expr.trim().length === 0) {
        throw new CompilerError(
          'Empty @html expression',
          undefined,
          undefined,
          'INVALID_SYNTAX'
        );
      }

      return {
        type: 'HtmlTag' as const,
        expression: parseExpression(expr.trim())
      };
    })
);

/**
 * {@debug var1, var2, ...} directive parser
 */
export const debugTag: IndexedParser<DebugTagASTNode> = indexed(
  P.string('{@debug')
    .then(optWhitespace)
    .then(expression.fallback(''))
    .skip(P.string('}'))
    .map(vars => {
      const identifiers = vars.trim()
        ? vars.split(',').map(v => v.trim()).filter(Boolean)
        : [];

      return {
        type: 'DebugTag' as const,
        identifiers
      };
    })
);
