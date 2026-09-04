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

/**
 * Build a parser for a `dce:*` tag that carries only attributes.
 *
 * Every such tag has the same shape — `<dce:name ...attrs />` or a matching
 * open/close pair — so the four behavior primitives share one factory rather
 * than four near-identical copies.
 */
function dceAttributeTag(
  name: string,
  kind: DceElementASTNode['kind']
): IndexedParser<DceElementASTNode> {
  return indexed(
    P.lazy(() =>
      P.seqObj<any>(
        P.string(`<dce:${name}`),
        ['attributes', optWhitespace.then(P.alt(spreadAttribute, shorthandAttribute, attribute).sepBy(optWhitespace))],
        optWhitespace,
        ['selfClosing', P.string('/').result(true).fallback(false)],
        P.string('>')
      ).chain(({ attributes, selfClosing }) => {
        if (selfClosing) {
          return P.succeed({
            type: 'DceElement' as const,
            kind,
            attributes: attributes || [],
            children: []
          });
        }
        return P.lazy(() => templateNodeParser.many())
          .skip(P.string(`</dce:${name}>`))
          .map(children => ({
            type: 'DceElement' as const,
            kind,
            attributes: attributes || [],
            children
          }));
      })
    )
  );
}

/**
 * The behavior primitives. Each compiles to a mount/unmount effect rather than
 * to markup, so they render nothing themselves.
 */
export const dceFocusTrap = dceAttributeTag('focus-trap', 'focus-trap');
export const dceEscape = dceAttributeTag('escape', 'escape');
export const dceScrollLock = dceAttributeTag('scroll-lock', 'scroll-lock');
export const dceTimer = dceAttributeTag('timer', 'timer');
