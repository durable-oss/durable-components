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
    source: string;
    specifiers: {
        type: 'default' | 'named' | 'namespace';
        local: string;
        imported?: string;
    }[];
}
/**
 * Type Definition (TypeScript interface or type alias)
 */
export interface TypeDefinition {
    type: 'interface' | 'type';
    name: string;
    body: string;
}
/**
 * Component Property Definition
 */
export interface PropDefinition {
    name: string;
    type?: string;
    defaultValue?: string;
}
/**
 * Reactive State Definition
 */
export interface StateDefinition {
    name: string;
    initialValue: string;
}
/**
 * Derived State Definition (Computed Values)
 */
export interface DerivedDefinition {
    name: string;
    expression: string;
    dependencies: string[];
}
/**
 * Side Effect Definition
 */
export interface EffectDefinition {
    expression: string;
    dependencies: string[];
}
/**
 * Function Definition
 */
export interface FunctionDefinition {
    name: string;
    params?: string[];
    body: string;
}
/**
 * Snippet Definition (template snippets that can be passed as props)
 */
export interface SnippetDefinition {
    name: string;
    params?: string[];
    template: TemplateNode[];
}
/**
 * Element Reference Definition (for bind:this)
 */
export interface RefDefinition {
    name: string;
}
/**
 * Template Node Types
 */
export type TemplateNodeType = 'element' | 'text' | 'expression' | 'if' | 'each' | 'key' | 'slot' | 'render' | 'const' | 'html' | 'debug' | 'comment' | 'dce-element' | 'dce-window' | 'dce-boundary' | 'dce-head';
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
    name: string;
    attributes?: AttributeBinding[];
    bindings?: Record<string, string>;
    children: TemplateNode[];
}
/**
 * Attribute Binding (e.g., on:click={handler})
 */
export interface AttributeBinding {
    name: string;
    value: string;
    modifiers?: string[];
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
    expression: string;
}
/**
 * Conditional Rendering Node ({#if})
 */
export interface IfNode extends BaseTemplateNode, Parent {
    type: 'if';
    condition: string;
    consequent: TemplateNode[];
    alternate?: TemplateNode[];
    children: TemplateNode[];
}
/**
 * List Rendering Node ({#each})
 */
export interface EachNode extends BaseTemplateNode, Parent {
    type: 'each';
    expression: string;
    itemName: string;
    indexName?: string;
    key?: string;
    children: TemplateNode[];
}
/**
 * Slot Node (component children insertion point)
 */
export interface SlotNode extends BaseTemplateNode, Parent {
    type: 'slot';
    name?: string;
    fallback?: TemplateNode[];
    children: TemplateNode[];
}
/**
 * Render Node (snippet rendering like {@render children()})
 */
export interface RenderNode extends BaseTemplateNode {
    type: 'render';
    snippet: string;
    args?: string[];
}
/**
 * Const Node (local template constant like {@const x = value})
 */
export interface ConstNode extends BaseTemplateNode {
    type: 'const';
    name: string;
    expression: string;
}
/**
 * Html Node (raw HTML like {@html htmlString})
 */
export interface HtmlNode extends BaseTemplateNode {
    type: 'html';
    expression: string;
}
/**
 * Debug Node (debug statement like {@debug var1, var2})
 */
export interface DebugNode extends BaseTemplateNode {
    type: 'debug';
    identifiers: string[];
}
/**
 * Key Block Node (keyed rendering like {#key value}...{/key})
 */
export interface KeyNode extends BaseTemplateNode, Parent {
    type: 'key';
    expression: string;
    children: TemplateNode[];
}
/**
 * Comment Node (HTML comment like <!-- comment -->)
 */
export interface CommentNode extends BaseTemplateNode {
    type: 'comment';
    content: string;
}
/**
 * DCE Element Node (dynamic element tag like <dce:element>)
 */
export interface DceElementNode extends BaseTemplateNode, Parent {
    type: 'dce-element';
    tagExpression: string;
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
 * DCE Head Node (document head like <dce:head>)
 */
export interface DceHeadNode extends BaseTemplateNode, Parent {
    type: 'dce-head';
    children: TemplateNode[];
}
/**
 * Union type for all template nodes
 */
export type TemplateNode = ElementNode | TextNode | ExpressionNode | IfNode | EachNode | KeyNode | SlotNode | RenderNode | ConstNode | HtmlNode | DebugNode | CommentNode | DceElementNode | DceWindowNode | DceBoundaryNode | DceHeadNode;
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
    /** Element references (bind:this) */
    refs: RefDefinition[];
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
export declare function createEmptyIR(name: string): DurableComponentIR;
