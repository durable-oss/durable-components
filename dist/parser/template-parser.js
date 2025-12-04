"use strict";
/**
 * Template Parser
 *
 * Parses HTML-like template syntax with Svelte-style directives
 * into a template AST using Parsimmon.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseTemplate = parseTemplate;
const P = __importStar(require("parsimmon"));
const acorn_1 = require("acorn");
const compiler_1 = require("../types/compiler");
/**
 * Parse JavaScript expression using Acorn
 */
function parseExpression(expr) {
    if (typeof expr !== 'string') {
        throw new TypeError('parseExpression: expr must be a string');
    }
    const trimmedExpr = expr.trim();
    if (trimmedExpr.length === 0) {
        throw new compiler_1.CompilerError('parseExpression: expression cannot be empty', undefined, undefined, 'INVALID_EXPRESSION');
    }
    const MAX_EXPRESSION_LENGTH = 10000;
    if (trimmedExpr.length > MAX_EXPRESSION_LENGTH) {
        throw new compiler_1.CompilerError(`parseExpression: expression too long (${trimmedExpr.length} > ${MAX_EXPRESSION_LENGTH})`, undefined, undefined, 'INVALID_EXPRESSION');
    }
    try {
        const ast = (0, acorn_1.parse)(trimmedExpr, {
            ecmaVersion: 2022,
            sourceType: 'module'
        });
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
 * Read content until closing brace, handling nested braces
 */
function readUntilClosingBrace(input, startIdx) {
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
            }
            else if (ch === stringChar) {
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
    throw new compiler_1.CompilerError('Unexpected end of input in expression', { line: 0, column: idx }, undefined, 'UNEXPECTED_EOF');
}
// Language definition
const language = P.createLanguage({
    // Whitespace
    _: () => P.optWhitespace,
    // Text until special character
    textContent: () => P.regexp(/[^<{]+/).map((data) => ({
        type: 'Text',
        data
    })),
    // HTML Comment
    comment: () => P.seq(P.string('<!--'), P.regexp(/[\s\S]*?(?=-->)/), P.string('-->')).map(([, data]) => ({
        type: 'Comment',
        data
    })),
    // Mustache tag {expression}
    mustacheTag: () => P.seq(P.string('{'), 
    // Not a block directive or @ directive or closing tag or else
    P.lookahead(P.regexp(/[^#@/:]/)), P.custom((success, failure) => {
        return (input, idx) => {
            try {
                const { content, endIdx } = readUntilClosingBrace(input, idx);
                return success(endIdx, content);
            }
            catch (e) {
                return failure(idx, 'Could not read until closing brace');
            }
        };
    }), P.string('}')).map(([, , expr]) => ({
        type: 'MustacheTag',
        expression: parseExpression(expr)
    })),
    // Block directives
    blockDirective: (r) => P.alt(r.ifBlock, r.eachBlock, r.keyBlock),
    // {@render snippet()} directive
    renderBlock: () => P.seq(P.string('{@render'), P.optWhitespace, P.custom((success, failure) => {
        return (input, idx) => {
            try {
                const { content, endIdx } = readUntilClosingBrace(input, idx);
                return success(endIdx, content);
            }
            catch (e) {
                return failure(idx, 'Could not read until closing brace');
            }
        };
    }), P.string('}')).map(([, , expr]) => {
        const exprStr = expr;
        if (!exprStr || exprStr.trim().length === 0) {
            throw new compiler_1.CompilerError('Empty @render expression', undefined, undefined, 'INVALID_SYNTAX');
        }
        let snippet = '';
        let args = [];
        let fullExpression;
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
            }
            else if (actualExpr.type === 'Identifier') {
                snippet = actualExpr.name;
            }
            else {
                throw new Error('Invalid render expression - expected identifier or call expression');
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new compiler_1.CompilerError(`Invalid @render expression: ${exprStr} - ${errorMessage}`, undefined, undefined, 'INVALID_EXPRESSION');
        }
        return {
            type: 'RenderBlock',
            expression: fullExpression,
            snippet,
            args: args.length > 0 ? args : undefined
        };
    }),
    // {@const name = value} directive
    constTag: () => P.seq(P.string('{@const'), P.optWhitespace, P.custom((success, failure) => {
        return (input, idx) => {
            try {
                const { content, endIdx } = readUntilClosingBrace(input, idx);
                return success(endIdx, content);
            }
            catch (e) {
                return failure(idx, 'Could not read until closing brace');
            }
        };
    }), P.string('}')).map(([, , declaration]) => {
        const declarationStr = declaration;
        const equalsIndex = declarationStr.indexOf('=');
        if (equalsIndex === -1) {
            throw new compiler_1.CompilerError(`Invalid @const declaration: ${declarationStr}`, undefined, undefined, 'INVALID_SYNTAX');
        }
        const name = declarationStr.substring(0, equalsIndex).trim();
        const expressionStr = declarationStr.substring(equalsIndex + 1).trim();
        if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)) {
            throw new compiler_1.CompilerError(`Invalid variable name in @const: ${name}`, undefined, undefined, 'INVALID_SYNTAX');
        }
        const expression = parseExpression(expressionStr);
        return {
            type: 'ConstTag',
            name,
            expression
        };
    }),
    // {@html expression} directive
    htmlTag: () => P.seq(P.string('{@html'), P.optWhitespace, P.custom((success, failure) => {
        return (input, idx) => {
            try {
                const { content, endIdx } = readUntilClosingBrace(input, idx);
                return success(endIdx, content);
            }
            catch (e) {
                return failure(idx, 'Could not read until closing brace');
            }
        };
    }), P.string('}')).map(([, , expr]) => {
        const exprStr = expr;
        if (!exprStr || exprStr.trim().length === 0) {
            throw new compiler_1.CompilerError('Empty @html expression', undefined, undefined, 'INVALID_SYNTAX');
        }
        const expression = parseExpression(exprStr.trim());
        return {
            type: 'HtmlTag',
            expression
        };
    }),
    // {@debug var1, var2, ...} directive
    debugTag: () => P.seq(P.string('{@debug'), P.regexp(/[^}]*/), P.string('}')).map(([, vars]) => {
        const identifiers = vars.trim()
            ? vars.split(',').map(v => v.trim()).filter(Boolean)
            : [];
        return {
            type: 'DebugTag',
            identifiers
        };
    }),
    // @ directives
    atDirective: (r) => P.alt(r.renderBlock, r.constTag, r.htmlTag, r.debugTag),
    // {#key expression} block
    keyBlock: (r) => P.seq(P.string('{#key'), P.optWhitespace, P.regexp(/[^}]+/), P.string('}'), P.lazy(() => r.nodes), P.string('{/key}')).map(([, , expr, , children]) => ({
        type: 'KeyBlock',
        expression: parseExpression(expr.trim()),
        children
    })),
    // {#if} block with optional else/else-if
    ifBlock: (r) => P.seq(P.string('{#if'), P.optWhitespace, P.regexp(/[^}]+/), P.string('}'), P.lazy(() => r.nodes), P.alt(P.seq(P.string('{:else if'), P.optWhitespace, P.regexp(/[^}]+/), P.string('}'), P.lazy(() => r.nodes)).many().chain((elseIfs) => P.alt(P.seq(P.string('{:else}'), P.lazy(() => r.nodes)).map(([, elseChildren]) => ({ elseIfs, elseChildren })), P.succeed({ elseIfs, elseChildren: null }))), P.succeed({ elseIfs: [], elseChildren: null })), P.string('{/if}')).map(([, , condition, , children, { elseIfs, elseChildren }]) => {
        const conditionAST = parseExpression(condition.trim());
        // Build the else chain recursively
        let elseBlock = undefined;
        if (elseChildren && elseChildren.length > 0) {
            elseBlock = {
                type: 'ElseBlock',
                children: elseChildren
            };
        }
        // Build else-if chain from the end
        for (let i = elseIfs.length - 1; i >= 0; i--) {
            const [, , elseIfCondition, , elseIfChildren] = elseIfs[i];
            const elseIfConditionAST = parseExpression(elseIfCondition.trim());
            elseBlock = {
                type: 'ElseBlock',
                children: [{
                        type: 'IfBlock',
                        expression: elseIfConditionAST,
                        children: elseIfChildren,
                        else: elseBlock
                    }]
            };
        }
        return {
            type: 'IfBlock',
            expression: conditionAST,
            children,
            else: elseBlock
        };
    }),
    // {#each} block
    eachBlock: (r) => P.seq(P.string('{#each'), P.optWhitespace, P.regexp(/[^}]+?(?=\s+as\s+)/), P.regexp(/\s+as\s+/), P.regexp(/[a-zA-Z_$][a-zA-Z0-9_$]*/), P.alt(P.seq(P.string(','), P.optWhitespace, P.regexp(/[a-zA-Z_$][a-zA-Z0-9_$]*/)).map(([, , idx]) => idx), P.succeed(undefined)), P.alt(P.seq(P.optWhitespace, P.string('('), P.regexp(/[^)]+/), P.string(')')).map(([, , keyExpr]) => parseExpression(keyExpr.trim())), P.succeed(undefined)), P.optWhitespace, P.string('}'), P.lazy(() => r.nodes), P.string('{/each}')).map(([, , expr, , context, index, key, , , children]) => ({
        type: 'EachBlock',
        expression: parseExpression(expr.trim()),
        context,
        index,
        key,
        children
    })),
    // Element attributes
    attribute: () => P.alt(
    // Shorthand {propName}
    P.seq(P.string('{'), P.regexp(/[a-zA-Z_$][a-zA-Z0-9_$]*/), P.string('}')).map(([, propName]) => ({
        type: 'Attribute',
        name: propName,
        value: [{ type: 'MustacheTag', expression: parseExpression(propName) }]
    })), 
    // Dynamic attribute name with interpolation: style:border-{position}={value} or ="value"
    P.seq(P.regexp(/[a-zA-Z0-9_:-]+\{/), P.regexp(/[a-zA-Z_$][a-zA-Z0-9_$]*/), P.string('}'), P.optWhitespace, P.string('='), P.optWhitespace, P.alt(
    // Dynamic value {expr}
    P.seq(P.string('{'), P.custom((success, failure) => {
        return (input, idx) => {
            try {
                const { content, endIdx } = readUntilClosingBrace(input, idx);
                return success(endIdx, content);
            }
            catch (e) {
                return failure(idx, 'Could not read until closing brace');
            }
        };
    }), P.string('}')).map(([, expr]) => [{ type: 'MustacheTag', expression: parseExpression(expr) }]), 
    // String value "..." or '...'
    P.alt(P.seq(P.string('"'), P.regexp(/[^"]*/), P.string('"')), P.seq(P.string("'"), P.regexp(/[^']*/), P.string("'"))).map(([, value]) => [{ type: 'Text', data: value }]))).map(([prefix, interpolation, , , , , value]) => {
        // Remove trailing { from prefix
        const attrPrefix = prefix.slice(0, -1);
        return {
            type: 'Attribute',
            name: `${attrPrefix}{${interpolation}}`,
            value
        };
    }), 
    // Event handler on:event={handler}
    P.seq(P.string('on:'), P.regexp(/[a-zA-Z0-9_-]+/), P.optWhitespace, P.string('='), P.optWhitespace, P.string('{'), P.custom((success, failure) => {
        return (input, idx) => {
            try {
                const { content, endIdx } = readUntilClosingBrace(input, idx);
                return success(endIdx, content);
            }
            catch (e) {
                return failure(idx, 'Could not read until closing brace');
            }
        };
    }), P.string('}')).map(([, eventName, , , , , expr]) => ({
        type: 'EventHandler',
        name: eventName,
        expression: parseExpression(expr)
    })), 
    // Binding bind:prop={value}
    P.seq(P.string('bind:'), P.regexp(/[a-zA-Z0-9_-]+/), P.optWhitespace, P.string('='), P.optWhitespace, P.string('{'), P.custom((success, failure) => {
        return (input, idx) => {
            try {
                const { content, endIdx } = readUntilClosingBrace(input, idx);
                return success(endIdx, content);
            }
            catch (e) {
                return failure(idx, 'Could not read until closing brace');
            }
        };
    }), P.string('}')).map(([, bindName, , , , , expr]) => ({
        type: 'Binding',
        name: bindName,
        expression: parseExpression(expr)
    })), 
    // Class directive class:name={condition}
    P.seq(P.string('class:'), P.regexp(/[a-zA-Z0-9_-]+/), P.optWhitespace, P.string('='), P.optWhitespace, P.string('{'), P.custom((success, failure) => {
        return (input, idx) => {
            try {
                const { content, endIdx } = readUntilClosingBrace(input, idx);
                return success(endIdx, content);
            }
            catch (e) {
                return failure(idx, 'Could not read until closing brace');
            }
        };
    }), P.string('}')).map(([, className, , , , , expr]) => ({
        type: 'Class',
        name: className,
        expression: parseExpression(expr)
    })), 
    // Dynamic attribute name={value}
    P.seq(P.regexp(/[a-zA-Z0-9_:-]+/), P.optWhitespace, P.string('='), P.optWhitespace, P.alt(
    // Dynamic value {expr}
    P.seq(P.string('{'), P.custom((success, failure) => {
        return (input, idx) => {
            try {
                const { content, endIdx } = readUntilClosingBrace(input, idx);
                return success(endIdx, content);
            }
            catch (e) {
                return failure(idx, 'Could not read until closing brace');
            }
        };
    }), P.string('}')).map(([, expr]) => [{ type: 'MustacheTag', expression: parseExpression(expr) }]), 
    // String value "..." or '...'
    P.alt(P.seq(P.string('"'), P.regexp(/[^"]*/), P.string('"')), P.seq(P.string("'"), P.regexp(/[^']*/), P.string("'"))).map(([, value]) => [{ type: 'Text', data: value }]))).map(([name, , , , value]) => ({
        type: 'Attribute',
        name,
        value
    })), 
    // Boolean attribute (no value)
    P.regexp(/[a-zA-Z0-9_:-]+/).map((name) => ({
        type: 'Attribute',
        name,
        value: [{ type: 'Text', data: '' }]
    }))),
    // HTML element
    element: (r) => P.seq(P.string('<'), P.regexp(/[a-zA-Z][a-zA-Z0-9_-]*/), P.seq(P.optWhitespace, r.attribute).map(([, attr]) => attr).many(), P.optWhitespace, P.alt(
    // Self-closing
    P.seq(P.string('/>'))
        .map(() => ({ selfClosing: true, children: [] })), 
    // With children
    P.seq(P.string('>'), P.lazy(() => r.nodes), P.string('</'), P.regexp(/[a-zA-Z][a-zA-Z0-9_-]*/), P.string('>')).map(([, children, , closingTag]) => ({ selfClosing: false, children, closingTag })))).chain(([, tagName, attributes, , { selfClosing, children, closingTag }]) => {
        if (!selfClosing && closingTag !== tagName) {
            return P.fail(`Mismatched closing tag: expected </${tagName}>, got </${closingTag}>`);
        }
        return P.succeed({
            type: 'Element',
            name: tagName,
            attributes,
            children
        });
    }),
    // Single node
    node: (r) => P.alt(r.comment, r.blockDirective, r.atDirective, r.mustacheTag, r.element, r.textContent),
    // Multiple nodes
    nodes: (r) => r.node.many(),
    // Root parser
    template: (r) => r.nodes
});
/**
 * Parse template content into AST nodes
 */
function parseTemplate(input) {
    if (typeof input !== 'string') {
        throw new TypeError('parseTemplate: input must be a string');
    }
    const trimmedInput = input.trim();
    try {
        const result = language.template.parse(trimmedInput);
        if (!result.status) {
            const { index, expected } = result;
            throw new compiler_1.CompilerError(`Parse error at position ${index.offset}: expected ${expected.join(', ')}`, { line: index.line, column: index.column }, undefined, 'PARSE_ERROR');
        }
        return result.value;
    }
    catch (error) {
        if (error instanceof compiler_1.CompilerError) {
            throw error;
        }
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new compiler_1.CompilerError(`Parse error: ${errorMessage}`, undefined, undefined, 'PARSE_ERROR');
    }
}
