/**
 * DCE element transformer plugins
 */

import type { DceElementASTNode } from '../types/ast';
import type {
  TemplateNode,
  DceElementNode,
  DceWindowNode,
  DceBoundaryNode,
  DceHeadNode,
  AttributeBinding
} from '../types/ir';
import type { TransformContext } from './template-transformer';
import { extractExpression } from './template-transformer';

interface DcePlugin {
  transform(node: DceElementASTNode, context: TransformContext): TemplateNode;
}

function transformDceAttributes(node: DceElementASTNode): AttributeBinding[] {
  const attributes: AttributeBinding[] = [];
  for (const attr of node.attributes) {
    if (attr.type === 'EventHandler') {
      const expr = extractExpression(attr.expression);
      attributes.push({
        name: `on:${attr.name}`,
        value: `functions.${expr}`,
        modifiers: attr.modifiers && attr.modifiers.length > 0 ? attr.modifiers : undefined
      });
    } else if (attr.type === 'Binding') {
      const expr = extractExpression(attr.expression);
      attributes.push({ name: `bind:${attr.name}`, value: `state.${expr}` });
    } else if (attr.type === 'Attribute') {
      if (attr.value && attr.value.length > 0) {
        const first = attr.value[0];
        if (first.type === 'MustacheTag') {
          const expr = extractExpression(first.expression);
          attributes.push({ name: attr.name, value: expr });
        } else if (first.type === 'Text') {
          attributes.push({ name: attr.name, value: `"${first.data}"` });
        }
      }
    }
  }
  return attributes;
}

const elementPlugin: DcePlugin = {
  transform(node, context): DceElementNode {
    const tagExpr = node.tagExpression
      ? extractExpression(node.tagExpression)
      : 'div';
    return {
      type: 'dce-element',
      tagExpression: tagExpr,
      attributes: transformDceAttributes(node),
      children: node.children.map(child => context.transformNode(child, context))
    };
  }
};

const windowPlugin: DcePlugin = {
  transform(node): DceWindowNode {
    return {
      type: 'dce-window',
      attributes: transformDceAttributes(node)
    };
  }
};

const boundaryPlugin: DcePlugin = {
  transform(node, context): DceBoundaryNode {
    return {
      type: 'dce-boundary',
      attributes: transformDceAttributes(node),
      children: node.children.map(child => context.transformNode(child, context))
    };
  }
};

const headPlugin: DcePlugin = {
  transform(node, context): DceHeadNode {
    return {
      type: 'dce-head',
      children: node.children.map(child => context.transformNode(child, context))
    };
  }
};

const plugins: Record<string, DcePlugin> = {
  element: elementPlugin,
  window: windowPlugin,
  boundary: boundaryPlugin,
  head: headPlugin
};

export function getDcePlugin(kind: string): DcePlugin | undefined {
  return plugins[kind];
}
