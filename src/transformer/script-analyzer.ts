/**
 * Script Analyzer
 *
 * Analyzes the JavaScript AST from the <script> block to extract
 * Runes ($state, $props, $derived, $effect) and functions.
 */

import type { Node } from 'acorn';
import type {
  PropDefinition,
  StateDefinition,
  DerivedDefinition,
  EffectDefinition,
  FunctionDefinition,
  ImportDefinition
} from '../types/ir';
import type { ScriptBlock } from '../types/ast';
import { CompilerError } from '../types/compiler';

interface ScriptAnalysis {
  imports: ImportDefinition[];
  props: PropDefinition[];
  state: StateDefinition[];
  derived: DerivedDefinition[];
  effects: EffectDefinition[];
  functions: FunctionDefinition[];
}

/**
 * Extract runes and functions from script AST
 */
export function extractRunesFromScript(script: ScriptBlock): ScriptAnalysis {
  // Defensive: validate input
  if (!script || typeof script !== 'object') {
    throw new TypeError('extractRunesFromScript: script must be an object');
  }
  if (script.type !== 'ScriptBlock') {
    throw new Error(`extractRunesFromScript: invalid script type "${script.type}"`);
  }
  if (!script.ast || typeof script.ast !== 'object') {
    throw new Error('extractRunesFromScript: script missing valid ast property');
  }
  if (typeof script.content !== 'string') {
    throw new TypeError('extractRunesFromScript: script.content must be a string');
  }

  const analysis: ScriptAnalysis = {
    imports: [],
    props: [],
    state: [],
    derived: [],
    effects: [],
    functions: []
  };

  const ast = script.ast as any;

  // Defensive: validate AST type
  if (ast.type !== 'Program') {
    throw new Error(`extractRunesFromScript: expected Program AST, got "${ast.type}"`);
  }
  if (!ast.body) {
    // Empty body is valid
    return analysis;
  }
  if (!Array.isArray(ast.body)) {
    throw new Error('extractRunesFromScript: ast.body must be an array');
  }

  // Walk through the program body
  for (let i = 0; i < ast.body.length; i++) {
    const node = ast.body[i];

    // Defensive: validate node
    if (!node || typeof node !== 'object') {
      throw new Error(`extractRunesFromScript: invalid node at index ${i}`);
    }
    if (!node.type) {
      throw new Error(`extractRunesFromScript: node at index ${i} missing type`);
    }

    analyzeNode(node, analysis, script.content);
  }

  return analysis;
}

/**
 * Analyze a single AST node
 */
function analyzeNode(node: any, analysis: ScriptAnalysis, source: string): void {
  // Import declaration
  if (node.type === 'ImportDeclaration') {
    analyzeImportDeclaration(node, analysis, source);
    return;
  }

  // Variable declaration: let/const
  if (node.type === 'VariableDeclaration') {
    for (const declarator of node.declarations) {
      analyzeVariableDeclarator(declarator, analysis, source);
    }
    return;
  }

  // Function declaration
  if (node.type === 'FunctionDeclaration') {
    analyzeFunctionDeclaration(node, analysis, source);
    return;
  }

  // Expression statement (for $effect calls)
  if (node.type === 'ExpressionStatement') {
    if (node.expression.type === 'CallExpression') {
      const callee = node.expression.callee;
      if (callee.type === 'Identifier' && callee.name === '$effect') {
        analyzeEffect(node.expression, analysis, source);
      }
    }
    return;
  }
}

/**
 * Analyze variable declarator for runes
 */
function analyzeVariableDeclarator(node: any, analysis: ScriptAnalysis, source: string): void {
  const init = node.init;

  // Check for $props() destructuring: let { name = 'default' } = $props()
  if (
    node.id.type === 'ObjectPattern' &&
    init?.type === 'CallExpression' &&
    init.callee?.type === 'Identifier' &&
    init.callee.name === '$props'
  ) {
    analyzePropsPattern(node.id, analysis, source);
    return;
  }

  // Check for $state(): let count = $state(0)
  if (
    init?.type === 'CallExpression' &&
    init.callee?.type === 'Identifier' &&
    init.callee.name === '$state'
  ) {
    const name = getIdentifierName(node.id);
    const initialValue = getExpressionSource(init.arguments[0], source);

    analysis.state.push({
      name,
      initialValue: initialValue || 'undefined'
    });
    return;
  }

  // Check for $derived(): let doubled = $derived(count * 2)
  if (
    init?.type === 'CallExpression' &&
    init.callee?.type === 'Identifier' &&
    init.callee.name === '$derived'
  ) {
    const name = getIdentifierName(node.id);
    const expression = getExpressionSource(init.arguments[0], source);
    const dependencies = extractDependencies(init.arguments[0], analysis);

    analysis.derived.push({
      name,
      expression: expression || 'undefined',
      dependencies
    });
    return;
  }
}

/**
 * Analyze $props() destructuring pattern
 */
function analyzePropsPattern(pattern: any, analysis: ScriptAnalysis, source: string): void {
  if (pattern.type !== 'ObjectPattern') return;

  for (const property of pattern.properties) {
    if (property.type === 'Property') {
      const name = getIdentifierName(property.key);
      let defaultValue: string | undefined;

      // Check for default value in destructuring
      if (property.value.type === 'AssignmentPattern') {
        defaultValue = getExpressionSource(property.value.right, source);
      }

      analysis.props.push({
        name,
        defaultValue
      });
    }
  }
}

/**
 * Analyze $effect() call
 */
function analyzeEffect(node: any, analysis: ScriptAnalysis, source: string): void {
  const callback = node.arguments[0];

  if (!callback) return;

  let expression = '';

  // Extract function body
  if (callback.type === 'ArrowFunctionExpression' || callback.type === 'FunctionExpression') {
    if (callback.body.type === 'BlockStatement') {
      expression = getExpressionSource(callback.body, source);
    } else {
      expression = getExpressionSource(callback.body, source);
    }
  }

  const dependencies = extractDependencies(callback, analysis);

  analysis.effects.push({
    expression,
    dependencies
  });
}

/**
 * Analyze function declaration
 */
function analyzeFunctionDeclaration(node: any, analysis: ScriptAnalysis, source: string): void {
  const name = node.id?.name;
  if (!name) return;

  const params = node.params.map((param: any) => getIdentifierName(param));
  const body = getExpressionSource(node.body, source);

  analysis.functions.push({
    name,
    params,
    body
  });
}

/**
 * Extract dependencies from an AST node
 *
 * This performs a simple walk to find identifiers that match state/prop names
 */
function extractDependencies(node: any, analysis: ScriptAnalysis): string[] {
  // Defensive: validate inputs
  if (!analysis || typeof analysis !== 'object') {
    throw new TypeError('extractDependencies: analysis must be an object');
  }
  if (!Array.isArray(analysis.state)) {
    throw new Error('extractDependencies: analysis.state must be an array');
  }
  if (!Array.isArray(analysis.props)) {
    throw new Error('extractDependencies: analysis.props must be an array');
  }

  const dependencies = new Set<string>();

  const stateNames = new Set(analysis.state.map((s) => {
    // Defensive: validate state item
    if (!s || typeof s !== 'object' || typeof s.name !== 'string') {
      return '';
    }
    return s.name;
  }).filter(name => name.length > 0));

  const propNames = new Set(analysis.props.map((p) => {
    // Defensive: validate prop item
    if (!p || typeof p !== 'object' || typeof p.name !== 'string') {
      return '';
    }
    return p.name;
  }).filter(name => name.length > 0));

  // Defensive: prevent infinite recursion
  const MAX_DEPTH = 100;
  const visited = new WeakSet<object>();

  function walk(n: any, depth: number = 0): void {
    if (!n || typeof n !== 'object') return;

    // Defensive: prevent infinite recursion
    if (depth > MAX_DEPTH) {
      throw new Error('extractDependencies: maximum recursion depth exceeded');
    }

    // Defensive: prevent circular references
    if (visited.has(n)) {
      return;
    }
    visited.add(n);

    if (n.type === 'Identifier') {
      // Defensive: validate identifier name
      if (typeof n.name === 'string' && n.name.length > 0) {
        if (stateNames.has(n.name) || propNames.has(n.name)) {
          dependencies.add(n.name);
        }
      }
    }

    for (const key in n) {
      if (key === 'start' || key === 'end' || key === 'loc') continue;
      const value = n[key];

      if (Array.isArray(value)) {
        // Defensive: limit array size to prevent DoS
        const MAX_ARRAY_SIZE = 10000;
        if (value.length > MAX_ARRAY_SIZE) {
          throw new Error(`extractDependencies: array too large (${value.length} > ${MAX_ARRAY_SIZE})`);
        }
        value.forEach(item => walk(item, depth + 1));
      } else if (value && typeof value === 'object') {
        walk(value, depth + 1);
      }
    }
  }

  try {
    walk(node);
  } catch (error) {
    // Defensive: handle recursion errors gracefully
    if (error instanceof Error && error.message.includes('recursion')) {
      throw error;
    }
    // For other errors, return what we have so far
    console.warn('extractDependencies: error during walk:', error);
  }

  return Array.from(dependencies);
}

/**
 * Get identifier name from pattern
 */
function getIdentifierName(node: any): string {
  // Defensive: validate input
  if (!node || typeof node !== 'object') {
    return 'unknown';
  }
  if (node.type === 'Identifier') {
    // Defensive: validate name property
    if (typeof node.name !== 'string') {
      return 'unknown';
    }
    if (node.name.length === 0) {
      return 'unknown';
    }
    return node.name;
  }
  return 'unknown';
}

/**
 * Get source code for an expression node
 */
function getExpressionSource(node: any, source: string): string {
  // Defensive: validate inputs
  if (typeof source !== 'string') {
    throw new TypeError('getExpressionSource: source must be a string');
  }

  if (!node) return '';
  if (typeof node !== 'object') return '';

  // Defensive: validate start and end positions
  if (node.start !== undefined && node.end !== undefined) {
    if (typeof node.start !== 'number' || typeof node.end !== 'number') {
      return '';
    }
    if (node.start < 0 || node.end < 0) {
      return '';
    }
    if (node.start > node.end) {
      return '';
    }
    if (node.end > source.length) {
      return '';
    }

    return source.slice(node.start, node.end).trim();
  }

  // Fallback for literals
  if (node.type === 'Literal') {
    try {
      return JSON.stringify(node.value);
    } catch (error) {
      // Defensive: handle non-serializable values
      return '';
    }
  }

  return '';
}

/**
 * Analyze import declaration
 */
function analyzeImportDeclaration(node: any, analysis: ScriptAnalysis, source: string): void {
  // Defensive: validate node
  if (!node || typeof node !== 'object') {
    return;
  }
  if (node.type !== 'ImportDeclaration') {
    return;
  }
  if (!node.source || typeof node.source.value !== 'string') {
    return;
  }

  const importDef: ImportDefinition = {
    source: node.source.value,
    specifiers: []
  };

  // Process import specifiers
  if (Array.isArray(node.specifiers)) {
    for (const specifier of node.specifiers) {
      if (!specifier || typeof specifier !== 'object') continue;

      if (specifier.type === 'ImportDefaultSpecifier') {
        // Default import: import Foo from './foo'
        importDef.specifiers.push({
          type: 'default',
          local: specifier.local?.name || 'unknown'
        });
      } else if (specifier.type === 'ImportSpecifier') {
        // Named import: import { foo, bar as baz } from './foo'
        importDef.specifiers.push({
          type: 'named',
          local: specifier.local?.name || 'unknown',
          imported: specifier.imported?.name || specifier.local?.name || 'unknown'
        });
      } else if (specifier.type === 'ImportNamespaceSpecifier') {
        // Namespace import: import * as foo from './foo'
        importDef.specifiers.push({
          type: 'namespace',
          local: specifier.local?.name || 'unknown'
        });
      }
    }
  }

  analysis.imports.push(importDef);
}
