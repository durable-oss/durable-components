/**
 * Abstract Syntax Tree (AST) Types
 *
 * These types represent the parsed structure of a .dce file before
 * transformation into the canonical IR. The D-AST (Durable AST) is
 * a direct representation of the source syntax.
 */
import type { Node as AcornNode } from 'acorn';
/**
 * Position in source code
 */
export interface Position {
    line: number;
    column: number;
    offset: number;
}
/**
 * Base AST node
 */
export interface BaseNode {
    start: number;
    end: number;
}
/**
 * Script block (contains component logic)
 */
export interface ScriptBlock extends BaseNode {
    type: 'ScriptBlock';
    content: string;
    ast: AcornNode;
    lang?: string;
    imports?: ImportDeclaration[];
    types?: TypeDefinition[];
}
/**
 * Import Declaration
 */
export interface ImportDeclaration extends BaseNode {
    type: 'ImportDeclaration';
    source: string;
    specifiers: ImportSpecifier[];
}
/**
 * Import Specifier
 */
export interface ImportSpecifier {
    type: 'default' | 'named' | 'namespace';
    local: string;
    imported?: string;
}
/**
 * Type Definition (TypeScript interface or type alias)
 */
export interface TypeDefinition extends BaseNode {
    type: 'InterfaceDeclaration' | 'TypeAlias';
    name: string;
    body: string;
}
/**
 * Template block (contains component UI)
 */
export interface TemplateBlock extends BaseNode {
    type: 'TemplateBlock';
    content: string;
    children: TemplateASTNode[];
}
/**
 * Style block (contains component CSS)
 */
export interface StyleBlock extends BaseNode {
    type: 'StyleBlock';
    content: string;
    scoped?: boolean;
}
/**
 * Template AST Node Types
 */
export type TemplateASTNodeType = 'Element' | 'Text' | 'Comment' | 'MustacheTag' | 'IfBlock' | 'EachBlock' | 'KeyBlock' | 'SnippetBlock' | 'Slot' | 'RenderBlock' | 'ConstTag' | 'HtmlTag' | 'DebugTag' | 'Comment' | 'DceElement';
/**
 * Base Template AST Node
 */
export interface BaseTemplateNode extends BaseNode {
    type: TemplateASTNodeType;
}
/**
 * Element node in template
 */
export interface ElementASTNode extends BaseTemplateNode {
    type: 'Element';
    name: string;
    attributes: TemplateAttribute[];
    children: TemplateASTNode[];
}
/**
 * Template attribute types
 */
export type TemplateAttribute = StaticAttribute | DynamicAttribute | EventAttribute | BindingAttribute | ClassDirective | StyleDirective | SpreadAttribute;
/**
 * Static attribute (e.g., class="foo")
 */
export interface StaticAttribute extends BaseNode {
    type: 'Attribute';
    name: string;
    value: Array<{
        type: 'Text';
        data: string;
    }>;
}
/**
 * Dynamic attribute (e.g., class={myClass})
 */
export interface DynamicAttribute extends BaseNode {
    type: 'Attribute';
    name: string;
    value: Array<{
        type: 'MustacheTag';
        expression: AcornNode;
    }>;
}
/**
 * Event handler (e.g., on:click={handler})
 */
export interface EventAttribute extends BaseNode {
    type: 'EventHandler';
    name: string;
    expression: AcornNode;
    modifiers?: string[];
}
/**
 * Two-way binding (e.g., bind:value={name})
 */
export interface BindingAttribute extends BaseNode {
    type: 'Binding';
    name: string;
    expression: AcornNode;
}
/**
 * Class directive (e.g., class:active={isActive})
 */
export interface ClassDirective extends BaseNode {
    type: 'Class';
    name: string;
    expression: AcornNode;
}
/**
 * Style directive (e.g., style:color={myColor})
 */
export interface StyleDirective extends BaseNode {
    type: 'StyleDirective';
    name: string;
    value: string | AcornNode;
}
/**
 * Spread attribute (e.g., {...props})
 */
export interface SpreadAttribute extends BaseNode {
    type: 'Spread';
    expression: AcornNode;
}
/**
 * Text node
 */
export interface TextASTNode extends BaseTemplateNode {
    type: 'Text';
    data: string;
}
/**
 * Comment node (e.g., <!-- comment -->)
 */
export interface CommentASTNode extends BaseTemplateNode {
    type: 'Comment';
    data: string;
}
/**
 * Mustache tag (e.g., {count})
 */
export interface MustacheTagASTNode extends BaseTemplateNode {
    type: 'MustacheTag';
    expression: AcornNode;
}
/**
 * If block (e.g., {#if condition}...{/if})
 */
export interface IfBlockASTNode extends BaseTemplateNode {
    type: 'IfBlock';
    expression: AcornNode;
    children: TemplateASTNode[];
    else?: ElseBlock;
}
/**
 * Else block
 */
export interface ElseBlock extends BaseNode {
    type: 'ElseBlock';
    children: TemplateASTNode[];
}
/**
 * Each block (e.g., {#each items as item}...{/each})
 */
export interface EachBlockASTNode extends BaseTemplateNode {
    type: 'EachBlock';
    expression: AcornNode;
    context: string;
    index?: string;
    key?: AcornNode;
    children: TemplateASTNode[];
}
/**
 * Slot
 */
export interface SlotASTNode extends BaseTemplateNode {
    type: 'Slot';
    name?: string;
    children: TemplateASTNode[];
}
/**
 * Render block (e.g., {@render children()})
 */
export interface RenderBlockASTNode extends BaseTemplateNode {
    type: 'RenderBlock';
    expression: AcornNode;
    snippet: string;
    args?: AcornNode[];
}
/**
 * Const tag (e.g., {@const doubled = count * 2})
 */
export interface ConstTagASTNode extends BaseTemplateNode {
    type: 'ConstTag';
    name: string;
    expression: AcornNode;
}
/**
 * Html tag (e.g., {@html htmlString})
 */
export interface HtmlTagASTNode extends BaseTemplateNode {
    type: 'HtmlTag';
    expression: AcornNode;
}
/**
 * Debug tag (e.g., {@debug count, message})
 */
export interface DebugTagASTNode extends BaseTemplateNode {
    type: 'DebugTag';
    identifiers: string[];
}
/**
 * Key block (e.g., {#key value}...{/key})
 */
export interface KeyBlockASTNode extends BaseTemplateNode {
    type: 'KeyBlock';
    expression: AcornNode;
    children: TemplateASTNode[];
}
/**
 * Snippet block (e.g., {#snippet name(params)}...{/snippet})
 */
export interface SnippetBlockASTNode extends BaseTemplateNode {
    type: 'SnippetBlock';
    name: string;
    params?: string[];
    children: TemplateASTNode[];
}
/**
 * Comment node (e.g., <!-- comment -->)
 */
export interface CommentASTNode extends BaseTemplateNode {
    type: 'Comment';
    data: string;
}
/**
 * dce: elements - Special elements with plugin-based implementation
 * Types: element, window, boundary, head
 */
export interface DceElementASTNode extends BaseTemplateNode {
    type: 'DceElement';
    kind: 'element' | 'window' | 'boundary' | 'head';
    tagExpression?: AcornNode;
    attributes: TemplateAttribute[];
    children: TemplateASTNode[];
}
export type DceWindowASTNode = DceElementASTNode & {
    kind: 'window';
};
export type DceBoundaryASTNode = DceElementASTNode & {
    kind: 'boundary';
};
export type DceHeadASTNode = DceElementASTNode & {
    kind: 'head';
};
/**
 * Union type for all template AST nodes
 */
export type TemplateASTNode = ElementASTNode | TextASTNode | CommentASTNode | MustacheTagASTNode | IfBlockASTNode | EachBlockASTNode | KeyBlockASTNode | SnippetBlockASTNode | SlotASTNode | RenderBlockASTNode | ConstTagASTNode | HtmlTagASTNode | DebugTagASTNode | CommentASTNode | DceElementASTNode;
/**
 * Complete Durable Component AST (D-AST)
 *
 * This is the output of Phase 1 (Parser).
 * It holds the three parsed sections of a .dce file.
 */
export interface DurableComponentAST {
    type: 'DurableComponent';
    script?: ScriptBlock;
    template?: TemplateBlock;
    style?: StyleBlock;
    meta: {
        filename: string;
        source: string;
    };
}
