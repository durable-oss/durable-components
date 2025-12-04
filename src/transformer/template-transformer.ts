/**
 * Template Transformer
 *
 * Transforms template AST nodes into IR template representation
 */

import type {
  TemplateASTNode,
  ElementASTNode,
  TextASTNode,
  MustacheTagASTNode,
  IfBlockASTNode,
  EachBlockASTNode,
  KeyBlockASTNode,
  RenderBlockASTNode,
  ConstTagASTNode,
  HtmlTagASTNode,
  DebugTagASTNode
} from '../types/ast';
import type {
  TemplateNode,
  ElementNode,
  TextNode,
  ExpressionNode,
  IfNode,
  EachNode,
  KeyNode,
  RenderNode,
  ConstNode,
  HtmlNode,
  DebugNode,
  AttributeBinding
} from '../types/ir';

/**
 * Transform template AST nodes to IR template nodes
 */
export function transformTemplate(nodes: TemplateASTNode[]): TemplateNode {
  // Defensive: validate input
  if (!Array.isArray(nodes)) {
    throw new TypeError('transformTemplate: nodes must be an array');
  }

  // Defensive: validate array size to prevent DoS
  const MAX_NODES = 10000;
  if (nodes.length > MAX_NODES) {
    throw new Error(`transformTemplate: too many nodes (${nodes.length} > ${MAX_NODES})`);
  }

  // If multiple root nodes, wrap in a fragment (div)
  if (nodes.length === 0) {
    return {
      type: 'element',
      name: 'div',
      children: []
    };
  }

  if (nodes.length === 1) {
    // Defensive: validate single node
    if (!nodes[0] || typeof nodes[0] !== 'object') {
      throw new Error('transformTemplate: invalid node at index 0');
    }
    if (!nodes[0].type) {
      throw new Error('transformTemplate: node at index 0 missing type');
    }

    return transformNode(nodes[0]);
  }

  // Multiple roots - wrap in fragment
  // Defensive: validate each node before transforming
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (!node || typeof node !== 'object') {
      throw new Error(`transformTemplate: invalid node at index ${i}`);
    }
    if (!node.type) {
      throw new Error(`transformTemplate: node at index ${i} missing type`);
    }
  }

  return {
    type: 'element',
    name: 'div',
    children: nodes.map((node, index) => {
      try {
        return transformNode(node);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`transformTemplate: error transforming node at index ${index}: ${errorMessage}`);
      }
    })
  };
}

/**
 * Transform a single template node
 */
function transformNode(node: TemplateASTNode): TemplateNode {
  // Defensive: validate input
  if (!node || typeof node !== 'object') {
    throw new TypeError('transformNode: node must be an object');
  }
  if (!node.type || typeof node.type !== 'string') {
    throw new Error('transformNode: node missing valid type property');
  }

  try {
    switch (node.type) {
      case 'Element':
        return transformElement(node);
      case 'Text':
        return transformText(node);
      case 'MustacheTag':
        return transformMustacheTag(node);
      case 'IfBlock':
        return transformIfBlock(node);
      case 'EachBlock':
        return transformEachBlock(node);
      case 'KeyBlock':
        return transformKeyBlock(node);
      case 'Slot': {
        // Defensive: validate Slot node
        if (typeof node.name !== 'string') {
          throw new Error('transformNode: Slot node missing valid name');
        }
        const fallback = node.children && Array.isArray(node.children)
          ? node.children.map(transformNode)
          : [];
        return {
          type: 'slot',
          name: node.name,
          fallback,
          // For unist compatibility, use children field
          children: fallback
        };
      }
      case 'RenderBlock':
        return transformRenderBlock(node);
      case 'ConstTag':
        return transformConstTag(node);
      case 'HtmlTag':
        return transformHtmlTag(node);
      case 'DebugTag':
        return transformDebugTag(node);
      default:
        // Defensive: warn about unknown node type
        const unknownType = (node as any).type;
        console.warn(`transformNode: unknown node type "${unknownType}", falling back to empty text node`);
        return {
          type: 'text',
          content: ''
        };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`transformNode: error transforming ${node.type} node: ${errorMessage}`);
  }
}

/**
 * Transform element node
 */
function transformElement(node: ElementASTNode): ElementNode {
  const element: ElementNode = {
    type: 'element',
    name: node.name,
    children: node.children.map(transformNode)
  };

  // Transform attributes
  const attributes: AttributeBinding[] = [];
  const bindings: Record<string, string> = {};

  for (const attr of node.attributes) {
    if (attr.type === 'EventHandler') {
      // Event handler: on:click={handler} or on:click|preventDefault={handler}
      // Modifiers are now parsed by the parser
      const eventName = attr.name;
      const modifiers = attr.modifiers;

      const expr = extractExpression(attr.expression);
      attributes.push({
        name: `on:${eventName}`,
        value: `functions.${expr}`,
        modifiers: modifiers && modifiers.length > 0 ? modifiers : undefined
      });
    } else if (attr.type === 'Binding') {
      // Two-way binding: bind:value={name}
      const expr = extractExpression(attr.expression);
      attributes.push({
        name: `bind:${attr.name}`,
        value: `state.${expr}`
      });
    } else if (attr.type === 'Class') {
      // Class directive: class:active={isActive}
      const expr = extractExpression(attr.expression);
      attributes.push({
        name: `class:${attr.name}`,
        value: expr
      });
    } else if (attr.type === 'Attribute') {
      // Regular attribute
      if (attr.value && attr.value.length > 0) {
        const firstValue = attr.value[0];

        if (firstValue.type === 'Text') {
          // Static attribute
          bindings[attr.name] = `"${firstValue.data}"`;
        } else if (firstValue.type === 'MustacheTag') {
          // Dynamic attribute
          const expr = extractExpression(firstValue.expression);
          bindings[attr.name] = prefixExpression(expr);
        }
      }
    }
  }

  if (attributes.length > 0) {
    element.attributes = attributes;
  }

  if (Object.keys(bindings).length > 0) {
    element.bindings = bindings;
  }

  return element;
}

/**
 * Transform text node
 */
function transformText(node: TextASTNode): TextNode {
  // Defensive: validate input
  if (!node || typeof node !== 'object') {
    throw new TypeError('transformText: node must be an object');
  }
  if (node.type !== 'Text') {
    throw new Error(`transformText: expected Text node, got "${node.type}"`);
  }
  if (typeof node.data !== 'string') {
    throw new TypeError('transformText: node.data must be a string');
  }

  return {
    type: 'text',
    content: node.data
  };
}

/**
 * Transform mustache tag (expression)
 */
function transformMustacheTag(node: MustacheTagASTNode): ExpressionNode {
  const expr = extractExpression(node.expression);

  return {
    type: 'expression',
    expression: prefixExpression(expr)
  };
}

/**
 * Transform if block
 */
function transformIfBlock(node: IfBlockASTNode): IfNode {
  const condition = extractExpression(node.expression);

  const consequent = node.children.map(transformNode);
  const alternate = node.else ? node.else.children.map(transformNode) : undefined;

  const ifNode: IfNode = {
    type: 'if',
    condition: prefixExpression(condition),
    consequent,
    alternate,
    // For unist compatibility, combine consequent and alternate into children
    children: [...consequent, ...(alternate || [])]
  };

  return ifNode;
}

/**
 * Transform each block
 */
function transformEachBlock(node: EachBlockASTNode): EachNode {
  const expr = extractExpression(node.expression);

  return {
    type: 'each',
    expression: prefixExpression(expr),
    itemName: node.context,
    indexName: node.index,
    key: node.key ? extractExpression(node.key) : undefined,
    children: node.children.map(transformNode)
  };
}

/**
 * Transform render block
 */
function transformRenderBlock(node: RenderBlockASTNode): RenderNode {
  // Defensive: validate input
  if (!node || typeof node !== 'object') {
    throw new TypeError('transformRenderBlock: node must be an object');
  }
  if (node.type !== 'RenderBlock') {
    throw new Error(`transformRenderBlock: expected RenderBlock node, got "${node.type}"`);
  }
  if (typeof node.snippet !== 'string') {
    throw new TypeError('transformRenderBlock: node.snippet must be a string');
  }

  // Extract args expressions
  const args = node.args && Array.isArray(node.args)
    ? node.args.map((arg: any) => extractExpression(arg))
    : undefined;

  return {
    type: 'render',
    snippet: node.snippet,
    args
  };
}

/**
 * Extract expression string from AST node
 */
function extractExpression(node: any): string {
  if (!node) return '';
  if (typeof node !== 'object') return '';

  // Defensive: prevent infinite recursion
  const MAX_DEPTH = 50;
  const visited = new WeakSet<object>();

  function extract(n: any, depth: number = 0): string {
    if (!n || typeof n !== 'object') return '';

    // Defensive: prevent infinite recursion
    if (depth > MAX_DEPTH) {
      return '...';
    }

    // Defensive: prevent circular references
    if (visited.has(n)) {
      return '...';
    }
    visited.add(n);

    // Defensive: validate node type
    if (typeof n.type !== 'string') {
      return '';
    }

    // Handle Program node (Acorn wraps expressions in a Program)
    if (n.type === 'Program') {
      if (Array.isArray(n.body) && n.body.length > 0) {
        return extract(n.body[0], depth + 1);
      }
      return '';
    }

    // Handle simple identifier
    if (n.type === 'Identifier') {
      return typeof n.name === 'string' ? n.name : '';
    }

    // Handle chain expression (optional chaining)
    if (n.type === 'ChainExpression') {
      return extract(n.expression, depth + 1);
    }

    // Handle member expression
    if (n.type === 'MemberExpression') {
      const object = extract(n.object, depth + 1);
      const optional = n.optional ? '?.' : '.';
      const property = n.computed
        ? `[${extract(n.property, depth + 1)}]`
        : `${optional}${extract(n.property, depth + 1)}`;
      return object + property;
    }

    // Handle binary expression
    if (n.type === 'BinaryExpression') {
      const left = extract(n.left, depth + 1);
      const right = extract(n.right, depth + 1);
      const operator = typeof n.operator === 'string' ? n.operator : '?';
      return `${left} ${operator} ${right}`;
    }

    // Handle unary expression
    if (n.type === 'UnaryExpression') {
      const argument = extract(n.argument, depth + 1);
      const operator = typeof n.operator === 'string' ? n.operator : '?';
      // Operators like 'typeof', 'void', 'delete' need a space
      const needsSpace = /^[a-z]+$/.test(operator);
      return needsSpace ? `${operator} ${argument}` : `${operator}${argument}`;
    }

    // Handle literal
    if (n.type === 'Literal') {
      try {
        return JSON.stringify(n.value);
      } catch {
        return '';
      }
    }

    // Handle call expression
    if (n.type === 'CallExpression') {
      const callee = extract(n.callee, depth + 1);
      const optional = n.optional ? '?.' : '';
      const args = Array.isArray(n.arguments)
        ? n.arguments.map((arg: any) => extract(arg, depth + 1)).join(', ')
        : '';
      return `${callee}${optional}(${args})`;
    }

    // Handle arrow function
    if (n.type === 'ArrowFunctionExpression') {
      // For effects/derived, we want the body
      if (n.body && n.body.type === 'BlockStatement') {
        // Multi-statement function - extract source would be better
        return '() => { /* ... */ }';
      }
      return extract(n.body, depth + 1);
    }

    // Handle block statement
    if (n.type === 'BlockStatement') {
      // Return simplified version
      return '{ /* ... */ }';
    }

    // Handle expression statement
    if (n.type === 'ExpressionStatement') {
      return extract(n.expression, depth + 1);
    }

    // Handle update expression (++, --)
    if (n.type === 'UpdateExpression') {
      const argument = extract(n.argument, depth + 1);
      const operator = typeof n.operator === 'string' ? n.operator : '?';
      const prefix = typeof n.prefix === 'boolean' ? n.prefix : false;
      return prefix ? `${operator}${argument}` : `${argument}${operator}`;
    }

    // Handle conditional expression (ternary)
    if (n.type === 'ConditionalExpression') {
      const test = extract(n.test, depth + 1);
      const consequent = extract(n.consequent, depth + 1);
      const alternate = extract(n.alternate, depth + 1);
      return `${test} ? ${consequent} : ${alternate}`;
    }

    // Handle logical expression (&&, ||, ??)
    if (n.type === 'LogicalExpression') {
      const left = extract(n.left, depth + 1);
      const right = extract(n.right, depth + 1);
      const operator = typeof n.operator === 'string' ? n.operator : '?';
      return `${left} ${operator} ${right}`;
    }

    // Handle template literal
    if (n.type === 'TemplateLiteral') {
      const quasis = Array.isArray(n.quasis) ? n.quasis : [];
      const expressions = Array.isArray(n.expressions) ? n.expressions : [];

      let result = '`';
      for (let i = 0; i < quasis.length; i++) {
        const quasi = quasis[i];
        // Add the raw string value
        if (quasi && typeof quasi.value === 'object' && typeof quasi.value.raw === 'string') {
          result += quasi.value.raw;
        } else if (quasi && typeof quasi.value === 'object' && typeof quasi.value.cooked === 'string') {
          result += quasi.value.cooked;
        }

        // Add the expression if there is one
        if (i < expressions.length && expressions[i]) {
          result += '${' + extract(expressions[i], depth + 1) + '}';
        }
      }
      result += '`';
      return result;
    }

    // Handle array expression
    if (n.type === 'ArrayExpression') {
      const elements = Array.isArray(n.elements)
        ? n.elements.map((el: any) => el ? extract(el, depth + 1) : '').join(', ')
        : '';
      return `[${elements}]`;
    }

    // Handle object expression
    if (n.type === 'ObjectExpression') {
      const properties = Array.isArray(n.properties)
        ? n.properties.map((prop: any) => {
            if (!prop) return '';
            if (prop.type === 'Property') {
              const key = prop.key ? extract(prop.key, depth + 1) : '';
              const value = prop.value ? extract(prop.value, depth + 1) : '';
              return `${key}: ${value}`;
            }
            return '';
          }).filter(Boolean).join(', ')
        : '';
      return `{${properties}}`;
    }

    // Fallback
    return '';
  }

  return extract(node);
}

/**
 * Add proper prefix (state./props./derived.) to expressions
 */
function prefixExpression(expr: string): string {
  // Defensive: validate input
  if (typeof expr !== 'string') {
    throw new TypeError('prefixExpression: expr must be a string');
  }

  // This is a simplified version
  // In a real implementation, we'd need to track which identifiers
  // are state vs props vs derived

  // For now, assume if it's a simple identifier, it's state
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(expr)) {
    // Could be state, props, or derived
    // We'll handle this during code generation
    return expr;
  }

  return expr;
}

/**
 * Transform {@const} tag
 */
function transformConstTag(node: ConstTagASTNode): ConstNode {
  return {
    type: 'const',
    name: node.name,
    expression: extractExpression(node.expression)
  };
}

/**
 * Transform {@html} tag
 */
function transformHtmlTag(node: HtmlTagASTNode): HtmlNode {
  return {
    type: 'html',
    expression: extractExpression(node.expression)
  };
}

/**
 * Transform {@debug} tag
 */
function transformDebugTag(node: DebugTagASTNode): DebugNode {
  return {
    type: 'debug',
    identifiers: node.identifiers
  };
}

/**
 * Transform {#key} block
 */
function transformKeyBlock(node: KeyBlockASTNode): KeyNode {
  const children = node.children.map(transformNode);

  return {
    type: 'key',
    expression: extractExpression(node.expression),
    children
  };
}
