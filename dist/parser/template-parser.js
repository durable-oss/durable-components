"use strict";
/**
 * Template Parser
 *
 * Parses HTML-like template syntax with Svelte-style directives
 * into a template AST.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseTemplate = parseTemplate;
const acorn_1 = require("acorn");
const compiler_1 = require("../types/compiler");
/**
 * Parse template content into AST nodes
 */
function parseTemplate(input) {
    // Defensive: validate input
    if (typeof input !== 'string') {
        throw new TypeError('parseTemplate: input must be a string');
    }
    const trimmedInput = input.trim();
    const state = { input: trimmedInput, index: 0 };
    const nodes = [];
    // Defensive: prevent infinite loops with iteration limit
    const MAX_ITERATIONS = 100000;
    let iterationCount = 0;
    while (state.index < state.input.length) {
        // Defensive: prevent infinite loops
        if (iterationCount++ > MAX_ITERATIONS) {
            throw new compiler_1.CompilerError('parseTemplate: maximum iteration limit exceeded - possible infinite loop', { line: 0, column: state.index }, undefined, 'PARSE_ERROR');
        }
        const previousIndex = state.index;
        const node = parseNode(state);
        // Defensive: ensure we're making progress
        if (state.index === previousIndex && node === null) {
            throw new compiler_1.CompilerError(`parseTemplate: parser stuck at position ${state.index}`, { line: 0, column: state.index }, undefined, 'PARSE_ERROR');
        }
        if (node) {
            // Defensive: validate node structure
            if (!node.type || typeof node.type !== 'string') {
                throw new compiler_1.CompilerError('parseTemplate: parsed node missing valid type property', { line: 0, column: state.index }, undefined, 'INVALID_NODE');
            }
            nodes.push(node);
        }
    }
    return nodes;
}
/**
 * Parse a single template node
 */
function parseNode(state) {
    skipWhitespace(state);
    if (state.index >= state.input.length)
        return null;
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
function parseBlock(state) {
    const start = state.index;
    // Consume {#
    consume(state, '{');
    consume(state, '#');
    const directive = readUntil(state, /[\s}]/);
    if (directive === 'if') {
        return parseIfBlock(state, start);
    }
    else if (directive === 'each') {
        return parseEachBlock(state, start);
    }
    else if (directive === 'key') {
        return parseKeyBlock(state, start);
    }
    throw new compiler_1.CompilerError(`Unknown block directive: ${directive}`, { line: 0, column: start }, undefined, 'UNKNOWN_DIRECTIVE');
}
/**
 * Parse @ directive ({@render}, {@const}, {@html}, etc.)
 */
function parseAtDirective(state) {
    const start = state.index;
    // Consume {@
    consume(state, '{');
    consume(state, '@');
    const directive = readUntil(state, /[\s}]/);
    if (directive === 'render') {
        skipWhitespace(state);
        return parseRenderBlock(state, start);
    }
    else if (directive === 'const') {
        skipWhitespace(state);
        return parseConstTag(state, start);
    }
    else if (directive === 'html') {
        skipWhitespace(state);
        return parseHtmlTag(state, start);
    }
    else if (directive === 'debug') {
        skipWhitespace(state);
        return parseDebugTag(state, start);
    }
    // Unsupported @ directive - consume and return as text
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
function parseRenderBlock(state, start) {
    skipWhitespace(state);
    // Read the entire expression including the function call
    const expr = readUntil(state, '}');
    consume(state, '}');
    // Defensive: validate expression
    if (!expr || expr.trim().length === 0) {
        throw new compiler_1.CompilerError('Empty @render expression', { line: 0, column: start }, undefined, 'INVALID_SYNTAX');
    }
    // Parse the expression to extract snippet name and args
    let snippet = '';
    let args = [];
    let fullExpression;
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
        }
        else if (actualExpr.type === 'Identifier') {
            // Simple case: {@render children}
            snippet = actualExpr.name;
        }
        else {
            throw new Error('Invalid render expression - expected identifier or call expression');
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new compiler_1.CompilerError(`Invalid @render expression: ${expr} - ${errorMessage}`, { line: 0, column: start }, undefined, 'INVALID_EXPRESSION');
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
 * Read until closing brace, handling nested braces in template literals and objects
 */
function readUntilClosingBrace(state) {
    let result = '';
    let depth = 0;
    let inString = false;
    let inTemplateLiteral = false;
    let stringChar = '';
    let prevChar = '';
    while (state.index < state.input.length) {
        const ch = peek(state);
        const next = peek(state, 1);
        // Handle escape sequences
        if (prevChar === '\\') {
            result += ch;
            state.index++;
            prevChar = '';
            continue;
        }
        // Handle template literal expressions ${...}
        if (inTemplateLiteral && ch === '$' && next === '{') {
            result += ch;
            state.index++;
            result += peek(state);
            state.index++;
            depth++;
            prevChar = '{';
            continue;
        }
        // Handle template literals
        if (ch === '`' && !inString) {
            inTemplateLiteral = !inTemplateLiteral;
            result += ch;
            state.index++;
            prevChar = ch;
            continue;
        }
        // Handle strings
        if ((ch === '"' || ch === "'") && !inTemplateLiteral) {
            if (!inString) {
                inString = true;
                stringChar = ch;
            }
            else if (ch === stringChar) {
                inString = false;
            }
            result += ch;
            state.index++;
            prevChar = ch;
            continue;
        }
        // Handle braces
        if (!inString) {
            if (ch === '{') {
                // Only increment depth if not inside a template literal (unless it's a ${} expression)
                if (!inTemplateLiteral) {
                    depth++;
                }
                result += ch;
                state.index++;
                prevChar = ch;
                continue;
            }
            if (ch === '}') {
                if (depth === 0) {
                    // Found the closing brace
                    return result;
                }
                depth--;
                result += ch;
                state.index++;
                prevChar = ch;
                continue;
            }
        }
        result += ch;
        state.index++;
        prevChar = ch;
    }
    throw new compiler_1.CompilerError('Unexpected end of input in @const declaration', { line: 0, column: state.index }, undefined, 'UNEXPECTED_EOF');
}
/**
 * Parse {@const name = value} directive
 */
function parseConstTag(state, start) {
    // Read the entire declaration: name = value
    const declaration = readUntilClosingBrace(state);
    consume(state, '}');
    // Parse the declaration to extract name and value
    // Format: name = expression
    // Use indexOf to find first = to handle complex expressions like template literals
    const equalsIndex = declaration.indexOf('=');
    if (equalsIndex === -1) {
        throw new compiler_1.CompilerError(`Invalid @const declaration: ${declaration}`, { line: 0, column: start }, undefined, 'INVALID_SYNTAX');
    }
    const name = declaration.substring(0, equalsIndex).trim();
    const expressionStr = declaration.substring(equalsIndex + 1).trim();
    // Validate name is a valid identifier
    if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)) {
        throw new compiler_1.CompilerError(`Invalid variable name in @const: ${name}`, { line: 0, column: start }, undefined, 'INVALID_SYNTAX');
    }
    const expression = parseExpression(expressionStr);
    return {
        type: 'ConstTag',
        name,
        expression,
        start,
        end: state.index
    };
}
/**
 * Parse {@html expression} directive
 */
function parseHtmlTag(state, start) {
    // Read the expression
    const expr = readUntil(state, '}');
    consume(state, '}');
    if (!expr || expr.trim().length === 0) {
        throw new compiler_1.CompilerError('Empty @html expression', { line: 0, column: start }, undefined, 'INVALID_SYNTAX');
    }
    const expression = parseExpression(expr.trim());
    return {
        type: 'HtmlTag',
        expression,
        start,
        end: state.index
    };
}
/**
 * Parse {@debug var1, var2, ...} directive
 */
function parseDebugTag(state, start) {
    // Read the variable list (or empty for all)
    const vars = readUntil(state, '}');
    consume(state, '}');
    const identifiers = vars.trim()
        ? vars.split(',').map(v => v.trim()).filter(Boolean)
        : [];
    return {
        type: 'DebugTag',
        identifiers,
        start,
        end: state.index
    };
}
/**
 * Parse {#key expression} block
 */
function parseKeyBlock(state, start) {
    skipWhitespace(state);
    // Parse key expression
    const expr = readUntil(state, '}');
    consume(state, '}');
    const expression = parseExpression(expr.trim());
    // Parse children until {/key}
    const children = [];
    while (state.index < state.input.length) {
        if (peek(state) === '{' && peek(state, 1) === '/') {
            const checkpoint = state.index;
            consume(state, '{');
            consume(state, '/');
            const closing = readUntil(state, '}');
            if (closing === 'key') {
                consume(state, '}');
                break;
            }
            // Not our closing tag, rewind
            state.index = checkpoint;
        }
        const node = parseNode(state);
        if (node)
            children.push(node);
    }
    return {
        type: 'KeyBlock',
        expression,
        children,
        start,
        end: state.index
    };
}
/**
 * Parse else/else-if chain (helper for parseIfBlock)
 */
function parseElseChain(state) {
    const checkpoint = state.index;
    consume(state, '{');
    consume(state, ':');
    const directive = readUntil(state, /[}\s]/);
    if (directive !== 'else') {
        state.index = checkpoint;
        return undefined;
    }
    skipWhitespace(state);
    // Check if this is {:else if} instead of just {:else}
    if (peek(state) === 'i' && peek(state, 1) === 'f' && /\s/.test(peek(state, 2))) {
        // This is {:else if condition}
        consume(state, 'i');
        consume(state, 'f');
        skipWhitespace(state);
        // Parse the else-if condition
        const elseIfCondition = readUntil(state, '}');
        consume(state, '}');
        const elseIfConditionAST = parseExpression(elseIfCondition);
        // Parse else-if children
        const elseIfChildren = [];
        let nestedElse = undefined;
        while (state.index < state.input.length) {
            if (peek(state) === '{') {
                const innerCheckpoint = state.index;
                if (peek(state, 1) === ':') {
                    // This might be another {:else if} or {:else}
                    nestedElse = parseElseChain(state);
                    break;
                }
                else if (peek(state, 1) === '/') {
                    // End of if block
                    state.index = innerCheckpoint;
                    break;
                }
            }
            const node = parseNode(state);
            if (node)
                elseIfChildren.push(node);
        }
        return {
            type: 'ElseBlock',
            children: [{
                    type: 'IfBlock',
                    expression: elseIfConditionAST,
                    children: elseIfChildren,
                    else: nestedElse,
                    start: checkpoint,
                    end: state.index
                }],
            start: checkpoint,
            end: state.index
        };
    }
    else {
        // Just {:else} without if
        consume(state, '}');
        // Parse else children
        const elseChildren = [];
        while (state.index < state.input.length) {
            if (peek(state) === '{' && peek(state, 1) === '/') {
                break;
            }
            const node = parseNode(state);
            if (node)
                elseChildren.push(node);
        }
        return {
            type: 'ElseBlock',
            children: elseChildren,
            start: checkpoint,
            end: state.index
        };
    }
}
/**
 * Parse {#if} block
 */
function parseIfBlock(state, start) {
    skipWhitespace(state);
    // Parse condition expression
    const condition = readUntil(state, '}');
    consume(state, '}');
    // Parse AST for condition
    const conditionAST = parseExpression(condition);
    // Parse children until {:else} or {/if}
    const children = [];
    while (state.index < state.input.length) {
        // Check for {:else} or {/if}
        if (peek(state) === '{') {
            const checkpoint = state.index;
            consume(state, '{');
            if (peek(state) === ':') {
                consume(state, ':');
                const directive = readUntil(state, /[}\s]/);
                if (directive === 'else') {
                    skipWhitespace(state);
                    // Check if this is {:else if} instead of just {:else}
                    if (peek(state) === 'i' && peek(state, 1) === 'f' && /\s/.test(peek(state, 2))) {
                        // This is {:else if condition}
                        consume(state, 'i');
                        consume(state, 'f');
                        skipWhitespace(state);
                        // Parse the else-if condition
                        const elseIfCondition = readUntil(state, '}');
                        consume(state, '}');
                        const elseIfConditionAST = parseExpression(elseIfCondition);
                        // Parse else-if children
                        const elseIfChildren = [];
                        let elseIfElse = undefined;
                        while (state.index < state.input.length) {
                            if (peek(state) === '{') {
                                const elseIfCheckpoint = state.index;
                                consume(state, '{');
                                if (peek(state) === ':') {
                                    consume(state, ':');
                                    const elseIfDirective = readUntil(state, /[}\s]/);
                                    if (elseIfDirective === 'else') {
                                        skipWhitespace(state);
                                        // Check if another else-if or final else
                                        if (peek(state) === 'i' && peek(state, 1) === 'f' && /\s/.test(peek(state, 2))) {
                                            // Another {:else if} - rewind and let it be parsed recursively
                                            state.index = elseIfCheckpoint;
                                            break;
                                        }
                                        else {
                                            // Final {:else}
                                            consume(state, '}');
                                            // Parse final else children
                                            const finalElseChildren = [];
                                            while (state.index < state.input.length) {
                                                if (peek(state) === '{' && peek(state, 1) === '/') {
                                                    break;
                                                }
                                                const node = parseNode(state);
                                                if (node)
                                                    finalElseChildren.push(node);
                                            }
                                            elseIfElse = {
                                                type: 'ElseBlock',
                                                children: finalElseChildren,
                                                start: elseIfCheckpoint,
                                                end: state.index
                                            };
                                            break;
                                        }
                                    }
                                }
                                if (peek(state) === '/') {
                                    consume(state, '/');
                                    expect(state, 'if');
                                    consume(state, '}');
                                    // Wrap the else-if as a nested if block in the else clause
                                    return {
                                        type: 'IfBlock',
                                        expression: conditionAST,
                                        children,
                                        else: {
                                            type: 'ElseBlock',
                                            children: [{
                                                    type: 'IfBlock',
                                                    expression: elseIfConditionAST,
                                                    children: elseIfChildren,
                                                    else: elseIfElse,
                                                    start: checkpoint,
                                                    end: state.index
                                                }],
                                            start: checkpoint,
                                            end: state.index
                                        },
                                        start,
                                        end: state.index
                                    };
                                }
                                // Not a closing tag, rewind and parse as normal node
                                state.index = elseIfCheckpoint;
                            }
                            const node = parseNode(state);
                            if (node)
                                elseIfChildren.push(node);
                        }
                        // If we broke out due to another {:else if}, handle it recursively
                        if (peek(state) === '{' && peek(state, 1) === ':') {
                            const recursiveCheckpoint = state.index;
                            consume(state, '{');
                            consume(state, ':');
                            const recursiveDirective = readUntil(state, /[}\s]/);
                            if (recursiveDirective === 'else') {
                                // Rewind to parse this recursively
                                state.index = recursiveCheckpoint;
                                // Parse remaining else/else-if chain
                                const remainingElse = parseElseChain(state);
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
                                        children: [{
                                                type: 'IfBlock',
                                                expression: elseIfConditionAST,
                                                children: elseIfChildren,
                                                else: remainingElse,
                                                start: checkpoint,
                                                end: state.index
                                            }],
                                        start: checkpoint,
                                        end: state.index
                                    },
                                    start,
                                    end: state.index
                                };
                            }
                        }
                        // No more else/else-if, consume {/if}
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
                                children: [{
                                        type: 'IfBlock',
                                        expression: elseIfConditionAST,
                                        children: elseIfChildren,
                                        else: elseIfElse,
                                        start: checkpoint,
                                        end: state.index
                                    }],
                                start: checkpoint,
                                end: state.index
                            },
                            start,
                            end: state.index
                        };
                    }
                    else {
                        // Just {:else} without if
                        consume(state, '}');
                        // Parse else children
                        const elseChildren = [];
                        while (state.index < state.input.length) {
                            if (peek(state) === '{' && peek(state, 1) === '/') {
                                break;
                            }
                            const node = parseNode(state);
                            if (node)
                                elseChildren.push(node);
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
        if (node)
            children.push(node);
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
function parseEachBlock(state, start) {
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
    const context = readUntil(state, /[},\s(]/);
    let index;
    let key;
    // Check for index (", index")
    skipWhitespace(state);
    if (peek(state) === ',') {
        consume(state, ',');
        skipWhitespace(state);
        index = readUntil(state, /[}\s(]/);
    }
    // Check for key expression "(keyExpression)"
    skipWhitespace(state);
    if (peek(state) === '(') {
        consume(state, '(');
        const keyExpr = readUntil(state, ')');
        consume(state, ')');
        key = parseExpression(keyExpr.trim());
    }
    skipWhitespace(state);
    consume(state, '}');
    // Parse children
    const children = [];
    while (state.index < state.input.length) {
        if (peek(state) === '{' && peek(state, 1) === '/') {
            consume(state, '{');
            consume(state, '/');
            expect(state, 'each');
            consume(state, '}');
            break;
        }
        const node = parseNode(state);
        if (node)
            children.push(node);
    }
    return {
        type: 'EachBlock',
        expression,
        context,
        index,
        key,
        children,
        start,
        end: state.index
    };
}
/**
 * Parse mustache tag {expression}
 */
function parseMustacheTag(state) {
    const start = state.index;
    consume(state, '{');
    const expr = readUntilClosingBrace(state);
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
function parseElement(state) {
    const start = state.index;
    consume(state, '<');
    const tagName = readUntil(state, /[\s/>]/);
    const attributes = [];
    // Parse attributes
    while (state.index < state.input.length) {
        skipWhitespace(state);
        if (peek(state) === '/' || peek(state) === '>')
            break;
        const attr = parseAttribute(state);
        if (attr)
            attributes.push(attr);
    }
    // Check for self-closing
    const selfClosing = peek(state) === '/';
    if (selfClosing) {
        consume(state, '/');
    }
    consume(state, '>');
    // Parse children (if not self-closing)
    const children = [];
    if (!selfClosing) {
        while (state.index < state.input.length) {
            // Check for closing tag
            if (peek(state) === '<' && peek(state, 1) === '/') {
                consume(state, '<');
                consume(state, '/');
                const closingTag = readUntil(state, '>');
                consume(state, '>');
                if (closingTag.trim() !== tagName) {
                    throw new compiler_1.CompilerError(`Mismatched closing tag: expected </${tagName}>, got </${closingTag}>`, { line: 0, column: state.index }, undefined, 'MISMATCHED_TAG');
                }
                break;
            }
            const node = parseNode(state);
            if (node)
                children.push(node);
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
function parseAttribute(state) {
    const start = state.index;
    // Check for shorthand prop syntax: {propName}
    if (peek(state) === '{') {
        consume(state, '{');
        const propName = readUntilClosingBrace(state);
        consume(state, '}');
        if (propName && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(propName)) {
            // This is shorthand syntax - expand it to propName={propName}
            return {
                type: 'Attribute',
                name: propName,
                value: [{ type: 'MustacheTag', expression: parseExpression(propName) }],
                start,
                end: state.index
            };
        }
    }
    const name = readUntil(state, /[=\s/>]/);
    if (!name)
        return null;
    // Check for event handler (on:)
    if (name.startsWith('on:')) {
        const eventName = name.slice(3);
        skipWhitespace(state);
        consume(state, '=');
        skipWhitespace(state);
        consume(state, '{');
        const expr = readUntilClosingBrace(state);
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
        const expr = readUntilClosingBrace(state);
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
        const expr = readUntilClosingBrace(state);
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
        const expr = readUntilClosingBrace(state);
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
    throw new compiler_1.CompilerError(`Expected attribute value`, { line: 0, column: state.index }, undefined, 'EXPECTED_VALUE');
}
/**
 * Parse text node
 */
function parseText(state) {
    const start = state.index;
    let text = '';
    while (state.index < state.input.length) {
        const char = peek(state);
        // Stop at special characters
        if (char === '<' || char === '{')
            break;
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
function parseExpression(expr) {
    // Defensive: validate input
    if (typeof expr !== 'string') {
        throw new TypeError('parseExpression: expr must be a string');
    }
    const trimmedExpr = expr.trim();
    // Defensive: check for empty expression
    if (trimmedExpr.length === 0) {
        throw new compiler_1.CompilerError('parseExpression: expression cannot be empty', undefined, undefined, 'INVALID_EXPRESSION');
    }
    // Defensive: check expression length to prevent DoS
    const MAX_EXPRESSION_LENGTH = 10000;
    if (trimmedExpr.length > MAX_EXPRESSION_LENGTH) {
        throw new compiler_1.CompilerError(`parseExpression: expression too long (${trimmedExpr.length} > ${MAX_EXPRESSION_LENGTH})`, undefined, undefined, 'INVALID_EXPRESSION');
    }
    try {
        const ast = (0, acorn_1.parse)(trimmedExpr, {
            ecmaVersion: 2022,
            sourceType: 'module'
        });
        // Defensive: validate parsed result
        if (!ast || typeof ast !== 'object') {
            throw new compiler_1.CompilerError(`parseExpression: failed to parse expression "${trimmedExpr}"`, undefined, undefined, 'INVALID_EXPRESSION');
        }
        return ast;
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new compiler_1.CompilerError(`Invalid expression: ${trimmedExpr} - ${errorMessage}`, undefined, undefined, 'INVALID_EXPRESSION');
    }
}
/**
 * Peek at character at offset
 */
function peek(state, offset = 0) {
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
function consume(state, char) {
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
        throw new compiler_1.CompilerError(`Expected '${char}', got '${current}' at position ${state.index}`, { line: 0, column: state.index }, undefined, 'UNEXPECTED_CHAR');
    }
    state.index++;
    // Defensive: ensure index doesn't exceed bounds
    if (state.index > state.input.length) {
        throw new compiler_1.CompilerError(`consume: index ${state.index} exceeds input length ${state.input.length}`, { line: 0, column: state.index }, undefined, 'PARSE_ERROR');
    }
}
/**
 * Expect string at current position
 */
function expect(state, str) {
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
    }
    catch (error) {
        // Defensive: provide better error context
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new compiler_1.CompilerError(`expect: failed to match expected string "${str}" at position ${startIndex}: ${errorMessage}`, { line: 0, column: startIndex }, undefined, 'UNEXPECTED_CHAR');
    }
}
/**
 * Read until pattern matches
 */
function readUntil(state, pattern) {
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
            throw new compiler_1.CompilerError('readUntil: maximum iteration limit exceeded', { line: 0, column: state.index }, undefined, 'PARSE_ERROR');
        }
        const remaining = state.input.slice(state.index);
        if (typeof pattern === 'string') {
            if (pattern.length === 0) {
                throw new Error('readUntil: pattern string cannot be empty');
            }
            if (remaining.startsWith(pattern))
                break;
        }
        else {
            if (pattern.test(peek(state)))
                break;
        }
        result += peek(state);
        state.index++;
        // Defensive: validate index
        if (state.index > state.input.length) {
            throw new compiler_1.CompilerError('readUntil: index exceeded input length', { line: 0, column: state.index }, undefined, 'PARSE_ERROR');
        }
    }
    return result;
}
/**
 * Skip whitespace
 */
function skipWhitespace(state) {
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
            throw new compiler_1.CompilerError('skipWhitespace: maximum iteration limit exceeded', { line: 0, column: state.index }, undefined, 'PARSE_ERROR');
        }
        state.index++;
        // Defensive: validate index
        if (state.index > state.input.length) {
            throw new compiler_1.CompilerError('skipWhitespace: index exceeded input length', { line: 0, column: state.index }, undefined, 'PARSE_ERROR');
        }
    }
}
