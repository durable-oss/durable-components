/**
 * Durable Component Intermediate Representation (IR) v1.0
 *
 * This is the canonical JSON schema that represents a component's intent
 * in a completely framework-agnostic manner. This is the "archaeological artifact"
 * that captures component understanding decoupled from any implementation.
 *
 * Every construct in this IR has a direct, idiomatic mapping to all major frameworks.
 *
 * This component tree follows the unist (Universal Syntax Tree) specification,
 * making it compatible with the unified.js collective ecosystem.
 */

import type { Node, Parent, Data } from 'unist';

/**
 * Import Definition
 */
export interface ImportDefinition {
  source: string; // Module path
  specifiers: {
    type: 'default' | 'named' | 'namespace';
    local: string; // Local binding name
    imported?: string; // Original name (for named imports)
  }[];
}

/**
 * Type Definition (TypeScript interface or type alias)
 */
export interface TypeDefinition {
  type: 'interface' | 'type';
  name: string; // Type name
  body: string; // Type definition source code
}

/**
 * Component Property Definition
 */
export interface PropDefinition {
  name: string;
  type?: string; // Optional type hint (for documentation/validation)
  defaultValue?: string; // JavaScript expression as string
}

/**
 * Reactive State Definition
 */
export interface StateDefinition {
  name: string;
  initialValue: string; // JavaScript expression as string
}

/**
 * Derived State Definition (Computed Values)
 */
export interface DerivedDefinition {
  name: string;
  expression: string; // JavaScript expression as string
  dependencies: string[]; // Array of state/prop names this depends on
}

/**
 * Side Effect Definition
 */
export interface EffectDefinition {
  expression: string; // JavaScript code to execute
  dependencies: string[]; // Array of state/prop names that trigger this effect
}

/**
 * Lifecycle Effect
 *
 * A side effect that runs on mount and tears down on unmount. Unlike an
 * `EffectDefinition`, which re-runs when its dependencies change, this models
 * setup/teardown pairs — event listeners, timers, DOM mutations — that the
 * `dce:*` behavior primitives compile to.
 */
export interface LifecycleEffect {
  /** Statements to run on mount. */
  setup: string;
  /** Optional expression evaluating to a teardown function. */
  teardown?: string;
  /** Which primitive produced this, for diagnostics. */
  source?: string;
  /**
   * Set when the primitive sits inside an `{#each}` and closes over the loop
   * scope. The effect then belongs to one iteration rather than to the
   * component, so it is emitted inside a generated per-item component that
   * receives `params` as props instead of at component scope, where the loop
   * variable does not exist.
   */
  scope?: LifecycleScope;
}

/**
 * The loop scope a lifecycle effect was captured in.
 */
export interface LifecycleScope {
  /** Identifier tying the effect to its `dce-behavior` placeholder. */
  id: string;
  /** Loop variables the effect reads, in binding order. */
  params: string[];
  /** Non-loop identifiers the effect reads, e.g. handler functions. */
  captures: string[];
}

/**
 * A non-fatal diagnostic raised while building the IR.
 */
export interface IRWarning {
  message: string;
  code?: string;
}

/**
 * Function Definition
 */
export interface FunctionDefinition {
  name: string;
  params?: string[]; // Parameter names
  body: string; // JavaScript function body
  async?: boolean; // Whether the function is declared async
}

/**
 * Snippet Definition (template snippets that can be passed as props)
 */
export interface SnippetDefinition {
  name: string; // Snippet name
  params?: string[]; // Parameter names
  template: TemplateNode[]; // Template nodes that make up the snippet
}

/**
 * Element Reference Definition (for bind:this)
 */
export interface RefDefinition {
  name: string; // Variable name for the ref
}

/**
 * Template Node Types
 */
export type TemplateNodeType = 'element' | 'text' | 'expression' | 'if' | 'each' | 'key' | 'slot' | 'render' | 'const' | 'html' | 'debug' | 'comment' | 'dce-element' | 'dce-window' | 'dce-boundary' | 'dce-head' | 'dce-behavior';

/**
 * Base Template Node (unist-compatible)
 */
export interface BaseTemplateNode extends Node {
  type: TemplateNodeType;
  data?: Data;
}

/**
 * Element Node (e.g., <div>, <button>)
 */
export interface ElementNode extends BaseTemplateNode, Parent {
  type: 'element';
  name: string; // Tag name (e.g., 'div', 'button')
  attributes?: AttributeBinding[];
  bindings?: Record<string, string>; // Property bindings (e.g., { class: 'state.myClass' })
  children: TemplateNode[];
}

/**
 * Attribute Binding (e.g., on:click={handler})
 */
export interface AttributeBinding {
  name: string; // Attribute name (e.g., 'on:click', 'bind:value')
  value: string; // Reference to state/function (e.g., 'functions.increment')
  modifiers?: string[]; // Event modifiers (e.g., ['preventDefault', 'stopPropagation'])
}

/**
 * Text Node (static text)
 */
export interface TextNode extends BaseTemplateNode {
  type: 'text';
  content: string;
}

/**
 * Expression Node (dynamic text like {count})
 */
export interface ExpressionNode extends BaseTemplateNode {
  type: 'expression';
  expression: string; // JavaScript expression (e.g., 'state.count', 'derived.doubled')
}

/**
 * Conditional Rendering Node ({#if})
 */
export interface IfNode extends BaseTemplateNode, Parent {
  type: 'if';
  condition: string; // JavaScript expression
  consequent: TemplateNode[]; // Nodes to render if true
  alternate?: TemplateNode[]; // Nodes to render if false (else block)
  children: TemplateNode[]; // Combined consequent + alternate for unist compatibility
}

/**
 * List Rendering Node ({#each})
 */
export interface EachNode extends BaseTemplateNode, Parent {
  type: 'each';
  expression: string; // Array expression (e.g., 'state.items')
  itemName: string; // Iterator variable name (e.g., 'item')
  indexName?: string; // Optional index variable (e.g., 'index')
  key?: string; // Optional key expression for reconciliation
  children: TemplateNode[];
}

/**
 * Slot Node (component children insertion point)
 */
export interface SlotNode extends BaseTemplateNode, Parent {
  type: 'slot';
  name?: string; // Named slot identifier
  fallback?: TemplateNode[]; // Default content if slot is empty
  children: TemplateNode[]; // Fallback content (unist compatibility)
}

/**
 * Render Node (snippet rendering like {@render children()})
 */
export interface RenderNode extends BaseTemplateNode {
  type: 'render';
  snippet: string; // Snippet name to render
  args?: string[]; // Arguments passed to snippet
}

/**
 * Const Node (local template constant like {@const x = value})
 */
export interface ConstNode extends BaseTemplateNode {
  type: 'const';
  name: string; // Variable name
  expression: string; // Value expression
}

/**
 * Html Node (raw HTML like {@html htmlString})
 */
export interface HtmlNode extends BaseTemplateNode {
  type: 'html';
  expression: string; // HTML string expression
}

/**
 * Debug Node (debug statement like {@debug var1, var2})
 */
export interface DebugNode extends BaseTemplateNode {
  type: 'debug';
  identifiers: string[]; // Variables to debug
}

/**
 * Key Block Node (keyed rendering like {#key value}...{/key})
 */
export interface KeyNode extends BaseTemplateNode, Parent {
  type: 'key';
  expression: string; // Key expression
  children: TemplateNode[];
}

/**
 * Comment Node (HTML comment like <!-- comment -->)
 */
export interface CommentNode extends BaseTemplateNode {
  type: 'comment';
  content: string; // Comment text
}

/**
 * DCE Element Node (dynamic element tag like <dce:element>)
 */
export interface DceElementNode extends BaseTemplateNode, Parent {
  type: 'dce-element';
  tagExpression: string; // Expression for tag name
  attributes?: AttributeBinding[];
  bindings?: Record<string, string>;
  children: TemplateNode[];
}

/**
 * DCE Window Node (window event handlers like <dce:window>)
 */
export interface DceWindowNode extends BaseTemplateNode {
  type: 'dce-window';
  attributes?: AttributeBinding[];
}

/**
 * DCE Boundary Node (error boundary like <dce:boundary>)
 */
export interface DceBoundaryNode extends BaseTemplateNode, Parent {
  type: 'dce-boundary';
  attributes?: AttributeBinding[];
  children: TemplateNode[];
}

/**
 * DCE Behavior Node
 *
 * The placeholder a behavior primitive (`<dce:escape>`, `<dce:scroll-lock>`,
 * `<dce:timer>`, `<dce:focus-trap>`) leaves in the template. It renders
 * nothing — the primitive's real output is a `LifecycleEffect` on the
 * component — but keeping a node here preserves template structure and gives
 * diagnostics something to point at.
 */
export interface DceBehaviorNode extends BaseTemplateNode {
  type: 'dce-behavior';
  /** Which primitive this came from, e.g. 'escape'. */
  behavior: string;
  /**
   * Set when the primitive closes over an `{#each}` scope. The generators
   * render a per-item component here instead of nothing, so the effect runs
   * once per iteration with the loop variable in scope.
   */
  scope?: LifecycleScope;
}

/**
 * DCE Head Node (document head like <dce:head>)
 */
export interface DceHeadNode extends BaseTemplateNode, Parent {
  type: 'dce-head';
  children: TemplateNode[];
}

/**
 * Union type for all template nodes
 */
export type TemplateNode =
  | ElementNode
  | TextNode
  | ExpressionNode
  | IfNode
  | EachNode
  | KeyNode
  | SlotNode
  | RenderNode
  | ConstNode
  | HtmlNode
  | DebugNode
  | CommentNode
  | DceElementNode
  | DceWindowNode
  | DceBoundaryNode
  | DceHeadNode
  | DceBehaviorNode;

/**
 * Complete Durable Component IR
 *
 * This is the canonical representation of a component that can be
 * transformed into any target framework.
 *
 * This is the root of the component tree and follows the unist specification.
 */
export interface DurableComponentIR extends Node {
  /** Node type for unist compatibility */
  type: 'component';

  /** Schema version for future compatibility */
  '@version': string;

  /** Component name (derived from filename) */
  name: string;

  /** Script language (e.g., 'ts' for TypeScript) */
  lang?: string;

  /** External module imports */
  imports?: ImportDefinition[];

  /** TypeScript type definitions (interfaces and type aliases) */
  types?: TypeDefinition[];

  /** Component properties (inputs) */
  props: PropDefinition[];

  /** Reactive state */
  state: StateDefinition[];

  /** Derived/computed values */
  derived: DerivedDefinition[];

  /** Side effects */
  effects: EffectDefinition[];

  /** Mount/unmount effects produced by the dce:* behavior primitives */
  lifecycle?: LifecycleEffect[];

  /** Element references (bind:this) */
  refs: RefDefinition[];

  /** Diagnostics raised while building this IR, surfaced on the compile result */
  warnings?: IRWarning[];

  /** Event handlers and helper functions */
  functions: FunctionDefinition[];

  /** Template snippets (reusable template fragments) */
  snippets: SnippetDefinition[];

  /** Component template structure */
  template: TemplateNode;

  /** Component styles (CSS string) */
  styles?: string;

  /** Metadata for debugging/source mapping */
  meta?: {
    sourceFile?: string;
    originalSource?: string;
  };

  /** Optional unist data */
  data?: Data;
}

/**
 * Factory function to create an empty IR
 */
export function createEmptyIR(name: string): DurableComponentIR {
  return {
    type: 'component',
    '@version': '1.0.0',
    name,
    props: [],
    state: [],
    derived: [],
    effects: [],
    refs: [],
    functions: [],
    snippets: [],
    template: {
      type: 'element',
      name: 'div',
      children: []
    },
    styles: ''
  };
}
