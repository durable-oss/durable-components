/**
 * Template Parser
 *
 * Parses HTML-like template syntax with Svelte-style directives
 * into a template AST.
 */

import { parse as acornParse } from 'acorn';
import type {
  TemplateASTNode,
  ElementASTNode,
  TextASTNode,
  MustacheTagASTNode,
  IfBlockASTNode,
  EachBlockASTNode,
  RenderBlockASTNode,
  TemplateAttribute
} from '../types/ast';
import { CompilerError } from '../types/compiler';

interface ParserState {
  input: string;
  index: number;
}

/**
 * Parse template content into AST nodes
 */
export function parseTemplate(input: string): TemplateASTNode[] {
  // Defensive: validate input
  if (typeof input !== 'string') {
    throw new TypeError('parseTemplate: input must be a string');
  }

  const trimmedInput = input.trim();
  const state: ParserState = { input: trimmedInput, index: 0 };
  const nodes: TemplateASTNode[] = [];

  // Defensive: prevent infinite loops with iteration limit
  const MAX_ITERATIONS = 100000;
  let iterationCount = 0;

  while (state.index < state.input.length) {
    // Defensive: prevent infinite loops
    if (iterationCount++ > MAX_ITERATIONS) {
      throw new CompilerError(
        'parseTemplate: maximum iteration limit exceeded - possible infinite loop',
        { line: 0, column: state.index },
        undefined,
        'PARSE_ERROR'
      );
    }

    const previousIndex = state.index;
    const node = parseNode(state);

    // Defensive: ensure we're making progress
    if (state.index === previousIndex && node === null) {
      throw new CompilerError(
        `parseTemplate: parser stuck at position ${state.index}`,
        { line: 0, column: state.index },
        undefined,
        'PARSE_ERROR'
      );
    }

    if (node) {
      // Defensive: validate node structure
      if (!node.type || typeof node.type !== 'string') {
        throw new CompilerError(
          'parseTemplate: parsed node missing valid type property',
          { line: 0, column: state.index },
          undefined,
          'INVALID_NODE'
        );
      }
      nodes.push(node);
    }
  }

  return nodes;
}

/**
 * Parse a single template node
 */
function parseNode(state: ParserState): TemplateASTNode | null {
  skipWhitespace(state);

  if (state.index >= state.input.length) return null;

  // Check for block directives {#if}, {#each}
  if (peek(state) === '{' && peek(state, 1) === '#') {
    return parseBlock(state);
  }

  // Check for @ directives {@render}, {@const}, {@html}
  if (peek(state) === '{' && peek(state, 1) === '@') {
    return parseAtDirective(state);
  }

  // Check for block closing {/if}, {/each} or else {:else}
  if (peek(state) === '{' && (peek(state, 1) === '/' || peek(state, 1) === ':')) {
    // Don't parse these - they should be handled by the parent block parser
    return null;
  }

  // Check for mustache tags {expression}
  if (peek(state) === '{') {
    return parseMustacheTag(state);
  }

  // Check for HTML element
  if (peek(state) === '<') {
    const next = peek(state, 1);
    // Not a closing tag
    if (next !== '/') {
      return parseElement(state);
    }
    // Closing tag, stop parsing at this level
    return null;
  }

  // Text node
  return parseText(state);
}

/**
 * Parse block directive ({#if}, {#each})
 */
function parseBlock(state: ParserState): TemplateASTNode {
  const start = state.index;

  // Consume {#
  consume(state, '{');
  consume(state, '#');

  const directive = readUntil(state, /[\s}]/);

  if (directive === 'if') {
    return parseIfBlock(state, start);
  } else if (directive === 'each') {
    return parseEachBlock(state, start);
  }

  throw new CompilerError(
    `Unknown block directive: ${directive}`,
    { line: 0, column: start },
    undefined,
    'UNKNOWN_DIRECTIVE'
  );
}

/**
 * Parse @ directive ({@render}, {@const}, {@html}, etc.)
 */
function parseAtDirective(state: ParserState): TemplateASTNode {
  const start = state.index;

  // Consume {@
  consume(state, '{');
  consume(state, '@');

  const directive = readUntil(state, /[\s(]/);

  if (directive === 'render') {
    return parseRenderBlock(state, start);
  }

  // For now, just consume unsupported @ directives and return a text node
  // In the future, we can add support for {@const}, {@html}, {@debug}
  const content = readUntil(state, '}');
  consume(state, '}');

  return {
    type: 'Text',
    data: `{@${directive} ${content}}`,
    start,
    end: state.index
  };
}

/**
 * Parse {@render snippet()} directive
 */
function parseRenderBlock(state: ParserState, start: number): RenderBlockASTNode {
  skipWhitespace(state);

  // Read the entire expression including the function call
  const expr = readUntil(state, '}');
  consume(state, '}');

  // Defensive: validate expression
  if (!expr || expr.trim().length === 0) {
    throw new CompilerError(
      'Empty @render expression',
      { line: 0, column: start },
      undefined,
      'INVALID_SYNTAX'
    );
  }

  // Parse the expression to extract snippet name and args
  let snippet = '';
  let args: any[] = [];
  let fullExpression: any;

  try {
    const parsed = parseExpression(expr.trim());
    fullExpression = parsed;

    // Acorn wraps expressions in a Program node
    let actualExpr = parsed;
    if (parsed.type === 'Program' && parsed.body && parsed.body.length > 0) {
      const firstStatement = parsed.body[0];
      if (firstStatement.type === 'ExpressionStatement') {
        actualExpr = firstStatement.expression;
      }
    }

    // Extract snippet name and args from the call expression
    if (actualExpr.type === 'CallExpression') {
      if (actualExpr.callee.type === 'Identifier') {
        snippet = actualExpr.callee.name;
      }
      args = actualExpr.arguments || [];
    } else if (actualExpr.type === 'Identifier') {
      // Simple case: {@render children}
      snippet = actualExpr.name;
    } else {
      throw new Error('Invalid render expression - expected identifier or call expression');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new CompilerError(
      `Invalid @render expression: ${expr} - ${errorMessage}`,
      { line: 0, column: start },
      undefined,
      'INVALID_EXPRESSION'
    );
  }

  return {
    type: 'RenderBlock',
    expression: fullExpression,
    snippet,
    args: args.length > 0 ? args : undefined,
    start,
    end: state.index
  };
}

/**
 * Parse {#if} block
 */
function parseIfBlock(state: ParserState, start: number): IfBlockASTNode {
  skipWhitespace(state);

  // Parse condition expression
  const condition = readUntil(state, '}');
  consume(state, '}');

  // Parse AST for condition
  const conditionAST = parseExpression(condition);

  // Parse children until {:else} or {/if}
  const children: TemplateASTNode[] = [];

  while (state.index < state.input.length) {
    // Check for {:else} or {/if}
    if (peek(state) === '{') {
      const checkpoint = state.index;
      consume(state, '{');

      if (peek(state) === ':') {
        consume(state, ':');
        const directive = readUntil(state, /[}\s]/);
        if (directive === 'else') {
          consume(state, '}');
          // Parse else children
          const elseChildren: TemplateASTNode[] = [];
          while (state.index < state.input.length) {
            if (peek(state) === '{' && peek(state, 1) === '/') {
              break;
            }
            const node = parseNode(state);
            if (node) elseChildren.push(node);
          }

          // Consume {/if}
          consume(state, '{');
          consume(state, '/');
          expect(state, 'if');
          consume(state, '}');

          return {
            type: 'IfBlock',
            expression: conditionAST,
            children,
            else: {
              type: 'ElseBlock',
              children: elseChildren,
              start: checkpoint,
              end: state.index
            },
            start,
            end: state.index
          };
        }
      }

      if (peek(state) === '/') {
        consume(state, '/');
        expect(state, 'if');
        consume(state, '}');
        break;
      }

      // Not a closing tag, rewind and parse as normal node
      state.index = checkpoint;
    }

    const node = parseNode(state);
    if (node) children.push(node);
  }

  return {
    type: 'IfBlock',
    expression: conditionAST,
    children,
    start,
    end: state.index
  };
}

/**
 * Parse {#each} block
 */
function parseEachBlock(state: ParserState, start: number): EachBlockASTNode {
  skipWhitespace(state);

  // Parse: expression as item
  // Read until we find ' as '
  let expr = '';
  while (state.index < state.input.length) {
    const remaining = state.input.slice(state.index);
    if (remaining.match(/^\s+as\s+/)) {
      break;
    }
    expr += peek(state);
    state.index++;
  }

  const expression = parseExpression(expr.trim());

  // Skip ' as '
  skipWhitespace(state);
  expect(state, 'as');
  skipWhitespace(state);

  // Parse iterator variable
  const context = readUntil(state, /[},\s]/);
  let index: string | undefined;

  // Check for index (", index")
  skipWhitespace(state);
  if (peek(state) === ',') {
    consume(state, ',');
    skipWhitespace(state);
    index = readUntil(state, /[}\s]/);
  }

  skipWhitespace(state);
  consume(state, '}');

  // Parse children
  const children: TemplateASTNode[] = [];
  while (state.index < state.input.length) {
    if (peek(state) === '{' && peek(state, 1) === '/') {
      consume(state, '{');
      consume(state, '/');
      expect(state, 'each');
      consume(state, '}');
      break;
    }

    const node = parseNode(state);
    if (node) children.push(node);
  }

  return {
    type: 'EachBlock',
    expression,
    context,
    index,
    children,
    start,
    end: state.index
  };
}

/**
 * Parse mustache tag {expression}
 */
function parseMustacheTag(state: ParserState): MustacheTagASTNode {
  const start = state.index;
  consume(state, '{');

  const expr = readUntil(state, '}');
  consume(state, '}');

  return {
    type: 'MustacheTag',
    expression: parseExpression(expr),
    start,
    end: state.index
  };
}

/**
 * Parse HTML element
 */
function parseElement(state: ParserState): ElementASTNode {
  const start = state.index;

  consume(state, '<');
  const tagName = readUntil(state, /[\s/>]/);

  const attributes: TemplateAttribute[] = [];

  // Parse attributes
  while (state.index < state.input.length) {
    skipWhitespace(state);

    if (peek(state) === '/' || peek(state) === '>') break;

    const attr = parseAttribute(state);
    if (attr) attributes.push(attr);
  }

  // Check for self-closing
  const selfClosing = peek(state) === '/';
  if (selfClosing) {
    consume(state, '/');
  }
  consume(state, '>');

  // Parse children (if not self-closing)
  const children: TemplateASTNode[] = [];
  if (!selfClosing) {
    while (state.index < state.input.length) {
      // Check for closing tag
      if (peek(state) === '<' && peek(state, 1) === '/') {
        consume(state, '<');
        consume(state, '/');
        const closingTag = readUntil(state, '>');
        consume(state, '>');

        if (closingTag.trim() !== tagName) {
          throw new CompilerError(
            `Mismatched closing tag: expected </${tagName}>, got </${closingTag}>`,
            { line: 0, column: state.index },
            undefined,
            'MISMATCHED_TAG'
          );
        }
        break;
      }

      const node = parseNode(state);
      if (node) children.push(node);
    }
  }

  return {
    type: 'Element',
    name: tagName,
    attributes,
    children,
    start,
    end: state.index
  };
}

/**
 * Parse element attribute
 */
function parseAttribute(state: ParserState): TemplateAttribute | null {
  const start = state.index;
  const name = readUntil(state, /[=\s/>]/);

  if (!name) return null;

  // Check for event handler (on:)
  if (name.startsWith('on:')) {
    const eventName = name.slice(3);
    skipWhitespace(state);
    consume(state, '=');
    skipWhitespace(state);
    consume(state, '{');
    const expr = readUntil(state, '}');
    consume(state, '}');

    return {
      type: 'EventHandler',
      name: eventName,
      expression: parseExpression(expr),
      start,
      end: state.index
    };
  }

  // Check for binding (bind:)
  if (name.startsWith('bind:')) {
    const bindName = name.slice(5);
    skipWhitespace(state);
    consume(state, '=');
    skipWhitespace(state);
    consume(state, '{');
    const expr = readUntil(state, '}');
    consume(state, '}');

    return {
      type: 'Binding',
      name: bindName,
      expression: parseExpression(expr),
      start,
      end: state.index
    };
  }

  // Check for class directive (class:)
  if (name.startsWith('class:')) {
    const className = name.slice(6);
    skipWhitespace(state);
    consume(state, '=');
    skipWhitespace(state);
    consume(state, '{');
    const expr = readUntil(state, '}');
    consume(state, '}');

    return {
      type: 'Class',
      name: className,
      expression: parseExpression(expr),
      start,
      end: state.index
    };
  }

  skipWhitespace(state);

  // No value (boolean attribute)
  if (peek(state) !== '=') {
    return {
      type: 'Attribute',
      name,
      value: [{ type: 'Text', data: '' }],
      start,
      end: state.index
    };
  }

  consume(state, '=');
  skipWhitespace(state);

  // Dynamic value {expr}
  if (peek(state) === '{') {
    consume(state, '{');
    const expr = readUntil(state, '}');
    consume(state, '}');

    return {
      type: 'Attribute',
      name,
      value: [{ type: 'MustacheTag', expression: parseExpression(expr) }],
      start,
      end: state.index
    };
  }

  // Static value "..." or '...'
  const quote = peek(state);
  if (quote === '"' || quote === "'") {
    consume(state, quote);
    const value = readUntil(state, quote);
    consume(state, quote);

    return {
      type: 'Attribute',
      name,
      value: [{ type: 'Text', data: value }],
      start,
      end: state.index
    };
  }

  throw new CompilerError(
    `Expected attribute value`,
    { line: 0, column: state.index },
    undefined,
    'EXPECTED_VALUE'
  );
}

/**
 * Parse text node
 */
function parseText(state: ParserState): TextASTNode {
  const start = state.index;
  let text = '';

  while (state.index < state.input.length) {
    const char = peek(state);

    // Stop at special characters
    if (char === '<' || char === '{') break;

    text += char;
    state.index++;
  }

  return {
    type: 'Text',
    data: text,
    start,
    end: state.index
  };
}

/**
 * Parse JavaScript expression
 */
function parseExpression(expr: string): any {
  // Defensive: validate input
  if (typeof expr !== 'string') {
    throw new TypeError('parseExpression: expr must be a string');
  }

  const trimmedExpr = expr.trim();

  // Defensive: check for empty expression
  if (trimmedExpr.length === 0) {
    throw new CompilerError(
      'parseExpression: expression cannot be empty',
      undefined,
      undefined,
      'INVALID_EXPRESSION'
    );
  }

  // Defensive: check expression length to prevent DoS
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

    // Defensive: validate parsed result
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
 * Peek at character at offset
 */
function peek(state: ParserState, offset: number = 0): string {
  // Defensive: validate state
  if (!state || typeof state !== 'object') {
    throw new TypeError('peek: state must be an object');
  }
  if (typeof state.input !== 'string') {
    throw new TypeError('peek: state.input must be a string');
  }
  if (typeof state.index !== 'number') {
    throw new TypeError('peek: state.index must be a number');
  }
  if (typeof offset !== 'number') {
    throw new TypeError('peek: offset must be a number');
  }

  // Defensive: validate index bounds
  if (state.index < 0 || state.index > state.input.length) {
    throw new Error(`peek: state.index ${state.index} out of bounds for input length ${state.input.length}`);
  }

  const targetIndex = state.index + offset;

  // Defensive: validate target index
  if (targetIndex < 0 || targetIndex > state.input.length) {
    return '';
  }

  return state.input[targetIndex] || '';
}

/**
 * Consume expected character
 */
function consume(state: ParserState, char: string): void {
  // Defensive: validate inputs
  if (!state || typeof state !== 'object') {
    throw new TypeError('consume: state must be an object');
  }
  if (typeof char !== 'string') {
    throw new TypeError('consume: char must be a string');
  }
  if (char.length !== 1) {
    throw new Error('consume: char must be exactly one character');
  }

  const current = peek(state);

  if (current !== char) {
    throw new CompilerError(
      `Expected '${char}', got '${current}' at position ${state.index}`,
      { line: 0, column: state.index },
      undefined,
      'UNEXPECTED_CHAR'
    );
  }

  state.index++;

  // Defensive: ensure index doesn't exceed bounds
  if (state.index > state.input.length) {
    throw new CompilerError(
      `consume: index ${state.index} exceeds input length ${state.input.length}`,
      { line: 0, column: state.index },
      undefined,
      'PARSE_ERROR'
    );
  }
}

/**
 * Expect string at current position
 */
function expect(state: ParserState, str: string): void {
  // Defensive: validate inputs
  if (!state || typeof state !== 'object') {
    throw new TypeError('expect: state must be an object');
  }
  if (typeof str !== 'string') {
    throw new TypeError('expect: str must be a string');
  }
  if (str.length === 0) {
    throw new Error('expect: str cannot be empty');
  }

  const startIndex = state.index;

  try {
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      consume(state, char);
    }
  } catch (error) {
    // Defensive: provide better error context
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new CompilerError(
      `expect: failed to match expected string "${str}" at position ${startIndex}: ${errorMessage}`,
      { line: 0, column: startIndex },
      undefined,
      'UNEXPECTED_CHAR'
    );
  }
}

/**
 * Read until pattern matches
 */
function readUntil(state: ParserState, pattern: string | RegExp): string {
  // Defensive: validate inputs
  if (!state || typeof state !== 'object') {
    throw new TypeError('readUntil: state must be an object');
  }
  if (typeof pattern !== 'string' && !(pattern instanceof RegExp)) {
    throw new TypeError('readUntil: pattern must be a string or RegExp');
  }

  let result = '';
  const MAX_ITERATIONS = 100000;
  let iterationCount = 0;

  while (state.index < state.input.length) {
    // Defensive: prevent infinite loops
    if (iterationCount++ > MAX_ITERATIONS) {
      throw new CompilerError(
        'readUntil: maximum iteration limit exceeded',
        { line: 0, column: state.index },
        undefined,
        'PARSE_ERROR'
      );
    }

    const remaining = state.input.slice(state.index);

    if (typeof pattern === 'string') {
      if (pattern.length === 0) {
        throw new Error('readUntil: pattern string cannot be empty');
      }
      if (remaining.startsWith(pattern)) break;
    } else {
      if (pattern.test(peek(state))) break;
    }

    result += peek(state);
    state.index++;

    // Defensive: validate index
    if (state.index > state.input.length) {
      throw new CompilerError(
        'readUntil: index exceeded input length',
        { line: 0, column: state.index },
        undefined,
        'PARSE_ERROR'
      );
    }
  }

  return result;
}

/**
 * Skip whitespace
 */
function skipWhitespace(state: ParserState): void {
  // Defensive: validate state
  if (!state || typeof state !== 'object') {
    throw new TypeError('skipWhitespace: state must be an object');
  }
  if (typeof state.input !== 'string') {
    throw new TypeError('skipWhitespace: state.input must be a string');
  }
  if (typeof state.index !== 'number') {
    throw new TypeError('skipWhitespace: state.index must be a number');
  }

  const MAX_ITERATIONS = 100000;
  let iterationCount = 0;

  while (state.index < state.input.length && /\s/.test(peek(state))) {
    // Defensive: prevent infinite loops
    if (iterationCount++ > MAX_ITERATIONS) {
      throw new CompilerError(
        'skipWhitespace: maximum iteration limit exceeded',
        { line: 0, column: state.index },
        undefined,
        'PARSE_ERROR'
      );
    }

    state.index++;

    // Defensive: validate index
    if (state.index > state.input.length) {
      throw new CompilerError(
        'skipWhitespace: index exceeded input length',
        { line: 0, column: state.index },
        undefined,
        'PARSE_ERROR'
      );
    }
  }
}
