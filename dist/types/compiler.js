"use strict";
/**
 * Compiler API Types
 *
 * These types define the public API of the @durable/compiler package,
 * modeled on svelte/compiler and @babel/core.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompilerError = void 0;
/**
 * Compiler error
 */
class CompilerError extends Error {
    start;
    end;
    code;
    constructor(message, start, end, code) {
        super(message);
        this.start = start;
        this.end = end;
        this.code = code;
        this.name = 'CompilerError';
    }
}
exports.CompilerError = CompilerError;
