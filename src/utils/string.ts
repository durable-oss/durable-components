/**
 * String utility functions
 */

/**
 * Extract content between opening and closing tags
 */
export function extractBlockContent(
  source: string,
  tagName: string
): { content: string; start: number; end: number; attributes?: Record<string, string> } | null {
  // Defensive: validate inputs
  if (typeof source !== 'string') {
    throw new TypeError('extractBlockContent: source must be a string');
  }
  if (typeof tagName !== 'string') {
    throw new TypeError('extractBlockContent: tagName must be a string');
  }
  if (tagName.length === 0) {
    throw new Error('extractBlockContent: tagName cannot be empty');
  }
  if (source.length === 0) {
    return null;
  }

  // Defensive: validate tagName contains only valid characters
  if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(tagName)) {
    throw new Error(`extractBlockContent: invalid tagName "${tagName}" - must be alphanumeric`);
  }

  const openPattern = new RegExp(`<${tagName}[^>]*>`, 'i');
  const closePattern = new RegExp(`</${tagName}>`, 'i');

  const openMatch = source.match(openPattern);
  if (!openMatch) return null;

  // Defensive: ensure index exists
  if (openMatch.index === undefined) {
    throw new Error('extractBlockContent: unexpected undefined match index');
  }

  const openEnd = openMatch.index + openMatch[0].length;

  // Defensive: validate index bounds
  if (openEnd < 0 || openEnd > source.length) {
    throw new Error(`extractBlockContent: invalid index ${openEnd} for source length ${source.length}`);
  }

  // Extract attributes from opening tag
  const attributes = extractTagAttributes(openMatch[0]);

  const remaining = source.slice(openEnd);

  const closeMatch = remaining.match(closePattern);
  if (!closeMatch) return null;

  // Defensive: ensure close match index exists
  if (closeMatch.index === undefined) {
    throw new Error('extractBlockContent: unexpected undefined close match index');
  }

  // Defensive: validate close index bounds
  if (closeMatch.index < 0 || closeMatch.index > remaining.length) {
    throw new Error(`extractBlockContent: invalid close index ${closeMatch.index} for remaining length ${remaining.length}`);
  }

  return {
    content: remaining.slice(0, closeMatch.index),
    start: openEnd,
    end: openEnd + closeMatch.index,
    attributes
  };
}

/**
 * Extract attributes from an HTML tag string
 */
export function extractTagAttributes(tagString: string): Record<string, string> {
  // Defensive: validate input
  if (typeof tagString !== 'string') {
    throw new TypeError('extractTagAttributes: tagString must be a string');
  }

  const attributes: Record<string, string> = {};

  // Match attribute patterns: name="value", name='value', or name=value
  const attrPattern = /(\w+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

  let match;
  while ((match = attrPattern.exec(tagString)) !== null) {
    const name = match[1];
    const value = match[2] || match[3] || match[4] || '';

    // Defensive: validate attribute name
    if (name && name.length > 0) {
      attributes[name] = value;
    }
  }

  return attributes;
}

/**
 * Convert component filename to PascalCase name
 */
export function filenameToComponentName(filename: string): string {
  // Defensive: validate input
  if (typeof filename !== 'string') {
    throw new TypeError('filenameToComponentName: filename must be a string');
  }
  if (filename.length === 0) {
    throw new Error('filenameToComponentName: filename cannot be empty');
  }

  // Defensive: get basename safely
  const parts = filename.split('/');
  if (parts.length === 0) {
    throw new Error('filenameToComponentName: invalid filename path');
  }

  const basename = parts[parts.length - 1];
  if (!basename || basename.length === 0) {
    throw new Error('filenameToComponentName: filename basename is empty');
  }

  // Remove file extensions
  const nameWithoutExt = basename.replace(/\.(dce|svelte)$/, '');

  // Defensive: ensure we have a name after removing extension
  if (nameWithoutExt.length === 0) {
    throw new Error('filenameToComponentName: filename has no valid name part');
  }

  // Convert to PascalCase
  const nameParts = nameWithoutExt.split(/[-_]/);

  // Defensive: ensure we have parts
  if (nameParts.length === 0) {
    throw new Error('filenameToComponentName: failed to split filename into parts');
  }

  return nameParts
    .filter(part => part.length > 0) // Remove empty parts
    .map((part) => {
      // Defensive: handle empty parts
      if (part.length === 0) return '';
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join('');
}

/**
 * Generate a stable hash for scoping
 */
export function generateHash(content: string): string {
  // Defensive: validate input
  if (typeof content !== 'string') {
    throw new TypeError('generateHash: content must be a string');
  }

  // Defensive: handle empty string (return a default hash)
  if (content.length === 0) {
    return 'dce-0';
  }

  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);

    // Defensive: validate charCode
    if (isNaN(char)) {
      throw new Error(`generateHash: invalid character at index ${i}`);
    }

    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  const absHash = Math.abs(hash);
  const hashStr = absHash.toString(36);

  // Defensive: ensure we have a valid hash string
  if (!hashStr || hashStr.length === 0) {
    return 'dce-0';
  }

  return 'dce-' + hashStr;
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(text: string): string {
  // Defensive: validate input
  if (typeof text !== 'string') {
    throw new TypeError('escapeHtml: text must be a string');
  }

  // Defensive: handle empty string
  if (text.length === 0) {
    return '';
  }

  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };

  return text.replace(/[&<>"']/g, (char) => {
    // Defensive: ensure mapping exists
    const escaped = map[char];
    if (escaped === undefined) {
      throw new Error(`escapeHtml: no mapping found for character "${char}"`);
    }
    return escaped;
  });
}

/**
 * Check if a string is a valid identifier
 */
export function isValidIdentifier(name: string): boolean {
  // Defensive: validate input type
  if (typeof name !== 'string') {
    throw new TypeError('isValidIdentifier: name must be a string');
  }

  // Defensive: check for empty string
  if (name.length === 0) {
    return false;
  }

  // Defensive: check for reserved keywords
  const reservedKeywords = new Set([
    'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default',
    'delete', 'do', 'else', 'export', 'extends', 'finally', 'for', 'function',
    'if', 'import', 'in', 'instanceof', 'new', 'return', 'super', 'switch',
    'this', 'throw', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield',
    'let', 'static', 'enum', 'await', 'implements', 'interface', 'package',
    'private', 'protected', 'public'
  ]);

  // Check pattern
  if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)) {
    return false;
  }

  // Check if reserved keyword
  if (reservedKeywords.has(name)) {
    return false;
  }

  return true;
}
