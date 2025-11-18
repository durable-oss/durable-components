/**
 * Phase 1: Parser
 *
 * Parses .dce source files into a D-AST (Durable AST).
 * This phase separates <script>, <template>, and <style> blocks
 * and parses each into their respective AST representations.
 */

import { parse as acornParse, Parser } from 'acorn';
import type { DurableComponentAST, ScriptBlock, TemplateBlock, StyleBlock } from '../types/ast';
import type { ParseOptions } from '../types/compiler';
import { extractBlockContent, filenameToComponentName } from '../utils/string';
import { CompilerError } from '../types/compiler';
import { parseTemplate } from './template-parser';

// Import acorn-typescript using require to avoid module resolution issues
const getTsPlugin = () => {
  try {
    const acornTs = require('acorn-typescript');
    return acornTs.default || acornTs.tsPlugin || acornTs;
  } catch (error) {
    console.warn('acorn-typescript not available, TypeScript parsing will not work');
    return null;
  }
};

/**
 * Main parse function
 *
 * Converts .dce source string into D-AST
 */
export function parse(source: string, options: ParseOptions = {}): DurableComponentAST {
  // Defensive: validate inputs
  if (typeof source !== 'string') {
    throw new TypeError('parse: source must be a string');
  }
  // Note: Empty source is allowed, will just return minimal AST
  if (options === null || options === undefined) {
    options = {};
  }
  if (typeof options !== 'object') {
    throw new TypeError('parse: options must be an object');
  }

  const filename = options.filename || 'Component.dce';

  // Defensive: validate filename
  if (typeof filename !== 'string') {
    throw new TypeError('parse: filename must be a string');
  }
  if (filename.length === 0) {
    throw new CompilerError(
      'parse: filename cannot be empty',
      undefined,
      undefined,
      'EMPTY_FILENAME'
    );
  }

  try {
    const ast: DurableComponentAST = {
      type: 'DurableComponent',
      meta: {
        filename,
        source
      }
    };

    // Extract and parse <script> block
    const scriptBlock = extractBlockContent(source, 'script');
    if (scriptBlock) {
      // Defensive: validate extracted block (but allow empty content)
      if (scriptBlock.content !== null && scriptBlock.content !== undefined) {
        if (typeof scriptBlock.start !== 'number' || scriptBlock.start < 0) {
          throw new CompilerError(
            'parse: invalid script block start position',
            undefined,
            undefined,
            'INVALID_POSITION'
          );
        }
        // Parse even if empty (tests expect this)
        const lang = scriptBlock.attributes?.lang;
        ast.script = parseScript(scriptBlock.content, scriptBlock.start, lang);
      }
    }

    // Extract and parse <template> block
    const templateBlock = extractBlockContent(source, 'template');
    if (templateBlock) {
      // Defensive: validate extracted block (but allow empty content)
      if (templateBlock.content !== null && templateBlock.content !== undefined) {
        if (typeof templateBlock.start !== 'number' || templateBlock.start < 0) {
          throw new CompilerError(
            'parse: invalid template block start position',
            undefined,
            undefined,
            'INVALID_POSITION'
          );
        }
        // Parse even if empty (tests expect this)
        ast.template = parseTemplateBlock(templateBlock.content, templateBlock.start);
      }
    }

    // Extract <style> block
    const styleBlock = extractBlockContent(source, 'style');
    if (styleBlock) {
      // Defensive: validate extracted block
      if (typeof styleBlock.start !== 'number' || styleBlock.start < 0) {
        throw new CompilerError(
          'parse: invalid style block start position',
          undefined,
          undefined,
          'INVALID_POSITION'
        );
      }
      ast.style = parseStyle(styleBlock.content, styleBlock.start);
    }

    // Defensive: ensure AST has required structure
    if (!ast.meta || typeof ast.meta.filename !== 'string' || typeof ast.meta.source !== 'string') {
      throw new CompilerError(
        'parse: invalid AST structure - missing meta information',
        undefined,
        undefined,
        'INVALID_AST'
      );
    }

    return ast;
  } catch (error) {
    if (error instanceof CompilerError) {
      throw error;
    }
    // Defensive: handle various error types
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new CompilerError(
      `Parse error in ${filename}: ${errorMessage}`,
      undefined,
      undefined,
      'PARSE_ERROR'
    );
  }
}

/**
 * Parse <script> block
 */
function parseScript(content: string, start: number, lang?: string): ScriptBlock {
  // Defensive: validate inputs
  if (typeof content !== 'string') {
    throw new TypeError('parseScript: content must be a string');
  }
  if (typeof start !== 'number') {
    throw new TypeError('parseScript: start must be a number');
  }
  if (start < 0) {
    throw new CompilerError(
      'parseScript: start position cannot be negative',
      undefined,
      undefined,
      'INVALID_POSITION'
    );
  }
  if (!Number.isFinite(start)) {
    throw new CompilerError(
      'parseScript: start position must be finite',
      undefined,
      undefined,
      'INVALID_POSITION'
    );
  }

  try {
    // Parse JavaScript/TypeScript with Acorn
    // Use acorn-typescript parser when lang is 'ts' or 'typescript'
    const isTypeScript = lang === 'ts' || lang === 'typescript';
    let ast;

    if (isTypeScript) {
      const tsPlugin = getTsPlugin();
      if (tsPlugin) {
        ast = Parser.extend(tsPlugin() as any).parse(content, {
          ecmaVersion: 2022,
          sourceType: 'module',
          locations: true
        });
      } else {
        // Fallback to regular parsing
        ast = acornParse(content, {
          ecmaVersion: 2022,
          sourceType: 'module',
          locations: true
        });
      }
    } else {
      ast = acornParse(content, {
        ecmaVersion: 2022,
        sourceType: 'module',
        locations: true
      });
    }

    // Defensive: validate parsed AST
    if (!ast || typeof ast !== 'object') {
      throw new CompilerError(
        'parseScript: failed to parse script - invalid AST',
        undefined,
        undefined,
        'INVALID_SCRIPT'
      );
    }

    const end = start + content.length;

    // Defensive: validate end position
    if (end < start) {
      throw new CompilerError(
        'parseScript: calculated end position is less than start',
        undefined,
        undefined,
        'INVALID_POSITION'
      );
    }

    return {
      type: 'ScriptBlock',
      content: content, // Don't trim - AST positions are relative to this
      ast,
      lang,
      start,
      end
    };
  } catch (error) {
    if (error instanceof CompilerError) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new CompilerError(
      `Invalid JavaScript in <script> block: ${errorMessage}`,
      undefined,
      undefined,
      'INVALID_SCRIPT'
    );
  }
}

/**
 * Parse <template> block
 */
function parseTemplateBlock(content: string, start: number): TemplateBlock {
  // Defensive: validate inputs
  if (typeof content !== 'string') {
    throw new TypeError('parseTemplateBlock: content must be a string');
  }
  if (typeof start !== 'number') {
    throw new TypeError('parseTemplateBlock: start must be a number');
  }
  if (start < 0) {
    throw new CompilerError(
      'parseTemplateBlock: start position cannot be negative',
      undefined,
      undefined,
      'INVALID_POSITION'
    );
  }
  if (!Number.isFinite(start)) {
    throw new CompilerError(
      'parseTemplateBlock: start position must be finite',
      undefined,
      undefined,
      'INVALID_POSITION'
    );
  }

  try {
    const children = parseTemplate(content);

    // Defensive: validate children
    if (!Array.isArray(children)) {
      throw new CompilerError(
        'parseTemplateBlock: parseTemplate did not return an array',
        undefined,
        undefined,
        'INVALID_TEMPLATE'
      );
    }

    // Defensive: validate each child has required properties
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (!child || typeof child !== 'object') {
        throw new CompilerError(
          `parseTemplateBlock: invalid child at index ${i}`,
          undefined,
          undefined,
          'INVALID_TEMPLATE'
        );
      }
      if (!child.type) {
        throw new CompilerError(
          `parseTemplateBlock: child at index ${i} missing type property`,
          undefined,
          undefined,
          'INVALID_TEMPLATE'
        );
      }
    }

    const end = start + content.length;

    // Defensive: validate end position
    if (end < start) {
      throw new CompilerError(
        'parseTemplateBlock: calculated end position is less than start',
        undefined,
        undefined,
        'INVALID_POSITION'
      );
    }

    return {
      type: 'TemplateBlock',
      content: content, // Don't trim - positions are relative to this
      children,
      start,
      end
    };
  } catch (error) {
    if (error instanceof CompilerError) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new CompilerError(
      `Invalid template syntax: ${errorMessage}`,
      undefined,
      undefined,
      'INVALID_TEMPLATE'
    );
  }
}

/**
 * Parse <style> block
 */
function parseStyle(content: string, start: number): StyleBlock {
  // Defensive: validate inputs
  if (typeof content !== 'string') {
    throw new TypeError('parseStyle: content must be a string');
  }
  if (typeof start !== 'number') {
    throw new TypeError('parseStyle: start must be a number');
  }
  if (start < 0) {
    throw new CompilerError(
      'parseStyle: start position cannot be negative',
      undefined,
      undefined,
      'INVALID_POSITION'
    );
  }
  if (!Number.isFinite(start)) {
    throw new CompilerError(
      'parseStyle: start position must be finite',
      undefined,
      undefined,
      'INVALID_POSITION'
    );
  }

  const trimmedContent = content.trim();
  const end = start + content.length;

  // Defensive: validate end position
  if (end < start) {
    throw new CompilerError(
      'parseStyle: calculated end position is less than start',
      undefined,
      undefined,
      'INVALID_POSITION'
    );
  }

  return {
    type: 'StyleBlock',
    content: trimmedContent, // Safe to trim for styles
    scoped: true, // Default to scoped
    start,
    end
  };
}

/**
 * Convenience export
 */
export { filenameToComponentName };
