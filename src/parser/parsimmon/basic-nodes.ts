/**
 * Basic template node parsers (text, mustache tags, comments)
 */

import * as P from 'parsimmon';
import type { TextASTNode, MustacheTagASTNode, CommentASTNode } from '../../types/ast';
import { indexed, type IndexedParser, parseExpression } from './utils';
import { expression } from './expressions';

/**
 * TML comment parser: <!-- comment -->
 * Handles multiline comments
 */
export const commentNode: IndexedParser<CommentASTNode> = indexed(
  P.string('<!--')
    .then(P.regexp(/[\s\S]*?(?=-->)/)) // Match any characters (including newlines) until -->
    .skip(P.string('-->'))
    .map(data => ({
      type: 'Comment' as const,
      data
    }))
);

/**
 * Text node parser - matches any text that's not < or {
 */
export const textNode: IndexedParser<TextASTNode> = indexed(
  P.regexp(/[^<{]+/).map(data => ({
    type: 'Text' as const,
    data
  }))
);

/**
 * Mustache tag parser: {expression}
 * Does not match block directives like {#if}, {/if}, {:else}, or @ directives like {@render}
 */
export const mustacheTag: IndexedParser<MustacheTagASTNode> = indexed(
  P.string('{')
    .notFollowedBy(P.regexp(/[#/:@]/))
    .then(expression)
    .skip(P.string('}'))
    .map(expr => ({
      type: 'MustacheTag' as const,
      expression: parseExpression(expr)
    }))
);
