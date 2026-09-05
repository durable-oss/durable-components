/**
 * Collect `bind:this` targets from a template.
 *
 * A ref binds one element to one name, so a `bind:this` inside an `{#each}`
 * has every iteration writing the same variable. What that leaves behind
 * differs per target — the last element on React, Solid, and Svelte, and an
 * array on Vue, which collects `ref` inside `v-for` — so the extraction
 * records which refs were bound in a loop and the caller reports them rather
 * than picking one framework's answer and calling it the semantics.
 */

import type { RefDefinition, TemplateNode } from '../types/ir';

export interface ExtractedRefs {
  refs: RefDefinition[];
  /** Refs bound by a `bind:this` inside an `{#each}`. */
  inLoop: Set<string>;
}

export function extractRefsFromTemplate(template: TemplateNode): ExtractedRefs {
  const refs = new Set<string>();
  const inLoop = new Set<string>();

  function walk(node: TemplateNode, loopDepth: number): void {
    if (!node || typeof node !== 'object') return;

    if (node.type === 'element' && 'attributes' in node) {
      const element = node as any;
      if (Array.isArray(element.attributes)) {
        for (const attr of element.attributes) {
          if (attr && attr.name === 'bind:this' && typeof attr.value === 'string') {
            // Extract ref name from value (remove 'state.' prefix if present)
            const refName = attr.value.replace(/^state\./, '');
            refs.add(refName);
            if (loopDepth > 0) inLoop.add(refName);
          }
        }
      }
    }

    const depth = node.type === 'each' ? loopDepth + 1 : loopDepth;

    if ('children' in node && Array.isArray((node as any).children)) {
      for (const child of (node as any).children) {
        walk(child, depth);
      }
    }

    // An if node's consequent and alternate are also copied into `children`,
    // so the walk above already covered both branches.
  }

  walk(template, 0);

  return { refs: Array.from(refs).map((name) => ({ name })), inLoop };
}
