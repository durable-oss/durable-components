/**
 * String utility functions
 */
/**
 * Extract content between opening and closing tags
 */
export declare function extractBlockContent(source: string, tagName: string): {
    content: string;
    start: number;
    end: number;
    attributes?: Record<string, string>;
} | null;
/**
 * Extract attributes from an HTML tag string
 */
export declare function extractTagAttributes(tagString: string): Record<string, string>;
/**
 * Convert component filename to PascalCase name
 */
export declare function filenameToComponentName(filename: string): string;
/**
 * Generate a stable hash for scoping
 */
export declare function generateHash(content: string): string;
/**
 * Escape HTML special characters
 */
export declare function escapeHtml(text: string): string;
/**
 * Check if a string is a valid identifier
 */
export declare function isValidIdentifier(name: string): boolean;
