/**
 * Code generation utilities
 */
/**
 * Indent code block
 */
export declare function indent(code: string, level?: number, char?: string): string;
/**
 * Dedent code (remove common leading whitespace)
 */
export declare function dedent(code: string): string;
/**
 * Join code statements with proper spacing
 */
export declare function joinStatements(...statements: (string | null | undefined)[]): string;
/**
 * Wrap code in a block
 */
export declare function block(code: string): string;
/**
 * Create an array literal
 */
export declare function arrayLiteral(items: string[]): string;
/**
 * Create an object literal
 */
export declare function objectLiteral(props: Record<string, string>): string;
