/**
 * Template Parser
 *
 * Parses HTML-like template syntax with Svelte-style directives
 * into a template AST using Parsimmon.
 */

import * as P from 'parsimmon';
import { parse as acornParse } from 'acorn';
import type {
  TemplateASTNode,
  ElementASTNode,
  TextASTNode,
  MustacheTagASTNode,
  IfBlockASTNode,
  EachBlockASTNode,
  KeyBlockASTNode,
  RenderBlockASTNode,
  ConstTagASTNode,
  HtmlTagASTNode,
  DebugTagASTNode,
  CommentASTNode,
  TemplateAttribute
} from '../types/ast';
import { CompilerError } from '../types/compiler';

/**
 * Parse JavaScript expression using Acorn
 */
function parseExpression(expr: string): any {
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
    const ast = acornParse(trimmedExpr, {
      ecmaVersion: 2022,
      sourceType: 'module'
    });

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
 * Read content until closing brace, handling nested braces
 */
function readUntilClosingBrace(input: string, startIdx: number): { content: string; endIdx: number } {
  let result = '';
  let depth = 0;
  let inString = false;
  let inTemplateLiteral = false;
  let stringChar = '';
  let prevChar = '';
  let idx = startIdx;

  while (idx < input.length) {
    const ch = input[idx];
    const next = input[idx + 1];

    // Handle escape sequences
    if (prevChar === '\\') {
      result += ch;
      idx++;
      prevChar = '';
      continue;
    }

    // Handle template literal expressions ${...}
    if (inTemplateLiteral && ch === '$' && next === '{') {
      result += ch + next;
      idx += 2;
      depth++;
      prevChar = '{';
      continue;
    }

    // Handle template literals
    if (ch === '`' && !inString) {
      inTemplateLiteral = !inTemplateLiteral;
      result += ch;
      idx++;
      prevChar = ch;
      continue;
    }

    // Handle strings
    if ((ch === '"' || ch === "'") && !inTemplateLiteral) {
      if (!inString) {
        inString = true;
        stringChar = ch;
      } else if (ch === stringChar) {
        inString = false;
      }
      result += ch;
      idx++;
      prevChar = ch;
      continue;
    }

    // Handle braces
    if (!inString) {
      if (ch === '{') {
        if (!inTemplateLiteral) {
          depth++;
        }
        result += ch;
        idx++;
        prevChar = ch;
        continue;
      }
      if (ch === '}') {
        if (depth === 0) {
          return { content: result, endIdx: idx };
        }
        depth--;
        result += ch;
        idx++;
        prevChar = ch;
        continue;
      }
    }

    result += ch;
    idx++;
    prevChar = ch;
  }

  throw new CompilerError(
    'Unexpected end of input in expression',
    { line: 0, column: idx },
    undefined,
    'UNEXPECTED_EOF'
  );
}

// Language definition
const language = P.createLanguage({
  // Whitespace
  _: () => P.optWhitespace,

  // Text until special character
  textContent: () =>
    P.regexp(/[^<{]+/).map((data) => ({
      type: 'Text' as const,
      data
    })),

  // HTML Comment
  comment: () =>
    P.seq(
      P.string('<!--'),
      P.regexp(/[\s\S]*?(?=-->)/),
      P.string('-->')
    ).map(([, data]) => ({
      type: 'Comment' as const,
      data
    })),

  // Mustache tag {expression}
  mustacheTag: () =>
    P.seq(
      P.string('{'),
      // Not a block directive or @ directive or closing tag or else
      P.lookahead(P.regexp(/[^#@/:]/)),
      P.custom((success, failure) => {
        return (input, idx) => {
          try {
            const { content, endIdx } = readUntilClosingBrace(input, idx);
            return success(endIdx, content);
          } catch (e) {
            return failure(idx, 'Could not read until closing brace');
          }
        };
      }),
      P.string('}')
    ).map(([, , expr]) => ({
      type: 'MustacheTag' as const,
      expression: parseExpression(expr as string)
    })),

  // Block directives
  blockDirective: (r) =>
    P.alt(
      r.ifBlock,
      r.eachBlock,
      r.keyBlock
    ),

  // {@render snippet()} directive
  renderBlock: () =>
    P.seq(
      P.string('{@render'),
      P.optWhitespace,
      P.custom((success, failure) => {
        return (input, idx) => {
          try {
            const { content, endIdx } = readUntilClosingBrace(input, idx);
            return success(endIdx, content);
          } catch (e) {
            return failure(idx, 'Could not read until closing brace');
          }
        };
      }),
      P.string('}')
    ).map(([, , expr]) => {
      const exprStr = expr as string;
      if (!exprStr || exprStr.trim().length === 0) {
        throw new CompilerError(
          'Empty @render expression',
          undefined,
          undefined,
          'INVALID_SYNTAX'
        );
      }

      let snippet = '';
      let args: any[] = [];
      let fullExpression: any;

      try {
        const parsed = parseExpression(exprStr.trim());
        fullExpression = parsed;

        let actualExpr = parsed;
        if (parsed.type === 'Program' && parsed.body && parsed.body.length > 0) {
          const firstStatement = parsed.body[0];
          if (firstStatement.type === 'ExpressionStatement') {
            actualExpr = firstStatement.expression;
          }
        }

        if (actualExpr.type === 'CallExpression') {
          if (actualExpr.callee.type === 'Identifier') {
            snippet = actualExpr.callee.name;
          }
          args = actualExpr.arguments || [];
        } else if (actualExpr.type === 'Identifier') {
          snippet = actualExpr.name;
        } else {
          throw new Error('Invalid render expression - expected identifier or call expression');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new CompilerError(
          `Invalid @render expression: ${exprStr} - ${errorMessage}`,
          undefined,
          undefined,
          'INVALID_EXPRESSION'
        );
      }

      return {
        type: 'RenderBlock' as const,
        expression: fullExpression,
        snippet,
        args: args.length > 0 ? args : undefined
      };
    }),

  // {@const name = value} directive
  constTag: () =>
    P.seq(
      P.string('{@const'),
      P.optWhitespace,
      P.custom((success, failure) => {
        return (input, idx) => {
          try {
            const { content, endIdx } = readUntilClosingBrace(input, idx);
            return success(endIdx, content);
          } catch (e) {
            return failure(idx, 'Could not read until closing brace');
          }
        };
      }),
      P.string('}')
    ).map(([, , declaration]) => {
      const declarationStr = declaration as string;
      const equalsIndex = declarationStr.indexOf('=');
      if (equalsIndex === -1) {
        throw new CompilerError(
          `Invalid @const declaration: ${declarationStr}`,
          undefined,
          undefined,
          'INVALID_SYNTAX'
        );
      }

      const name = declarationStr.substring(0, equalsIndex).trim();
      const expressionStr = declarationStr.substring(equalsIndex + 1).trim();

      if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)) {
        throw new CompilerError(
          `Invalid variable name in @const: ${name}`,
          undefined,
          undefined,
          'INVALID_SYNTAX'
        );
      }

      const expression = parseExpression(expressionStr);

      return {
        type: 'ConstTag' as const,
        name,
        expression
      };
    }),

  // {@html expression} directive
  htmlTag: () =>
    P.seq(
      P.string('{@html'),
      P.optWhitespace,
      P.custom((success, failure) => {
        return (input, idx) => {
          try {
            const { content, endIdx } = readUntilClosingBrace(input, idx);
            return success(endIdx, content);
          } catch (e) {
            return failure(idx, 'Could not read until closing brace');
          }
        };
      }),
      P.string('}')
    ).map(([, , expr]) => {
      const exprStr = expr as string;
      if (!exprStr || exprStr.trim().length === 0) {
        throw new CompilerError(
          'Empty @html expression',
          undefined,
          undefined,
          'INVALID_SYNTAX'
        );
      }

      const expression = parseExpression(exprStr.trim());

      return {
        type: 'HtmlTag' as const,
        expression
      };
    }),

  // {@debug var1, var2, ...} directive
  debugTag: () =>
    P.seq(
      P.string('{@debug'),
      P.regexp(/[^}]*/),
      P.string('}')
    ).map(([, vars]) => {
      const identifiers = vars.trim()
        ? vars.split(',').map(v => v.trim()).filter(Boolean)
        : [];

      return {
        type: 'DebugTag' as const,
        identifiers
      };
    }),

  // @ directives
  atDirective: (r) =>
    P.alt(
      r.renderBlock,
      r.constTag,
      r.htmlTag,
      r.debugTag
    ),

  // {#key expression} block
  keyBlock: (r) =>
    P.seq(
      P.string('{#key'),
      P.optWhitespace,
      P.regexp(/[^}]+/),
      P.string('}'),
      P.lazy(() => r.nodes),
      P.string('{/key}')
    ).map(([, , expr, , children]) => ({
      type: 'KeyBlock' as const,
      expression: parseExpression(expr.trim()),
      children
    })),

  // {#if} block with optional else/else-if
  ifBlock: (r) =>
    P.seq(
      P.string('{#if'),
      P.optWhitespace,
      P.regexp(/[^}]+/),
      P.string('}'),
      P.lazy(() => r.nodes),
      P.alt(
        P.seq(
          P.string('{:else if'),
          P.optWhitespace,
          P.regexp(/[^}]+/),
          P.string('}'),
          P.lazy(() => r.nodes)
        ).many().chain((elseIfs) =>
          P.alt(
            P.seq(
              P.string('{:else}'),
              P.lazy(() => r.nodes)
            ).map(([, elseChildren]) => ({ elseIfs, elseChildren })),
            P.succeed({ elseIfs, elseChildren: null })
          )
        ),
        P.succeed({ elseIfs: [], elseChildren: null })
      ),
      P.string('{/if}')
    ).map(([, , condition, , children, { elseIfs, elseChildren }]) => {
      const conditionAST = parseExpression(condition.trim());

      // Build the else chain recursively
      let elseBlock: any = undefined;

      if (elseChildren && elseChildren.length > 0) {
        elseBlock = {
          type: 'ElseBlock' as const,
          children: elseChildren
        };
      }

      // Build else-if chain from the end
      for (let i = elseIfs.length - 1; i >= 0; i--) {
        const [, , elseIfCondition, , elseIfChildren] = elseIfs[i];
        const elseIfConditionAST = parseExpression(elseIfCondition.trim());

        elseBlock = {
          type: 'ElseBlock' as const,
          children: [{
            type: 'IfBlock' as const,
            expression: elseIfConditionAST,
            children: elseIfChildren,
            else: elseBlock
          }]
        };
      }

      return {
        type: 'IfBlock' as const,
        expression: conditionAST,
        children,
        else: elseBlock
      };
    }),

  // {#each} block
  eachBlock: (r) =>
    P.seq(
      P.string('{#each'),
      P.optWhitespace,
      P.regexp(/[^}]+?(?=\s+as\s+)/),
      P.regexp(/\s+as\s+/),
      P.regexp(/[a-zA-Z_$][a-zA-Z0-9_$]*/),
      P.alt(
        P.seq(
          P.string(','),
          P.optWhitespace,
          P.regexp(/[a-zA-Z_$][a-zA-Z0-9_$]*/)
        ).map(([, , idx]) => idx),
        P.succeed(undefined)
      ),
      P.alt(
        P.seq(
          P.optWhitespace,
          P.string('('),
          P.regexp(/[^)]+/),
          P.string(')')
        ).map(([, , keyExpr]) => parseExpression(keyExpr.trim())),
        P.succeed(undefined)
      ),
      P.optWhitespace,
      P.string('}'),
      P.lazy(() => r.nodes),
      P.string('{/each}')
    ).map(([, , expr, , context, index, key, , , children]) => ({
      type: 'EachBlock' as const,
      expression: parseExpression(expr.trim()),
      context,
      index,
      key,
      children
    })),

  // Element attributes
  attribute: () =>
    P.alt(
      // Shorthand {propName}
      P.seq(
        P.string('{'),
        P.regexp(/[a-zA-Z_$][a-zA-Z0-9_$]*/),
        P.string('}')
      ).map(([, propName]) => ({
        type: 'Attribute' as const,
        name: propName,
        value: [{ type: 'MustacheTag' as const, expression: parseExpression(propName) }]
      })),

      // Dynamic attribute name with interpolation: style:border-{position}={value} or ="value"
      P.seq(
        P.regexp(/[a-zA-Z0-9_:-]+\{/),
        P.regexp(/[a-zA-Z_$][a-zA-Z0-9_$]*/),
        P.string('}'),
        P.optWhitespace,
        P.string('='),
        P.optWhitespace,
        P.alt(
          // Dynamic value {expr}
          P.seq(
            P.string('{'),
            P.custom((success, failure) => {
              return (input, idx) => {
                try {
                  const { content, endIdx } = readUntilClosingBrace(input, idx);
                  return success(endIdx, content);
                } catch (e) {
                  return failure(idx, 'Could not read until closing brace');
                }
              };
            }),
            P.string('}')
          ).map(([, expr]) => [{ type: 'MustacheTag' as const, expression: parseExpression(expr as string) }]),
          // String value "..." or '...'
          P.alt(
            P.seq(P.string('"'), P.regexp(/[^"]*/), P.string('"')),
            P.seq(P.string("'"), P.regexp(/[^']*/), P.string("'"))
          ).map(([, value]) => [{ type: 'Text' as const, data: value }])
        )
      ).map(([prefix, interpolation, , , , , value]) => {
        // Remove trailing { from prefix
        const attrPrefix = prefix.slice(0, -1);
        return {
          type: 'Attribute' as const,
          name: `${attrPrefix}{${interpolation}}`,
          value
        };
      }),

      // Event handler on:event={handler}
      P.seq(
        P.string('on:'),
        P.regexp(/[a-zA-Z0-9_-]+/),
        P.optWhitespace,
        P.string('='),
        P.optWhitespace,
        P.string('{'),
        P.custom((success, failure) => {
          return (input, idx) => {
            try {
              const { content, endIdx } = readUntilClosingBrace(input, idx);
              return success(endIdx, content);
            } catch (e) {
              return failure(idx, 'Could not read until closing brace');
            }
          };
        }),
        P.string('}')
      ).map(([, eventName, , , , , expr]) => ({
        type: 'EventHandler' as const,
        name: eventName,
        expression: parseExpression(expr)
      })),

      // Binding bind:prop={value}
      P.seq(
        P.string('bind:'),
        P.regexp(/[a-zA-Z0-9_-]+/),
        P.optWhitespace,
        P.string('='),
        P.optWhitespace,
        P.string('{'),
        P.custom((success, failure) => {
          return (input, idx) => {
            try {
              const { content, endIdx } = readUntilClosingBrace(input, idx);
              return success(endIdx, content);
            } catch (e) {
              return failure(idx, 'Could not read until closing brace');
            }
          };
        }),
        P.string('}')
      ).map(([, bindName, , , , , expr]) => ({
        type: 'Binding' as const,
        name: bindName,
        expression: parseExpression(expr)
      })),

      // Class directive class:name={condition}
      P.seq(
        P.string('class:'),
        P.regexp(/[a-zA-Z0-9_-]+/),
        P.optWhitespace,
        P.string('='),
        P.optWhitespace,
        P.string('{'),
        P.custom((success, failure) => {
          return (input, idx) => {
            try {
              const { content, endIdx } = readUntilClosingBrace(input, idx);
              return success(endIdx, content);
            } catch (e) {
              return failure(idx, 'Could not read until closing brace');
            }
          };
        }),
        P.string('}')
      ).map(([, className, , , , , expr]) => ({
        type: 'Class' as const,
        name: className,
        expression: parseExpression(expr)
      })),

      // Dynamic attribute name={value}
      P.seq(
        P.regexp(/[a-zA-Z0-9_:-]+/),
        P.optWhitespace,
        P.string('='),
        P.optWhitespace,
        P.alt(
          // Dynamic value {expr}
          P.seq(
            P.string('{'),
            P.custom((success, failure) => {
              return (input, idx) => {
                try {
                  const { content, endIdx } = readUntilClosingBrace(input, idx);
                  return success(endIdx, content);
                } catch (e) {
                  return failure(idx, 'Could not read until closing brace');
                }
              };
            }),
            P.string('}')
          ).map(([, expr]) => [{ type: 'MustacheTag' as const, expression: parseExpression(expr as string) }]),
          // String value "..." or '...'
          P.alt(
            P.seq(P.string('"'), P.regexp(/[^"]*/), P.string('"')),
            P.seq(P.string("'"), P.regexp(/[^']*/), P.string("'"))
          ).map(([, value]) => [{ type: 'Text' as const, data: value }])
        )
      ).map(([name, , , , value]) => ({
        type: 'Attribute' as const,
        name,
        value
      })),

      // Boolean attribute (no value)
      P.regexp(/[a-zA-Z0-9_:-]+/).map((name) => ({
        type: 'Attribute' as const,
        name,
        value: [{ type: 'Text' as const, data: '' }]
      }))
    ),

  // HTML element
  element: (r) =>
    P.seq(
      P.string('<'),
      P.regexp(/[a-zA-Z][a-zA-Z0-9_-]*/),
      P.seq(P.optWhitespace, r.attribute).map(([, attr]) => attr).many(),
      P.optWhitespace,
      P.alt(
        // Self-closing
        P.seq(P.string('/>'))
          .map(() => ({ selfClosing: true, children: [] })),
        // With children
        P.seq(
          P.string('>'),
          P.lazy(() => r.nodes),
          P.string('</'),
          P.regexp(/[a-zA-Z][a-zA-Z0-9_-]*/),
          P.string('>')
        ).map(([, children, , closingTag]) => ({ selfClosing: false, children, closingTag }))
      )
    ).chain(([, tagName, attributes, , { selfClosing, children, closingTag }]) => {
      if (!selfClosing && closingTag !== tagName) {
        return P.fail(`Mismatched closing tag: expected </${tagName}>, got </${closingTag}>`);
      }

      return P.succeed({
        type: 'Element' as const,
        name: tagName,
        attributes,
        children
      });
    }),

  // Single node
  node: (r) =>
    P.alt(
      r.comment,
      r.blockDirective,
      r.atDirective,
      r.mustacheTag,
      r.element,
      r.textContent
    ),

  // Multiple nodes
  nodes: (r) => r.node.many(),

  // Root parser
  template: (r) => r.nodes
});

/**
 * Parse template content into AST nodes
 */
export function parseTemplate(input: string): TemplateASTNode[] {
  if (typeof input !== 'string') {
    throw new TypeError('parseTemplate: input must be a string');
  }

  const trimmedInput = input.trim();

  try {
    const result = language.template.parse(trimmedInput);

    if (!result.status) {
      const { index, expected } = result;
      throw new CompilerError(
        `Parse error at position ${index.offset}: expected ${expected.join(', ')}`,
        { line: index.line, column: index.column },
        undefined,
        'PARSE_ERROR'
      );
    }

    return result.value;
  } catch (error) {
    if (error instanceof CompilerError) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new CompilerError(
      `Parse error: ${errorMessage}`,
      undefined,
      undefined,
      'PARSE_ERROR'
    );
  }
}
