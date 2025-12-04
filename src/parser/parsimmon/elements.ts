/**
 * HTML element parser
 */

import * as P from 'parsimmon';
import type { ElementASTNode, TemplateASTNode } from '../../types/ast';
import { indexed, type IndexedParser } from './utils';
import { attribute, shorthandAttribute } from './attributes';

const optWhitespace = P.optWhitespace;

// Forward declaration for templateNode to avoid circular dependency
let templateNodeParser: P.Parser<TemplateASTNode>;

export function setTemplateNodeParser(parser: P.Parser<TemplateASTNode>) {
  templateNodeParser = parser;
}

/**
 * HTML element parser
 * Handles both self-closing and regular elements with children
 */
export const element: IndexedParser<ElementASTNode> = indexed(
  P.lazy(() => {
    return P.seqObj<any>(
      P.string('<'),
      ['name', P.regexp(/[a-zA-Z][a-zA-Z0-9]*/)],
      ['attributes', optWhitespace.then(P.alt(shorthandAttribute, attribute).sepBy(optWhitespace))],
      optWhitespace,
      ['selfClosing', P.string('/').result(true).fallback(false)],
      P.string('>')
    ).chain(({ name, attributes, selfClosing }) => {
      if (selfClosing) {
        return P.succeed({
          type: 'Element' as const,
          name,
          attributes: attributes || [],
          children: []
        });
      }

      return templateNodeParser.many()
        .skip(P.string('</'))
        .skip(P.string(name))
        .skip(P.string('>'))
        .map(children => ({
          type: 'Element' as const,
          name,
          attributes: attributes || [],
          children
        }));
    });
  })
);
