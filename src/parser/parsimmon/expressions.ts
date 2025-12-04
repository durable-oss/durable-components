/**
 * Expression and balanced braces parsers
 */

import * as P from 'parsimmon';

/**
 * Parse characters that need to be balanced (braces, quotes, etc)
 * Handles nested braces, strings, and template literals correctly
 */
export const balancedBraces: P.Parser<string> = P.lazy(() => {
  const notSpecial = P.regexp(/[^{}'"`\\]+/);
  const escapedChar = P.string('\\').then(P.any).map(c => '\\' + c);

  // String literals (double and single quoted)
  const doubleQuoteString = P.string('"')
    .then(P.alt(escapedChar, P.regexp(/[^"\\]/)).many().map(chars => chars.join('')))
    .skip(P.string('"'))
    .map(content => `"${content}"`);

  const singleQuoteString = P.string("'")
    .then(P.alt(escapedChar, P.regexp(/[^'\\]/)).many().map(chars => chars.join('')))
    .skip(P.string("'"))
    .map(content => `'${content}'`);

  // Template literal with template expressions
  // Note: [^`\\$] matches any character except backtick, backslash, and dollar sign
  // This includes newlines by default in JavaScript regex
  const templateContent: P.Parser<string> = P.lazy(() =>
    P.alt(
      escapedChar,
      P.string('${').then(balancedBraces).skip(P.string('}')).map(content => '${' + content + '}'),
      P.regexp(/[^`\\$]+/s), // 's' flag makes . match newlines, but we use character class which already matches newlines
      P.string('$').notFollowedBy(P.string('{')).result('$')
    ).many().map(parts => parts.join(''))
  );

  const templateLiteral = P.string('`')
    .then(templateContent)
    .skip(P.string('`'))
    .map(content => '`' + content + '`');

  // Nested braces
  const nested = P.string('{')
    .then(balancedBraces)
    .skip(P.string('}'))
    .map(content => '{' + content + '}');

  return P.alt(
    doubleQuoteString,
    singleQuoteString,
    templateLiteral,
    nested,
    notSpecial,
    escapedChar
  ).many().map(parts => parts.join(''));
});

/**
 * Expression parser (content inside {})
 */
export const expression: P.Parser<string> = balancedBraces;

/**
 * Common token parsers
 */
export const identifier = P.regexp(/[a-zA-Z_$][a-zA-Z0-9_$]*/);
export const attributeName = P.regexp(/[a-zA-Z_$:][a-zA-Z0-9_$:|\-]*/);
