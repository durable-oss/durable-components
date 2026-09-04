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
  SnippetBlockASTNode,
  RenderBlockASTNode,
  ConstTagASTNode,
  HtmlTagASTNode,
  DebugTagASTNode,
  CommentASTNode
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
  CommentNode,
  AttributeBinding,
  SnippetDefinition
} from '../types/ir';
import { getDcePlugin } from './dce-elements';
import { parseExpression } from '../parser/parsimmon/utils';

/**
 * Context for collecting snippets during transformation
 */
export interface TransformContext {
  snippets: SnippetDefinition[];
  transformNode: (node: TemplateASTNode, context: TransformContext) => TemplateNode;
}

/**
 * Transform template AST nodes to IR template nodes
 * Returns both the template and any snippets found
 */
export function transformTemplate(nodes: TemplateASTNode[]): { template: TemplateNode; snippets: SnippetDefinition[] } {
  // Defensive: validate input
  if (!Array.isArray(nodes)) {
    throw new TypeError('transformTemplate: nodes must be an array');
  }

  // Defensive: validate array size to prevent DoS
  const MAX_NODES = 10000;
  if (nodes.length > MAX_NODES) {
    throw new Error(`transformTemplate: too many nodes (${nodes.length} > ${MAX_NODES})`);
  }

  const context: TransformContext = { snippets: [], transformNode };

  // Separate snippet definitions from regular template nodes
  const templateNodes = nodes.filter(node => node.type !== 'SnippetBlock');
  const snippetNodes = nodes.filter(node => node.type === 'SnippetBlock') as SnippetBlockASTNode[];

  // Process snippets
  for (const snippetNode of snippetNodes) {
    const snippet: SnippetDefinition = {
      name: snippetNode.name,
      params: snippetNode.params,
      template: snippetNode.children.map(child => transformNode(child, context))
    };
    context.snippets.push(snippet);
  }

  // If multiple root nodes, wrap in a fragment (div)
  if (templateNodes.length === 0) {
    return {
      template: {
        type: 'element',
        name: 'div',
        children: []
      },
      snippets: context.snippets
    };
  }

  if (templateNodes.length === 1) {
    // Defensive: validate single node
    if (!templateNodes[0] || typeof templateNodes[0] !== 'object') {
      throw new Error('transformTemplate: invalid node at index 0');
    }
    if (!templateNodes[0].type) {
      throw new Error('transformTemplate: node at index 0 missing type');
    }

    return {
      template: transformNode(templateNodes[0], context),
      snippets: context.snippets
    };
  }

  // Multiple roots - wrap in fragment
  // Defensive: validate each node before transforming
  for (let i = 0; i < templateNodes.length; i++) {
    const node = templateNodes[i];
    if (!node || typeof node !== 'object') {
      throw new Error(`transformTemplate: invalid node at index ${i}`);
    }
    if (!node.type) {
      throw new Error(`transformTemplate: node at index ${i} missing type`);
    }
  }

  return {
    template: {
      type: 'element',
      name: 'div',
      children: templateNodes.map((node, index) => {
        try {
          return transformNode(node, context);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          throw new Error(`transformTemplate: error transforming node at index ${index}: ${errorMessage}`);
        }
      })
    },
    snippets: context.snippets
  };
}

/**
 * Transform a single template node
 */
function transformNode(node: TemplateASTNode, context: TransformContext): TemplateNode {
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
        return transformElement(node, context);
      case 'Text':
        return transformText(node);
      case 'MustacheTag':
        return transformMustacheTag(node);
      case 'IfBlock':
        return transformIfBlock(node, context);
      case 'EachBlock':
        return transformEachBlock(node, context);
      case 'KeyBlock':
        return transformKeyBlock(node, context);
      case 'Slot': {
        // Defensive: validate Slot node
        if (typeof node.name !== 'string') {
          throw new Error('transformNode: Slot node missing valid name');
        }
        const fallback = node.children && Array.isArray(node.children)
          ? node.children.map(child => transformNode(child, context))
          : [];
        return {
          type: 'slot',
          name: node.name,
          fallback,
          // For unist compatibility, use children field
          children: fallback
        };
      }
      case 'SnippetBlock': {
        // Nested snippets should be collected in context
        const snippetNode = node as SnippetBlockASTNode;
        const snippet: SnippetDefinition = {
          name: snippetNode.name,
          params: snippetNode.params,
          template: snippetNode.children.map(child => transformNode(child, context))
        };
        context.snippets.push(snippet);
        // Return empty text node as placeholder
        return {
          type: 'text',
          content: ''
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
      case 'DceElement': {
        // Handle dce: elements through plugin system
        const dceNode = node as any; // DceElementASTNode
        const plugin = getDcePlugin(dceNode.kind);
        if (!plugin) {
          throw new Error(`No plugin found for dce:${dceNode.kind}`);
        }
        return plugin.transform(dceNode, context);
      }
      case 'Comment':
        return transformComment(node);
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
function transformElement(node: ElementASTNode, context: TransformContext): ElementNode {
  const element: ElementNode = {
    type: 'element',
    name: node.name,
    children: node.children.map(child => transformNode(child, context))
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
      // A bare reference (e.g. `increment`) is a function name and gets the
      // `functions.` prefix so generators resolve it. An inline arrow/function
      // expression (e.g. `(e) => setSource(e.target.value)`) is emitted as-is —
      // prefixing it would corrupt the handler.
      const isInlineFunction = isFunctionExpression(attr.expression);
      attributes.push({
        name: `on:${eventName}`,
        value: isInlineFunction ? expr : `functions.${expr}`,
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
          // Static attribute — but the text may interpolate expressions, e.g.
          // class="base {cond ? 'x' : ''}". Convert those to a template literal
          // so the expression actually evaluates on every target.
          if (containsInterpolation(firstValue.data)) {
            bindings[attr.name] = interpolatedTextToTemplateLiteral(firstValue.data);
          } else {
            bindings[attr.name] = `"${firstValue.data}"`;
          }
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
 * Transform comment node
 */
function transformComment(node: CommentASTNode): CommentNode {
  // Defensive: validate input
  if (!node || typeof node !== 'object') {
    throw new TypeError('transformComment: node must be an object');
  }
  if (node.type !== 'Comment') {
    throw new Error(`transformComment: expected Comment node, got "${node.type}"`);
  }
  if (typeof node.data !== 'string') {
    throw new TypeError('transformComment: node.data must be a string');
  }

  return {
    type: 'comment',
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
function transformIfBlock(node: IfBlockASTNode, context: TransformContext): IfNode {
  const condition = extractExpression(node.expression);

  const consequent = node.children.map(child => transformNode(child, context));
  const alternate = node.else ? node.else.children.map(child => transformNode(child, context)) : undefined;

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
function transformEachBlock(node: EachBlockASTNode, context: TransformContext): EachNode {
  const expr = extractExpression(node.expression);

  return {
    type: 'each',
    expression: prefixExpression(expr),
    itemName: node.context,
    indexName: node.index,
    key: node.key ? extractExpression(node.key) : undefined,
    children: node.children.map(child => transformNode(child, context))
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
 * Determine whether an expression AST is an inline function (arrow or
 * function expression), unwrapping Acorn's Program/ExpressionStatement/Chain
 * wrappers first.
 */
export function isFunctionExpression(node: any): boolean {
  let n = node;
  let guard = 0;
  while (n && typeof n === 'object' && guard++ < 50) {
    if (n.type === 'Program') {
      n = Array.isArray(n.body) && n.body.length > 0 ? n.body[0] : null;
      continue;
    }
    if (n.type === 'ExpressionStatement') {
      n = n.expression;
      continue;
    }
    if (n.type === 'ChainExpression') {
      n = n.expression;
      continue;
    }
    return n.type === 'ArrowFunctionExpression' || n.type === 'FunctionExpression';
  }
  return false;
}

/**
 * Extract expression string from AST node
 */
export function extractExpression(node: any): string {
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

    // Handle await expression (await foo()) — without this, an awaited
    // statement serializes to '' and is silently dropped from a block body.
    if (n.type === 'AwaitExpression') {
      return `await ${extract(n.argument, depth + 1)}`;
    }

    // Handle yield expression (yield / yield* foo)
    if (n.type === 'YieldExpression') {
      const star = n.delegate ? '*' : '';
      const arg = n.argument ? ` ${extract(n.argument, depth + 1)}` : '';
      return `yield${star}${arg}`;
    }

    // Handle arrow function
    if (n.type === 'ArrowFunctionExpression') {
      const params = extractParams(n.params, depth);
      const asyncPrefix = n.async ? 'async ' : '';
      if (n.body && n.body.type === 'BlockStatement') {
        return `${asyncPrefix}(${params}) => ${extract(n.body, depth + 1)}`;
      }
      // Expression body. Wrap object-literal bodies in parens so they aren't
      // mistaken for a block: () => ({ ... })
      const body = extract(n.body, depth + 1);
      const wrappedBody = n.body && n.body.type === 'ObjectExpression' ? `(${body})` : body;
      return `${asyncPrefix}(${params}) => ${wrappedBody}`;
    }

    // Handle function expression
    if (n.type === 'FunctionExpression') {
      const params = extractParams(n.params, depth);
      const asyncPrefix = n.async ? 'async ' : '';
      const name = n.id && typeof n.id.name === 'string' ? ` ${n.id.name}` : '';
      const body = n.body ? extract(n.body, depth + 1) : '{}';
      return `${asyncPrefix}function${name}(${params}) ${body}`;
    }

    // Handle block statement
    if (n.type === 'BlockStatement') {
      const statements = Array.isArray(n.body)
        ? n.body.map((stmt: any) => extract(stmt, depth + 1)).filter(Boolean)
        : [];
      if (statements.length === 0) {
        return '{}';
      }
      return `{ ${statements.map((s: string) => (s.endsWith(';') || s.endsWith('}') ? s : `${s};`)).join(' ')} }`;
    }

    // Handle assignment expression (a = b, a += b, etc.)
    if (n.type === 'AssignmentExpression') {
      const left = extract(n.left, depth + 1);
      const right = extract(n.right, depth + 1);
      const operator = typeof n.operator === 'string' ? n.operator : '=';
      return `${left} ${operator} ${right}`;
    }

    // Handle sequence expression (a, b, c)
    if (n.type === 'SequenceExpression') {
      const expressions = Array.isArray(n.expressions)
        ? n.expressions.map((e: any) => extract(e, depth + 1)).filter(Boolean)
        : [];
      return expressions.join(', ');
    }

    // Handle new expression (new Foo(args))
    if (n.type === 'NewExpression') {
      const callee = extract(n.callee, depth + 1);
      const args = Array.isArray(n.arguments)
        ? n.arguments.map((arg: any) => extract(arg, depth + 1)).join(', ')
        : '';
      return `new ${callee}(${args})`;
    }

    // Handle spread element (...args)
    if (n.type === 'SpreadElement' || n.type === 'RestElement') {
      return `...${extract(n.argument, depth + 1)}`;
    }

    // Handle return statement
    if (n.type === 'ReturnStatement') {
      return n.argument ? `return ${extract(n.argument, depth + 1)}` : 'return';
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

  /**
   * Serialize a function parameter list (handles identifiers, defaults,
   * destructuring, and rest params).
   */
  function extractParams(params: any[], depth: number): string {
    if (!Array.isArray(params)) return '';
    return params.map((p) => extractParam(p, depth + 1)).join(', ');
  }

  function extractParam(p: any, depth: number): string {
    if (!p || typeof p !== 'object') return '';
    if (depth > MAX_DEPTH) return '...';

    switch (p.type) {
      case 'Identifier':
        return typeof p.name === 'string' ? p.name : '';
      case 'AssignmentPattern':
        return `${extractParam(p.left, depth + 1)} = ${extract(p.right, depth + 1)}`;
      case 'RestElement':
        return `...${extractParam(p.argument, depth + 1)}`;
      case 'ArrayPattern': {
        const elements = Array.isArray(p.elements)
          ? p.elements.map((el: any) => (el ? extractParam(el, depth + 1) : '')).join(', ')
          : '';
        return `[${elements}]`;
      }
      case 'ObjectPattern': {
        const props = Array.isArray(p.properties)
          ? p.properties
              .map((prop: any) => {
                if (!prop) return '';
                if (prop.type === 'RestElement') {
                  return `...${extractParam(prop.argument, depth + 1)}`;
                }
                const key = prop.key ? extract(prop.key, depth + 1) : '';
                if (prop.shorthand) {
                  return prop.value && prop.value.type === 'AssignmentPattern'
                    ? extractParam(prop.value, depth + 1)
                    : key;
                }
                return `${key}: ${extractParam(prop.value, depth + 1)}`;
              })
              .filter(Boolean)
              .join(', ')
          : '';
        return `{${props}}`;
      }
      default:
        return extract(p, depth + 1);
    }
  }

  return extract(node);
}

/**
 * Detect whether a static attribute value contains an interpolated
 * `{expression}` segment (ignoring escaped braces).
 */
export function containsInterpolation(text: string): boolean {
  if (typeof text !== 'string') return false;
  return /(^|[^\\]){/.test(text) && text.includes('}');
}

/**
 * Convert an attribute value that mixes static text and `{expression}`
 * segments into a template-literal expression string, e.g.
 *   `dcid-step {snap.step === 'upload' ? 'active' : ''}`
 * becomes
 *   `dcid-step ${snap.step === 'upload' ? 'active' : ''}`  (wrapped in backticks)
 */
export function interpolatedTextToTemplateLiteral(text: string): string {
  const segments = splitInterpolation(text);
  let result = '`';
  for (const seg of segments) {
    if (seg.type === 'text') {
      // Escape backticks and ${ that would otherwise break the template literal.
      result += seg.value.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
    } else {
      let expr = seg.value.trim();
      try {
        expr = extractExpression(parseExpression(seg.value));
      } catch {
        // Fall back to the raw expression text if it can't be parsed.
      }
      result += '${' + expr + '}';
    }
  }
  result += '`';
  return result;
}

/**
 * Split a string into alternating static-text and expression segments,
 * respecting balanced braces, strings, and template literals inside the
 * `{...}` expression so a ternary like `{a ? 'x' : ''}` stays whole.
 */
function splitInterpolation(text: string): Array<{ type: 'text' | 'expr'; value: string }> {
  const segments: Array<{ type: 'text' | 'expr'; value: string }> = [];
  let buffer = '';
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (ch === '\\' && i + 1 < text.length) {
      // Preserve escaped characters (e.g. \{) as literal text.
      buffer += text[i + 1];
      i += 2;
      continue;
    }

    if (ch === '{') {
      if (buffer) {
        segments.push({ type: 'text', value: buffer });
        buffer = '';
      }
      // Scan to the matching closing brace, tracking nesting and strings.
      let depth = 1;
      let j = i + 1;
      let expr = '';
      let quote: string | null = null;
      while (j < text.length && depth > 0) {
        const c = text[j];
        if (quote) {
          expr += c;
          if (c === '\\' && j + 1 < text.length) {
            expr += text[j + 1];
            j += 2;
            continue;
          }
          if (c === quote) quote = null;
          j++;
          continue;
        }
        if (c === '"' || c === "'" || c === '`') {
          quote = c;
          expr += c;
          j++;
          continue;
        }
        if (c === '{') depth++;
        else if (c === '}') {
          depth--;
          if (depth === 0) break;
        }
        expr += c;
        j++;
      }
      segments.push({ type: 'expr', value: expr });
      i = j + 1; // skip the closing brace
      continue;
    }

    buffer += ch;
    i++;
  }

  if (buffer) {
    segments.push({ type: 'text', value: buffer });
  }

  return segments;
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
function transformKeyBlock(node: KeyBlockASTNode, context: TransformContext): KeyNode {
  const children = node.children.map(child => transformNode(child, context));

  return {
    type: 'key',
    expression: extractExpression(node.expression),
    children
  };
}
