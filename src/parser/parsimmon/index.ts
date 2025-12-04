/**
 * Main Parsimmon-based template parser
 * Combines all parsers into a complete template parser
 */

import * as P from 'parsimmon';
import type { TemplateASTNode } from '../../types/ast';
import { CompilerError } from '../../types/compiler';

// Import all parsers
import { textNode, mustacheTag, commentNode } from './basic-nodes';
import { renderBlock, constTag, htmlTag, debugTag } from './directives';
import { ifBlock, eachBlock, keyBlock, setTemplateNodeParser as setBlockTemplateNode } from './blocks';
import { element, setTemplateNodeParser as setElementTemplateNode } from './elements';

const optWhitespace = P.optWhitespace;

/**
 * Main template node parser
 * Tries to parse any type of template node
 */
const templateNode: P.Parser<TemplateASTNode> = P.lazy(() =>
  P.alt<TemplateASTNode>(
    commentNode,  // Try comments before elements (since both start with <)
    ifBlock,
    eachBlock,
    keyBlock,
    renderBlock,
    constTag,
    htmlTag,
    debugTag,
    element,
    mustacheTag,
    textNode
  )
);

// Set up the forward references for blocks and elements
setBlockTemplateNode(templateNode);
setElementTemplateNode(templateNode);

/**
 * Main template parser
 * Parses a complete template into an array of nodes
 */
const templateParser: P.Parser<TemplateASTNode[]> =
  optWhitespace
    .then(templateNode.sepBy(optWhitespace))
    .skip(optWhitespace);

/**
 * Parse template content into AST nodes
 */
export function parseTemplate(input: string): TemplateASTNode[] {
  if (typeof input !== 'string') {
    throw new TypeError('parseTemplate: input must be a string');
  }

  const trimmedInput = input.trim();

  if (trimmedInput.length === 0) {
    return [];
  }

  const result = templateParser.parse(trimmedInput);

  if (result.status) {
    return result.value;
  } else {
    throw new CompilerError(
      `Parse error at index ${result.index.offset}: ${result.expected.join(', ')}`,
      { line: result.index.line - 1, column: result.index.column - 1 },
      undefined,
      'PARSE_ERROR'
    );
  }
}
