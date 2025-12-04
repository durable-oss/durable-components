/**
 * Attribute parsers for HTML elements
 */

import * as P from 'parsimmon';
import type { TemplateAttribute, TextASTNode, MustacheTagASTNode } from '../../types/ast';
import { indexed, type IndexedParser, parseExpression } from './utils';
import { expression, identifier, attributeName } from './expressions';

const optWhitespace = P.optWhitespace;

/**
 * Parse dynamic attribute name (e.g., style:border-{position} or style:border-{side}-color)
 * Returns the full name with the dynamic expression preserved
 */
const dynamicAttributeName: P.Parser<string> = P.lazy(() => {
  // Parse segments that can be:
  // - Static parts: [a-zA-Z0-9_$:|-]+
  // - Dynamic parts: {expression}
  const dynamicSegment = P.string('{')
    .then(expression)
    .skip(P.string('}'))
    .map(expr => `{${expr}}`);

  // First static segment must start with letter, $, _, or :
  const firstStaticSegment = P.regexp(/[a-zA-Z_$:][-a-zA-Z0-9_$:|]*/);

  // Subsequent static segments can start with - as well (e.g., -color in border-{side}-color)
  const followingStaticSegment = P.regexp(/[-a-zA-Z0-9_$:|]+/);

  // Attribute name starts with static part, then alternates between static and dynamic
  return P.seq(
    firstStaticSegment,
    P.seq(
      dynamicSegment,
      followingStaticSegment.fallback('')
    ).many()
  ).map(([first, rest]) => {
    let result = first;
    for (const [dynamic, static_] of rest) {
      result += dynamic + static_;
    }
    return result;
  });
});

/**
 * Parse attribute value (static string or dynamic expression)
 */
const attributeValue: P.Parser<Array<TextASTNode | MustacheTagASTNode>> = P.alt(
  // Dynamic value: {expr}
  P.string('{')
    .then(expression)
    .skip(P.string('}'))
    .map(expr => [{ type: 'MustacheTag' as const, expression: parseExpression(expr) }]),

  // Quoted string value
  P.alt(
    P.string('"').then(P.regexp(/[^"]*/)).skip(P.string('"')),
    P.string("'").then(P.regexp(/[^']*/)).skip(P.string("'"))
  ).map(data => [{ type: 'Text' as const, data }])
);

/**
 * Regular attribute parser
 */
export const attribute: IndexedParser<TemplateAttribute> = P.seqObj<any>(
  ['start', P.index],
  ['name', dynamicAttributeName],
  optWhitespace,
  ['hasValue', P.string('=').result(true).fallback(false)],
  ['value', P.alt(
    optWhitespace.then(attributeValue),
    P.succeed([{ type: 'Text' as const, data: '' }])
  )],
  ['end', P.index]
).chain(({ start, end, name, hasValue, value }): P.Parser<TemplateAttribute & { start: number; end: number }> => {
  if (!hasValue) {
    return P.succeed({
      type: 'Attribute' as const,
      name,
      value: [{ type: 'Text' as const, data: '' }],
      start,
      end
    });
  }

  // If hasValue is true, we must have a valid value (not empty from fallback)
  if (value.length === 1 && value[0].type === 'Text' && value[0].data === '') {
    // Check if this was from the fallback - this means we had = but no value
    return P.fail('Expected attribute value after "="');
  }

  // Parse event handlers (on:event|modifier={handler})
  if (name.startsWith('on:')) {
    const fullName = name.slice(3); // e.g., "click|preventDefault|stopPropagation"
    const parts = fullName.split('|');
    const eventName = parts[0];
    const modifiers = parts.length > 1 ? parts.slice(1) : undefined;

    const expr = value[0].type === 'MustacheTag' ? value[0].expression : null;
    if (!expr) {
      return P.fail('Event handler requires expression');
    }
    return P.succeed({
      type: 'EventHandler' as const,
      name: eventName,
      expression: expr,
      modifiers,
      start,
      end
    });
  }

  // Parse bindings (bind:prop={value})
  if (name.startsWith('bind:')) {
    const bindName = name.slice(5);
    const expr = value[0].type === 'MustacheTag' ? value[0].expression : null;
    if (!expr) {
      return P.fail('Binding requires expression');
    }
    return P.succeed({
      type: 'Binding' as const,
      name: bindName,
      expression: expr,
      start,
      end
    });
  }

  // Parse class directives (class:name={condition})
  if (name.startsWith('class:')) {
    const className = name.slice(6);
    const expr = value[0].type === 'MustacheTag' ? value[0].expression : null;
    if (!expr) {
      return P.fail('Class directive requires expression');
    }
    return P.succeed({
      type: 'Class' as const,
      name: className,
      expression: expr,
      start,
      end
    });
  }

  // Parse style directives (style:property={value} or style:border-{side}={value})
  if (name.startsWith('style:')) {
    const styleName = name.slice(6);
    const styleValue = value[0].type === 'MustacheTag' ? value[0].expression : value[0].data;
    return P.succeed({
      type: 'StyleDirective' as const,
      name: styleName,
      value: styleValue,
      start,
      end
    });
  }

  return P.succeed({
    type: 'Attribute' as const,
    name,
    value,
    start,
    end
  });
});

/**
 * Shorthand attribute syntax: {propName}
 */
export const shorthandAttribute: IndexedParser<TemplateAttribute> = indexed(
  P.string('{')
    .then(identifier)
    .skip(P.string('}'))
    .map(propName => ({
      type: 'Attribute' as const,
      name: propName,
      value: [{ type: 'MustacheTag' as const, expression: parseExpression(propName) }]
    }))
);

/**
 * Spread attribute syntax: {...props}
 */
export const spreadAttribute: IndexedParser<TemplateAttribute> = indexed(
  P.string('{')
    .then(P.string('...'))
    .then(expression)
    .skip(P.string('}'))
    .map(expr => ({
      type: 'Spread' as const,
      expression: parseExpression(expr)
    }))
);
