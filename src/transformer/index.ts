/**
 * Phase 2: Transformer
 *
 * Transforms the D-AST into the canonical JSON Intermediate Representation (IR).
 * This is the "Durable core" that performs analysis and linking, creating a
 * completely framework-agnostic representation of the component.
 */

import type { DurableComponentAST } from '../types/ast';
import type { DurableComponentIR, TemplateNode, RefDefinition } from '../types/ir';
import { createEmptyIR } from '../types/ir';
import { filenameToComponentName } from '../utils/string';
import { extractRunesFromScript } from './script-analyzer';
import { transformTemplate } from './template-transformer';

/**
 * Transform D-AST to IR
 */
export function transform(ast: DurableComponentAST): DurableComponentIR {
  // Defensive: validate input
  if (!ast || typeof ast !== 'object') {
    throw new TypeError('transform: ast must be an object');
  }
  if (ast.type !== 'DurableComponent') {
    throw new Error(`transform: invalid ast type "${ast.type}", expected "DurableComponent"`);
  }
  if (!ast.meta || typeof ast.meta !== 'object') {
    throw new Error('transform: ast missing meta property');
  }
  if (typeof ast.meta.filename !== 'string') {
    throw new TypeError('transform: ast.meta.filename must be a string');
  }
  if (typeof ast.meta.source !== 'string') {
    throw new TypeError('transform: ast.meta.source must be a string');
  }

  const componentName = filenameToComponentName(ast.meta.filename);

  // Defensive: validate component name
  if (!componentName || componentName.length === 0) {
    throw new Error('transform: failed to extract valid component name from filename');
  }

  const ir = createEmptyIR(componentName);

  // Defensive: validate IR creation
  if (!ir || typeof ir !== 'object') {
    throw new Error('transform: failed to create empty IR');
  }

  // Add metadata
  ir.meta = {
    sourceFile: ast.meta.filename,
    originalSource: ast.meta.source
  };

  // Extract and analyze script block (runes, functions, etc.)
  if (ast.script) {
    // Defensive: validate script block
    if (typeof ast.script !== 'object') {
      throw new TypeError('transform: ast.script must be an object');
    }
    if (ast.script.type !== 'ScriptBlock') {
      throw new Error(`transform: invalid script type "${ast.script.type}"`);
    }

    // Extract lang attribute
    if (ast.script.lang) {
      ir.lang = ast.script.lang;
    }

    const scriptAnalysis = extractRunesFromScript(ast.script);

    // Defensive: validate script analysis result
    if (!scriptAnalysis || typeof scriptAnalysis !== 'object') {
      throw new Error('transform: extractRunesFromScript returned invalid result');
    }
    if (!Array.isArray(scriptAnalysis.imports)) {
      throw new Error('transform: scriptAnalysis.imports must be an array');
    }
    if (!Array.isArray(scriptAnalysis.props)) {
      throw new Error('transform: scriptAnalysis.props must be an array');
    }
    if (!Array.isArray(scriptAnalysis.state)) {
      throw new Error('transform: scriptAnalysis.state must be an array');
    }
    if (!Array.isArray(scriptAnalysis.derived)) {
      throw new Error('transform: scriptAnalysis.derived must be an array');
    }
    if (!Array.isArray(scriptAnalysis.effects)) {
      throw new Error('transform: scriptAnalysis.effects must be an array');
    }
    if (!Array.isArray(scriptAnalysis.functions)) {
      throw new Error('transform: scriptAnalysis.functions must be an array');
    }

    ir.imports = scriptAnalysis.imports;
    ir.types = scriptAnalysis.types;
    ir.props = scriptAnalysis.props;
    ir.state = scriptAnalysis.state;
    ir.derived = scriptAnalysis.derived;
    ir.effects = scriptAnalysis.effects;
    ir.functions = scriptAnalysis.functions;
  }

  // Transform template
  if (ast.template) {
    // Defensive: validate template block
    if (typeof ast.template !== 'object') {
      throw new TypeError('transform: ast.template must be an object');
    }
    if (ast.template.type !== 'TemplateBlock') {
      throw new Error(`transform: invalid template type "${ast.template.type}"`);
    }
    if (!Array.isArray(ast.template.children)) {
      throw new Error('transform: ast.template.children must be an array');
    }

    const { template: transformedTemplate, snippets } = transformTemplate(ast.template.children);

    // Defensive: validate transformed template
    if (!transformedTemplate || typeof transformedTemplate !== 'object') {
      throw new Error('transform: transformTemplate returned invalid result');
    }
    if (!transformedTemplate.type) {
      throw new Error('transform: transformed template missing type property');
    }

    ir.template = transformedTemplate;
    ir.snippets = snippets;

    // Extract refs from template (bind:this directives)
    ir.refs = extractRefsFromTemplate(ir.template);
  }

  // Extract styles
  if (ast.style) {
    // Defensive: validate style block
    if (typeof ast.style !== 'object') {
      throw new TypeError('transform: ast.style must be an object');
    }
    if (ast.style.type !== 'StyleBlock') {
      throw new Error(`transform: invalid style type "${ast.style.type}"`);
    }
    if (typeof ast.style.content !== 'string') {
      throw new TypeError('transform: ast.style.content must be a string');
    }

    ir.styles = ast.style.content;
  }

  // Defensive: validate final IR structure
  if (!ir.name || typeof ir.name !== 'string') {
    throw new Error('transform: final IR missing valid name');
  }
  if (!ir.meta || typeof ir.meta !== 'object') {
    throw new Error('transform: final IR missing meta');
  }

  return ir;
}

/**
 * Extract element references (bind:this) from template tree
 */
function extractRefsFromTemplate(template: TemplateNode): RefDefinition[] {
  const refs = new Set<string>();

  function walk(node: TemplateNode): void {
    if (!node || typeof node !== 'object') return;

    // Check if this is an element node with attributes
    if (node.type === 'element' && 'attributes' in node) {
      const element = node as any;
      if (Array.isArray(element.attributes)) {
        for (const attr of element.attributes) {
          if (attr && attr.name === 'bind:this' && typeof attr.value === 'string') {
            // Extract ref name from value (remove 'state.' prefix if present)
            const refName = attr.value.replace(/^state\./, '');
            refs.add(refName);
          }
        }
      }

      // Walk children
      if (Array.isArray(element.children)) {
        for (const child of element.children) {
          walk(child);
        }
      }
    }

    // Walk children for nodes with children property
    if ('children' in node && Array.isArray((node as any).children)) {
      for (const child of (node as any).children) {
        walk(child);
      }
    }

    // Walk consequent and alternate for if nodes
    if (node.type === 'if') {
      const ifNode = node as any;
      if (Array.isArray(ifNode.consequent)) {
        for (const child of ifNode.consequent) {
          walk(child);
        }
      }
      if (Array.isArray(ifNode.alternate)) {
        for (const child of ifNode.alternate) {
          walk(child);
        }
      }
    }
  }

  walk(template);

  return Array.from(refs).map(name => ({ name }));
}
