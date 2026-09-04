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
  DceBehaviorNode,
  AttributeBinding
} from '../types/ir';
import { BEHAVIOR_HELPERS } from '../generators/behavior-runtime';
import type { TransformContext } from './template-transformer';
import {
  extractExpression,
  containsInterpolation,
  interpolatedTextToTemplateLiteral
} from './template-transformer';

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
          // A static value may still interpolate, e.g. style="width: {w}px".
          // Ordinary elements convert those to a template literal; dce:*
          // elements have to do the same or the braces are emitted literally.
          attributes.push({
            name: attr.name,
            value: containsInterpolation(first.data)
              ? interpolatedTextToTemplateLiteral(first.data)
              : `"${first.data}"`
          });
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


/**
 * Look up an attribute's transformed value by name.
 */
function attrValue(attributes: AttributeBinding[], name: string): string | undefined {
  return attributes.find((attr) => attr.name === name)?.value;
}

/**
 * Look up an event handler's value, e.g. `on:escape` -> the handler expression.
 */
function handlerValue(attributes: AttributeBinding[], event: string): string | undefined {
  const value = attrValue(attributes, `on:${event}`);
  return value === undefined ? undefined : value.replace(/^functions\./, '');
}

/**
 * Build a plugin for a behavior primitive.
 *
 * The primitive contributes a mount/unmount effect to the component and leaves
 * an inert placeholder in the template, since it renders no markup itself.
 */
function behaviorPlugin(
  behavior: string,
  build: (attributes: AttributeBinding[]) => { setup: string; teardown?: string } | null
): DcePlugin {
  return {
    transform(node, context): DceBehaviorNode {
      const attributes = transformDceAttributes(node);
      const effect = build(attributes);

      if (effect) {
        context.lifecycle.push({ ...effect, source: behavior });
      }

      return { type: 'dce-behavior', behavior };
    }
  };
}

/**
 * `<dce:focus-trap for={dialog} />` — confine Tab navigation to an element.
 */
const focusTrapPlugin = behaviorPlugin('focus-trap', (attributes) => {
  const target = attrValue(attributes, 'for');
  if (!target) return null;

  return { setup: `${BEHAVIOR_HELPERS.focusTrap}(${stripRef(target)})` };
});

/**
 * `<dce:escape on:escape={onClose} />` — run a handler on the Escape key.
 */
const escapePlugin = behaviorPlugin('escape', (attributes) => {
  const handler = handlerValue(attributes, 'escape');
  if (!handler) return null;

  return { setup: `${BEHAVIOR_HELPERS.escape}(${handler})` };
});

/**
 * `<dce:scroll-lock />` — prevent the document behind from scrolling.
 */
const scrollLockPlugin = behaviorPlugin('scroll-lock', () => ({
  setup: `${BEHAVIOR_HELPERS.scrollLock}()`
}));

/**
 * `<dce:timer after={5000} on:elapsed={onClose} />` — auto-dismiss timer.
 */
const timerPlugin = behaviorPlugin('timer', (attributes) => {
  const handler = handlerValue(attributes, 'elapsed');
  if (!handler) return null;

  const after = attrValue(attributes, 'after') ?? '0';
  return { setup: `${BEHAVIOR_HELPERS.timer}(${stripQuotes(after)}, ${handler})` };
});

/**
 * A `bind:this` target arrives prefixed for the IR; the generators re-add
 * whatever accessor their framework needs, so the bare name is stored here.
 */
function stripRef(value: string): string {
  return value.replace(/^(state|props|derived)\./, '');
}

/**
 * Numeric attributes arrive quoted when written as `after="5000"`; unwrap them
 * so the emitted call gets a number rather than a string.
 */
function stripQuotes(value: string): string {
  const match = value.match(/^(["'])([\s\S]*)\1$/);
  return match ? match[2] : value;
}

const plugins: Record<string, DcePlugin> = {
  element: elementPlugin,
  window: windowPlugin,
  boundary: boundaryPlugin,
  head: headPlugin,
  'focus-trap': focusTrapPlugin,
  escape: escapePlugin,
  'scroll-lock': scrollLockPlugin,
  timer: timerPlugin
};

export function getDcePlugin(kind: string): DcePlugin | undefined {
  return plugins[kind];
}
