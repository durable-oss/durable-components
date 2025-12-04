/**
 * Example: Custom IR Transformer Plugins
 *
 * This file demonstrates how to create custom plugins that transform
 * the DurableComponentIR in arbitrary ways.
 */

import {
  createIRTransformerPlugin,
  visitTemplateNodes,
  type IRTransformerOptions,
  type DurableComponentIR,
  durableComponentProcessor,
  durableParser,
  durableTreeStorage,
  durableReactCompiler
} from 'durable-components';

/**
 * Example 1: Simple logger plugin
 * Logs component information during compilation
 */
export const logComponentInfo = createIRTransformerPlugin((tree, file) => {
  console.log(`Processing component: ${tree.name}`);
  console.log(`  Props: ${tree.props.map(p => p.name).join(', ')}`);
  console.log(`  State: ${tree.state.map(s => s.name).join(', ')}`);
  return tree;
});

/**
 * Example 2: Add prop defaults plugin
 * Automatically adds default values to props that don't have them
 */
interface PropDefaultsOptions extends IRTransformerOptions {
  defaults?: Record<string, string>;
}

export const addPropDefaults = createIRTransformerPlugin<PropDefaultsOptions>(
  (tree, file, options) => {
    const defaults = options?.defaults || {};

    tree.props.forEach(prop => {
      if (!prop.defaultValue && defaults[prop.name]) {
        prop.defaultValue = defaults[prop.name];
      }
    });

    return tree;
  }
);

/**
 * Example 3: Auto-generate metadata
 * Adds metadata to the IR for documentation purposes
 */
export const generateMetadata = createIRTransformerPlugin((tree, file) => {
  // Count template nodes
  let elementCount = 0;
  let expressionCount = 0;

  visitTemplateNodes(tree.template, (node) => {
    if (node.type === 'element') elementCount++;
    if (node.type === 'expression') expressionCount++;
  });

  // Store metadata in tree.data
  if (!tree.data) {
    tree.data = {};
  }

  tree.data.metadata = {
    elementCount,
    expressionCount,
    propsCount: tree.props.length,
    stateCount: tree.state.length,
    functionsCount: tree.functions.length
  };

  return tree;
});

/**
 * Example 4: Prefix component names
 * Adds a prefix to component names (useful for namespacing)
 */
interface PrefixOptions extends IRTransformerOptions {
  prefix?: string;
}

export const prefixComponentName = createIRTransformerPlugin<PrefixOptions>(
  (tree, file, options) => {
    const prefix = options?.prefix || 'Durable';
    if (!tree.name.startsWith(prefix)) {
      tree.name = `${prefix}${tree.name}`;
    }
    return tree;
  }
);

/**
 * Example 5: Remove debug nodes in production
 * Strips out {@debug} nodes when building for production
 */
interface RemoveDebugOptions extends IRTransformerOptions {
  production?: boolean;
}

export const removeDebugNodes = createIRTransformerPlugin<RemoveDebugOptions>(
  (tree, file, options) => {
    if (!options?.production) {
      return tree; // Keep debug nodes in development
    }

    const removeDebugFromChildren = (children: any[]): any[] => {
      return children
        .filter(node => node.type !== 'debug')
        .map(node => {
          if (node.children) {
            return { ...node, children: removeDebugFromChildren(node.children) };
          }
          if (node.consequent) {
            node.consequent = removeDebugFromChildren(node.consequent);
          }
          if (node.alternate) {
            node.alternate = removeDebugFromChildren(node.alternate);
          }
          return node;
        });
    };

    if (tree.template.type === 'element' && tree.template.children) {
      tree.template.children = removeDebugFromChildren(tree.template.children);
    }

    return tree;
  }
);

/**
 * Example 6: Validate IR structure
 * Checks that the IR meets certain criteria before compilation
 */
interface ValidateOptions extends IRTransformerOptions {
  requireProps?: boolean;
  maxStateCount?: number;
}

export const validateIR = createIRTransformerPlugin<ValidateOptions>(
  (tree, file, options) => {
    if (options?.requireProps && tree.props.length === 0) {
      console.warn(`Component ${tree.name} has no props`);
    }

    if (options?.maxStateCount && tree.state.length > options.maxStateCount) {
      console.warn(
        `Component ${tree.name} has ${tree.state.length} state variables, ` +
        `exceeding maximum of ${options.maxStateCount}`
      );
    }

    return tree;
  }
);

/**
 * Example 7: Add accessibility attributes
 * Automatically adds ARIA attributes to elements
 */
export const addAccessibilityAttrs = createIRTransformerPlugin((tree, file) => {
  visitTemplateNodes(tree.template, (node) => {
    if (node.type === 'element') {
      // Add role to buttons without roles
      if (node.name === 'button' && !node.attributes?.some(a => a.name === 'role')) {
        if (!node.attributes) node.attributes = [];
        node.attributes.push({ name: 'role', value: '"button"' });
      }

      // Add alt to images without alt
      if (node.name === 'img' && !node.attributes?.some(a => a.name === 'alt')) {
        if (!node.attributes) node.attributes = [];
        node.attributes.push({ name: 'alt', value: '""' });
      }
    }
  });

  return tree;
});

/**
 * Example usage: Composing multiple transformers
 */
export function createCustomPipeline(source: string) {
  const processor = durableComponentProcessor()
    .use(durableParser, { filename: 'Example.dce' })
    .use(durableTreeStorage)
    // Custom transformers
    .use(logComponentInfo)
    .use(addPropDefaults, {
      defaults: {
        'title': '"Untitled"',
        'count': '0'
      }
    })
    .use(prefixComponentName, { prefix: 'App' })
    .use(generateMetadata)
    .use(removeDebugNodes, { production: true })
    .use(validateIR, {
      requireProps: false,
      maxStateCount: 10
    })
    .use(addAccessibilityAttrs)
    // Final compilation
    .use(durableReactCompiler);

  const result = processor.processSync(source);
  return result;
}

/**
 * Example usage: Conditional transformers
 */
export function createConditionalPipeline(source: string, isDev: boolean) {
  let processor = durableComponentProcessor()
    .use(durableParser, { filename: 'Example.dce' })
    .use(durableTreeStorage);

  // Only remove debug nodes in production
  if (!isDev) {
    processor = processor.use(removeDebugNodes, { production: true });
  }

  // Always validate in development
  if (isDev) {
    processor = processor.use(validateIR, {
      requireProps: true,
      maxStateCount: 20
    });
  }

  processor = processor.use(durableReactCompiler);

  const result = processor.processSync(source);
  return result;
}
