/**
 * HTML element parser
 */

import * as P from 'parsimmon';
import type { ElementASTNode, TemplateASTNode } from '../../types/ast';
import { indexed, type IndexedParser } from './utils';
import { attribute, shorthandAttribute, spreadAttribute } from './attributes';

const optWhitespace = P.optWhitespace;

// Forward declaration for templateNode to avoid circular dependency
let templateNodeParser: P.Parser<TemplateASTNode>;

export function setTemplateNodeParser(parser: P.Parser<TemplateASTNode>) {
  templateNodeParser = parser;
}

/**
 * HTML5 void elements that don't require closing tags
 */
const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr'
]);

/**
 * HTML element parser
 * Handles both self-closing and regular elements with children
 * Special handling for <script> and <style> elements to treat their content as raw text
 * Special handling for HTML5 void elements that don't require closing tags
 */
export const element: IndexedParser<ElementASTNode> = indexed(
  P.lazy(() => {
    return P.seqObj<any>(
      P.string('<'),
      ['name', P.regexp(/[a-zA-Z][a-zA-Z0-9]*/)],
      ['attributes', optWhitespace.then(P.alt(spreadAttribute, shorthandAttribute, attribute).sepBy(optWhitespace))],
      optWhitespace,
      ['selfClosing', P.string('/').result(true).fallback(false)],
      P.string('>')
    ).chain(({ name, attributes, selfClosing }) => {
      // Self-closing syntax or void element - no children
      if (selfClosing || VOID_ELEMENTS.has(name.toLowerCase())) {
        return P.succeed({
          type: 'Element' as const,
          name,
          attributes: attributes || [],
          children: []
        });
      }

      // Special handling for <script> and <style> elements:
      // Their content should be treated as raw text, not parsed as template nodes
      if (name.toLowerCase() === 'script' || name.toLowerCase() === 'style') {
        // Match everything until the closing tag as raw text
        return P.regexp(new RegExp(`[\\s\\S]*?(?=</${name})`, 'i'))
          .skip(P.string('</'))
          .skip(P.string(name))
          .skip(P.string('>'))
          .map(rawContent => ({
            type: 'Element' as const,
            name,
            attributes: attributes || [],
            children: rawContent.trim()
              ? [{ type: 'Text' as const, data: rawContent, start: 0, end: rawContent.length }]
              : []
          }));
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
