/**
 * Component Reference Analyzer
 *
 * Analyzes template nodes to identify which elements are references to
 * DCE components (vs. regular HTML elements) and extracts their usage.
 */

import type {
  DurableComponentIR,
  TemplateNode,
  ElementNode,
  ImportDefinition
} from '../types/ir';

/**
 * Represents a component reference found in the template
 */
export interface ComponentReference {
  /** The name of the component as used in the template */
  name: string;
  /** The import source path for this component */
  source: string;
  /** The local name from the import (may differ from name due to aliases) */
  localName: string;
  /** Whether this is a default import */
  isDefault: boolean;
}

/**
 * Analyzes a component's IR to find all DCE component references in the template
 *
 * @param ir - The component's intermediate representation
 * @returns Array of component references found in the template
 */
export function analyzeComponentReferences(ir: DurableComponentIR): ComponentReference[] {
  const references: ComponentReference[] = [];
  const componentNames = extractComponentNames(ir.imports || []);

  // Walk the template tree to find component usages
  walkTemplate(ir.template, (node) => {
    if (node.type === 'element') {
      const elementNode = node as ElementNode;
      const componentInfo = componentNames.get(elementNode.name);

      // Check if this element name matches an imported component
      if (componentInfo) {
        // Check if we've already added this reference
        const exists = references.some(ref =>
          ref.name === elementNode.name && ref.source === componentInfo.source
        );

        if (!exists) {
          references.push({
            name: elementNode.name,
            source: componentInfo.source,
            localName: componentInfo.localName,
            isDefault: componentInfo.isDefault
          });
        }
      }
    }
  });

  return references;
}

/**
 * Extracts component names from imports
 *
 * @param imports - Array of import definitions
 * @returns Map of component names to their import information
 */
function extractComponentNames(imports: ImportDefinition[]): Map<string, {
  source: string;
  localName: string;
  isDefault: boolean;
}> {
  const componentMap = new Map<string, {
    source: string;
    localName: string;
    isDefault: boolean;
  }>();

  for (const importDef of imports) {
    for (const specifier of importDef.specifiers) {
      // Only track imports that start with uppercase (component naming convention)
      // or are explicitly default imports (likely to be components)
      if (isComponentName(specifier.local) || specifier.type === 'default') {
        componentMap.set(specifier.local, {
          source: importDef.source,
          localName: specifier.local,
          isDefault: specifier.type === 'default'
        });
      }
    }
  }

  return componentMap;
}

/**
 * Checks if a name follows component naming convention (starts with uppercase)
 *
 * @param name - The name to check
 * @returns True if the name appears to be a component name
 */
function isComponentName(name: string): boolean {
  return name.length > 0 && name[0] === name[0].toUpperCase();
}

/**
 * Recursively walks the template tree and calls the visitor function for each node
 *
 * @param node - The template node to walk
 * @param visitor - Function to call for each node
 */
function walkTemplate(node: TemplateNode, visitor: (node: TemplateNode) => void): void {
  visitor(node);

  // Recursively visit children based on node type
  if ('children' in node && Array.isArray(node.children)) {
    for (const child of node.children) {
      walkTemplate(child, visitor);
    }
  }

  // Handle if/else blocks
  if (node.type === 'if') {
    if (node.consequent) {
      for (const child of node.consequent) {
        walkTemplate(child, visitor);
      }
    }
    if (node.alternate) {
      for (const child of node.alternate) {
        walkTemplate(child, visitor);
      }
    }
  }

  // Handle slot fallback content
  if (node.type === 'slot' && node.fallback) {
    for (const child of node.fallback) {
      walkTemplate(child, visitor);
    }
  }
}

/**
 * Checks if a source path is likely a DCE component import
 *
 * DCE components are identified by:
 * - Relative imports (starting with ./ or ../)
 * - Ending with .dce extension (optional, as it may be implied)
 *
 * @param source - The import source path
 * @returns True if this is likely a DCE component import
 */
export function isDCEComponentImport(source: string): boolean {
  // Check if it's a relative import
  const isRelative = source.startsWith('./') || source.startsWith('../');

  // Check if it explicitly has .dce extension
  const hasDCEExtension = source.endsWith('.dce');

  // For now, we'll consider all relative imports as potential DCE components
  // This can be refined based on file system checks or configuration
  return isRelative || hasDCEExtension;
}

/**
 * Filters component references to only include DCE components
 *
 * @param references - Array of component references
 * @returns Array of references that are DCE components
 */
export function filterDCEComponents(references: ComponentReference[]): ComponentReference[] {
  return references.filter(ref => isDCEComponentImport(ref.source));
}
