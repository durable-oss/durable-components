/**
 * DCE element parsers (dce:element, dce:window, dce:boundary, dce:head)
 */

import * as P from 'parsimmon';
import type { DceElementASTNode, TemplateASTNode } from '../../types/ast';
import { indexed, type IndexedParser, parseExpression } from './utils';
import { attribute, shorthandAttribute, spreadAttribute } from './attributes';
import { expression } from './expressions';

const optWhitespace = P.optWhitespace;

let templateNodeParser: P.Parser<TemplateASTNode>;

export function setTemplateNodeParser(parser: P.Parser<TemplateASTNode>) {
  templateNodeParser = parser;
}

/**
 * dce:element - dynamic tag name, e.g. <dce:element this={tag}>
 */
export const dceElement: IndexedParser<DceElementASTNode> = indexed(
  P.lazy(() =>
    P.seqObj<any>(
      P.string('<dce:element'),
      ['tagExprStr', optWhitespace.then(
        P.string('this={')
          .then(expression)
          .skip(P.string('}'))
          .fallback(null)
      )],
      ['attributes', optWhitespace.then(P.alt(spreadAttribute, shorthandAttribute, attribute).sepBy(optWhitespace))],
      optWhitespace,
      ['selfClosing', P.string('/').result(true).fallback(false)],
      P.string('>')
    ).chain(({ tagExprStr, attributes, selfClosing }) => {
      if (selfClosing) {
        return P.succeed({
          type: 'DceElement' as const,
          kind: 'element' as const,
          tagExpression: tagExprStr ? parseExpression(tagExprStr) : undefined,
          attributes: attributes || [],
          children: []
        });
      }
      return P.lazy(() => templateNodeParser.many())
        .skip(P.string('</dce:element>'))
        .map(children => ({
          type: 'DceElement' as const,
          kind: 'element' as const,
          tagExpression: tagExprStr ? parseExpression(tagExprStr) : undefined,
          attributes: attributes || [],
          children
        }));
    })
  )
);

/**
 * dce:window - window event handlers, e.g. <dce:window on:resize={handler} />
 */
export const dceWindow: IndexedParser<DceElementASTNode> = indexed(
  P.lazy(() =>
    P.seqObj<any>(
      P.string('<dce:window'),
      ['attributes', optWhitespace.then(P.alt(spreadAttribute, shorthandAttribute, attribute).sepBy(optWhitespace))],
      optWhitespace,
      ['selfClosing', P.string('/').result(true).fallback(false)],
      P.string('>')
    ).chain(({ attributes, selfClosing }) => {
      if (selfClosing) {
        return P.succeed({
          type: 'DceElement' as const,
          kind: 'window' as const,
          attributes: attributes || [],
          children: []
        });
      }
      return P.lazy(() => templateNodeParser.many())
        .skip(P.string('</dce:window>'))
        .map(children => ({
          type: 'DceElement' as const,
          kind: 'window' as const,
          attributes: attributes || [],
          children
        }));
    })
  )
);

/**
 * dce:boundary - error boundary, e.g. <dce:boundary on:error={handler}>
 */
export const dceBoundary: IndexedParser<DceElementASTNode> = indexed(
  P.lazy(() =>
    P.seqObj<any>(
      P.string('<dce:boundary'),
      ['attributes', optWhitespace.then(P.alt(spreadAttribute, shorthandAttribute, attribute).sepBy(optWhitespace))],
      optWhitespace,
      ['selfClosing', P.string('/').result(true).fallback(false)],
      P.string('>')
    ).chain(({ attributes, selfClosing }) => {
      if (selfClosing) {
        return P.succeed({
          type: 'DceElement' as const,
          kind: 'boundary' as const,
          attributes: attributes || [],
          children: []
        });
      }
      return P.lazy(() => templateNodeParser.many())
        .skip(P.string('</dce:boundary>'))
        .map(children => ({
          type: 'DceElement' as const,
          kind: 'boundary' as const,
          attributes: attributes || [],
          children
        }));
    })
  )
);

/**
 * dce:head - document head, e.g. <dce:head><title>...</title></dce:head>
 */
export const dceHead: IndexedParser<DceElementASTNode> = indexed(
  P.lazy(() =>
    P.seqObj<any>(
      P.string('<dce:head'),
      ['attributes', optWhitespace.then(P.alt(spreadAttribute, shorthandAttribute, attribute).sepBy(optWhitespace))],
      optWhitespace,
      ['selfClosing', P.string('/').result(true).fallback(false)],
      P.string('>')
    ).chain(({ attributes, selfClosing }) => {
      if (selfClosing) {
        return P.succeed({
          type: 'DceElement' as const,
          kind: 'head' as const,
          attributes: attributes || [],
          children: []
        });
      }
      return P.lazy(() => templateNodeParser.many())
        .skip(P.string('</dce:head>'))
        .map(children => ({
          type: 'DceElement' as const,
          kind: 'head' as const,
          attributes: attributes || [],
          children
        }));
    })
  )
);
