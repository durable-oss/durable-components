/**
 * Block directive parsers ({#if}, {#each}, {#key})
 */

import * as P from 'parsimmon';
import type {
  IfBlockASTNode,
  EachBlockASTNode,
  KeyBlockASTNode,
  TemplateASTNode,
  ElseBlock
} from '../../types/ast';
import { indexed, type IndexedParser, parseExpression } from './utils';
import { expression, identifier } from './expressions';

const optWhitespace = P.optWhitespace;

// Forward declaration for templateNode to avoid circular dependency
let templateNodeParser: P.Parser<TemplateASTNode>;

export function setTemplateNodeParser(parser: P.Parser<TemplateASTNode>) {
  templateNodeParser = parser;
}

// Simple expression parser that stops at }
const simpleExpression: P.Parser<string> = P.regexp(/[^}]+/);

// Helper to parse else-if/else chains recursively
const parseElseChain: P.Parser<ElseBlock | undefined> = P.lazy(() =>
  P.alt(
    // {:else if}
    P.string('{:else')
      .skip(optWhitespace)
      .then(P.string('if'))
      .skip(optWhitespace)
      .then(simpleExpression)
      .skip(P.string('}'))
      .chain(elseIfExpr =>
        P.lazy(() => templateNodeParser.many()).chain(elseIfChildren =>
          // Recursively parse the next else-if/else
          parseElseChain.map(nextElse => ({
            type: 'ElseBlock' as const,
            children: [{
              type: 'IfBlock' as const,
              expression: parseExpression(elseIfExpr),
              children: elseIfChildren,
              else: nextElse
            }]
          }))
        )
      ),
    // {:else}
    P.string('{:else}')
      .then(P.lazy(() => templateNodeParser.many()))
      .map(children => ({
        type: 'ElseBlock' as const,
        children
      })),
    // No else
    P.succeed(undefined)
  )
);

/**
 * {#if} block parser with support for {:else if} and {:else}
 */
export const ifBlock: IndexedParser<IfBlockASTNode> = indexed(
  P.lazy(() => {
    return P.seqObj<any>(
      P.string('{#if'),
      optWhitespace,
      ['expression', simpleExpression.skip(P.string('}'))],
      ['children', P.lazy(() => templateNodeParser.many())],
      ['else', parseElseChain],
      P.string('{/if}')
    ).map(({ expression: expr, children, else: elseBlock }) => ({
      type: 'IfBlock' as const,
      expression: parseExpression(expr.trim()),
      children,
      else: elseBlock
    }));
  })
);

/**
 * {#each} block parser with support for index and key
 */
export const eachBlock: IndexedParser<EachBlockASTNode> = indexed(
  P.lazy(() => {
    return P.seqObj<any>(
      P.string('{#each'),
      optWhitespace,
      ['expression', P.regexp(/[^}]+?(?=\s+as\s+)/)],
      optWhitespace,
      P.string('as'),
      optWhitespace,
      ['context', identifier],
      ['index', optWhitespace.then(P.string(',').then(optWhitespace).then(identifier)).fallback(undefined)],
      ['key', optWhitespace.then(
        P.string('(')
          .then(P.regexp(/[^)]+/))
          .skip(P.string(')'))
      ).fallback(undefined)],
      optWhitespace,
      P.string('}'),
      ['children', P.lazy(() => templateNodeParser.many())],
      P.string('{/each}')
    ).map(({ expression: expr, context, index, key, children }) => ({
      type: 'EachBlock' as const,
      expression: parseExpression(expr.trim()),
      context,
      index,
      key: key ? parseExpression(key.trim()) : undefined,
      children
    }));
  })
);

/**
 * {#key} block parser
 */
export const keyBlock: IndexedParser<KeyBlockASTNode> = indexed(
  P.lazy(() => {
    return P.seqObj<any>(
      P.string('{#key'),
      optWhitespace,
      ['expression', simpleExpression.skip(P.string('}'))],
      ['children', P.lazy(() => templateNodeParser.many())],
      P.string('{/key}')
    ).map(({ expression: expr, children }) => ({
      type: 'KeyBlock' as const,
      expression: parseExpression(expr.trim()),
      children
    }));
  })
);
