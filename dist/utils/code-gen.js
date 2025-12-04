"use strict";
/**
 * Code generation utilities
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.indent = indent;
exports.dedent = dedent;
exports.joinStatements = joinStatements;
exports.block = block;
exports.arrayLiteral = arrayLiteral;
exports.objectLiteral = objectLiteral;
/**
 * Indent code block
 */
function indent(code, level = 1, char = '  ') {
    const indentation = char.repeat(level);
    return code
        .split('\n')
        .map((line) => (line.trim() ? indentation + line : line))
        .join('\n');
}
/**
 * Dedent code (remove common leading whitespace)
 */
function dedent(code) {
    const lines = code.split('\n');
    const nonEmptyLines = lines.filter((line) => line.trim());
    if (nonEmptyLines.length === 0)
        return '';
    const minIndent = Math.min(...nonEmptyLines.map((line) => line.match(/^\s*/)?.[0].length || 0));
    return lines.map((line) => line.slice(minIndent)).join('\n');
}
/**
 * Join code statements with proper spacing
 */
function joinStatements(...statements) {
    return statements.filter(Boolean).join('\n\n');
}
/**
 * Wrap code in a block
 */
function block(code) {
    return `{\n${indent(code)}\n}`;
}
/**
 * Create an array literal
 */
function arrayLiteral(items) {
    if (items.length === 0)
        return '[]';
    if (items.length === 1)
        return `[${items[0]}]`;
    return `[\n${indent(items.join(',\n'))}\n]`;
}
/**
 * Create an object literal
 */
function objectLiteral(props) {
    const entries = Object.entries(props);
    if (entries.length === 0)
        return '{}';
    if (entries.length === 1) {
        const [key, value] = entries[0];
        return `{ ${key}: ${value} }`;
    }
    const lines = entries.map(([key, value]) => `${key}: ${value}`);
    return `{\n${indent(lines.join(',\n'))}\n}`;
}
