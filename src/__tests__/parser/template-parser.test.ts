/**
 * Template parser tests
 */

import { parseTemplate } from '../../parser/template-parser';
import type {
  ElementASTNode,
  TextASTNode,
  MustacheTagASTNode,
  IfBlockASTNode,
  EachBlockASTNode
} from '../../types/ast';

describe('Template Parser', () => {
  describe('Basic parsing', () => {
    it('should parse simple text', () => {
      const nodes = parseTemplate('Hello World');
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('Text');
      expect((nodes[0] as TextASTNode).data).toBe('Hello World');
    });

    it('should parse empty template', () => {
      const nodes = parseTemplate('');
      expect(nodes).toHaveLength(0);
    });

    it('should parse whitespace-only template', () => {
      const nodes = parseTemplate('   ');
      expect(nodes).toHaveLength(0);
    });
  });

  describe('Element parsing', () => {
    it('should parse simple element', () => {
      const nodes = parseTemplate('<div>Test</div>');
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('Element');

      const element = nodes[0] as ElementASTNode;
      expect(element.name).toBe('div');
      expect(element.children).toHaveLength(1);
      expect((element.children[0] as TextASTNode).data).toBe('Test');
    });

    it('should parse self-closing element', () => {
      const nodes = parseTemplate('<input />');
      expect(nodes).toHaveLength(1);

      const element = nodes[0] as ElementASTNode;
      expect(element.name).toBe('input');
      expect(element.children).toHaveLength(0);
    });

    it('should parse nested elements', () => {
      const nodes = parseTemplate('<div><p>Text</p></div>');
      expect(nodes).toHaveLength(1);

      const div = nodes[0] as ElementASTNode;
      expect(div.name).toBe('div');
      expect(div.children).toHaveLength(1);

      const p = div.children[0] as ElementASTNode;
      expect(p.type).toBe('Element');
      expect(p.name).toBe('p');
    });

    it('should parse multiple sibling elements', () => {
      const nodes = parseTemplate('<div>First</div><div>Second</div>');
      expect(nodes).toHaveLength(2);

      expect((nodes[0] as ElementASTNode).name).toBe('div');
      expect((nodes[1] as ElementASTNode).name).toBe('div');
    });

    it('should parse element with mixed children', () => {
      const nodes = parseTemplate('<div>Text <span>Bold</span> More</div>');
      const element = nodes[0] as ElementASTNode;

      expect(element.children).toHaveLength(3);
      expect(element.children[0].type).toBe('Text');
      expect(element.children[1].type).toBe('Element');
      expect(element.children[2].type).toBe('Text');
    });

    it('should throw error for mismatched closing tag', () => {
      expect(() => {
        parseTemplate('<div></span>');
      }).toThrow();
    });
  });

  describe('Attribute parsing', () => {
    it('should parse static attribute', () => {
      const nodes = parseTemplate('<div class="container"></div>');
      const element = nodes[0] as ElementASTNode;

      expect(element.attributes).toHaveLength(1);
      expect(element.attributes[0].type).toBe('Attribute');
      expect(element.attributes[0].name).toBe('class');
    });

    it('should parse dynamic attribute', () => {
      const nodes = parseTemplate('<div class={className}></div>');
      const element = nodes[0] as ElementASTNode;

      expect(element.attributes).toHaveLength(1);
      expect(element.attributes[0].type).toBe('Attribute');
      expect(element.attributes[0].name).toBe('class');
    });

    it('should parse boolean attribute', () => {
      const nodes = parseTemplate('<input disabled />');
      const element = nodes[0] as ElementASTNode;

      expect(element.attributes).toHaveLength(1);
      expect(element.attributes[0].type).toBe('Attribute');
      expect(element.attributes[0].name).toBe('disabled');
    });

    it('should parse event handler', () => {
      const nodes = parseTemplate('<button on:click={handleClick}></button>');
      const element = nodes[0] as ElementASTNode;

      expect(element.attributes).toHaveLength(1);
      expect(element.attributes[0].type).toBe('EventHandler');
      expect(element.attributes[0].name).toBe('click');
    });

    it('should parse binding', () => {
      const nodes = parseTemplate('<input bind:value={name} />');
      const element = nodes[0] as ElementASTNode;

      expect(element.attributes).toHaveLength(1);
      expect(element.attributes[0].type).toBe('Binding');
      expect(element.attributes[0].name).toBe('value');
    });

    it('should parse class directive', () => {
      const nodes = parseTemplate('<div class:active={isActive}></div>');
      const element = nodes[0] as ElementASTNode;

      expect(element.attributes).toHaveLength(1);
      expect(element.attributes[0].type).toBe('Class');
      expect(element.attributes[0].name).toBe('active');
    });

    it('should parse multiple attributes', () => {
      const nodes = parseTemplate('<div class="test" id={myId} disabled></div>');
      const element = nodes[0] as ElementASTNode;

      expect(element.attributes).toHaveLength(3);
    });

    it('should parse attribute with single quotes', () => {
      const nodes = parseTemplate("<div class='container'></div>");
      const element = nodes[0] as ElementASTNode;

      expect(element.attributes).toHaveLength(1);
      expect(element.attributes[0].name).toBe('class');
    });

    it('should parse spread attributes {...props}', () => {
      const nodes = parseTemplate('<div {...props}></div>');
      const element = nodes[0] as ElementASTNode;

      expect(element.attributes).toHaveLength(1);
      expect(element.attributes[0].type).toBe('Spread');
    });

    it('should parse spread attributes with other attributes', () => {
      const nodes = parseTemplate('<input class="test" {...props} disabled />');
      const element = nodes[0] as ElementASTNode;

      expect(element.attributes).toHaveLength(3);
      expect(element.attributes[0].name).toBe('class');
      expect(element.attributes[1].type).toBe('Spread');
      expect(element.attributes[2].name).toBe('disabled');
    });

    it('should parse multiple spread attributes', () => {
      const nodes = parseTemplate('<div {...props1} {...props2}></div>');
      const element = nodes[0] as ElementASTNode;

      expect(element.attributes).toHaveLength(2);
      expect(element.attributes[0].type).toBe('Spread');
      expect(element.attributes[1].type).toBe('Spread');
    });

    it('should parse spread with complex expression', () => {
      const nodes = parseTemplate('<div {...$$restProps}></div>');
      const element = nodes[0] as ElementASTNode;

      expect(element.attributes).toHaveLength(1);
      expect(element.attributes[0].type).toBe('Spread');
    });
  });

  describe('Mustache tag parsing', () => {
    it('should parse simple expression', () => {
      const nodes = parseTemplate('{count}');
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('MustacheTag');
    });

    it('should parse expression in text', () => {
      const nodes = parseTemplate('Count: {count}');
      expect(nodes).toHaveLength(2);
      expect(nodes[0].type).toBe('Text');
      expect(nodes[1].type).toBe('MustacheTag');
    });

    it('should parse complex expression', () => {
      const nodes = parseTemplate('{count * 2}');
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('MustacheTag');
    });

    it('should parse multiple expressions', () => {
      const nodes = parseTemplate('{first} {second}');
      expect(nodes).toHaveLength(3); // Includes whitespace text node
      expect(nodes[0].type).toBe('MustacheTag');
      expect(nodes[1].type).toBe('Text'); // Whitespace between expressions
      expect(nodes[2].type).toBe('MustacheTag');
    });
  });

  describe('If block parsing', () => {
    it('should parse simple if block', () => {
      const nodes = parseTemplate('{#if show}<p>Visible</p>{/if}');
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('IfBlock');

      const ifBlock = nodes[0] as IfBlockASTNode;
      expect(ifBlock.children).toHaveLength(1);
      expect((ifBlock.children[0] as ElementASTNode).name).toBe('p');
    });

    it('should parse if-else block', () => {
      const nodes = parseTemplate('{#if show}<p>Yes</p>{:else}<p>No</p>{/if}');
      expect(nodes).toHaveLength(1);

      const ifBlock = nodes[0] as IfBlockASTNode;
      expect(ifBlock.children).toHaveLength(1);
      expect(ifBlock.else).toBeDefined();
      expect(ifBlock.else!.children).toHaveLength(1);
    });

    it('should parse if block with complex condition', () => {
      const nodes = parseTemplate('{#if count > 5}<p>Many</p>{/if}');
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('IfBlock');
    });

    it('should parse nested if blocks', () => {
      const template = '{#if outer}{#if inner}<p>Text</p>{/if}{/if}';
      const nodes = parseTemplate(template);

      expect(nodes).toHaveLength(1);
      const outer = nodes[0] as IfBlockASTNode;
      expect(outer.children[0].type).toBe('IfBlock');
    });

    it('should parse if block with multiple children', () => {
      const nodes = parseTemplate('{#if show}<p>One</p><p>Two</p>{/if}');
      const ifBlock = nodes[0] as IfBlockASTNode;

      expect(ifBlock.children).toHaveLength(2);
    });
  });

  describe('Each block parsing', () => {
    it('should parse simple each block', () => {
      const nodes = parseTemplate('{#each items as item}<li>{item}</li>{/each}');
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('EachBlock');

      const eachBlock = nodes[0] as EachBlockASTNode;
      expect(eachBlock.context).toBe('item');
      expect(eachBlock.children).toHaveLength(1);
    });

    it('should parse each block with index', () => {
      const nodes = parseTemplate('{#each items as item, i}<li>{i}: {item}</li>{/each}');
      const eachBlock = nodes[0] as EachBlockASTNode;

      expect(eachBlock.context).toBe('item');
      expect(eachBlock.index).toBe('i');
    });

    it('should parse each block with key expression', () => {
      const nodes = parseTemplate('{#each items as item (item.id)}<li>{item.name}</li>{/each}');
      const eachBlock = nodes[0] as EachBlockASTNode;

      expect(eachBlock.context).toBe('item');
      expect(eachBlock.key).toBeDefined();
      expect(eachBlock.key.type).toBe('Program');
    });

    it('should parse each block with index and key expression', () => {
      const nodes = parseTemplate('{#each items as item, index (item.id)}<li>{index}: {item.name}</li>{/each}');
      const eachBlock = nodes[0] as EachBlockASTNode;

      expect(eachBlock.context).toBe('item');
      expect(eachBlock.index).toBe('index');
      expect(eachBlock.key).toBeDefined();
      expect(eachBlock.key.type).toBe('Program');
    });

    it('should parse each block with complex expression', () => {
      const nodes = parseTemplate('{#each users.filter(u => u.active) as user}<div>{user.name}</div>{/each}');
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('EachBlock');
    });

    it('should parse nested each blocks', () => {
      const template = '{#each outer as o}{#each inner as i}<span>{i}</span>{/each}{/each}';
      const nodes = parseTemplate(template);

      const outerEach = nodes[0] as EachBlockASTNode;
      expect(outerEach.children[0].type).toBe('EachBlock');
    });

    it('should parse each block with multiple children', () => {
      const nodes = parseTemplate('{#each items as item}<h1>{item.title}</h1><p>{item.desc}</p>{/each}');
      const eachBlock = nodes[0] as EachBlockASTNode;

      expect(eachBlock.children).toHaveLength(2);
    });
  });

  describe('Complex template parsing', () => {
    it('should parse template with mixed content', () => {
      const template = `
        <div>
          <h1>{title}</h1>
          {#if show}
            <p>Visible</p>
          {/if}
          {#each items as item}
            <li>{item}</li>
          {/each}
        </div>
      `;

      const nodes = parseTemplate(template);
      expect(nodes).toHaveLength(1);

      const div = nodes[0] as ElementASTNode;
      expect(div.children.length).toBeGreaterThan(0);
    });

    it('should parse template with nested structures', () => {
      const template = `
        <div>
          {#if user}
            {#each user.posts as post}
              <article>
                <h2>{post.title}</h2>
                <p>{post.content}</p>
              </article>
            {/each}
          {:else}
            <p>No user</p>
          {/if}
        </div>
      `;

      const nodes = parseTemplate(template);
      expect(nodes).toHaveLength(1);
    });

    it('should handle whitespace correctly', () => {
      const template = `
        <div>
          <p>Test</p>
        </div>
      `;

      const nodes = parseTemplate(template);
      expect(nodes).toHaveLength(1);
    });
  });

  describe('Template literals', () => {
    it('should parse template literal in style attribute', () => {
      const template = '<div style={`border-radius: ${customBorderRadius};`}>test</div>';
      const nodes = parseTemplate(template);
      expect(nodes).toHaveLength(1);

      const element = nodes[0] as any;
      expect(element.type).toBe('Element');
      expect(element.name).toBe('div');
      expect(element.attributes).toHaveLength(1);
      expect(element.attributes[0].name).toBe('style');
      expect(element.attributes[0].value[0].type).toBe('MustacheTag');
    });

    it('should parse $derived with template literal', () => {
      const template = '{@const containerStyle = $derived(`width: ${width}; height: ${height};`)}';
      const nodes = parseTemplate(template);
      expect(nodes).toHaveLength(1);

      const constTag = nodes[0] as any;
      expect(constTag.type).toBe('ConstTag');
      expect(constTag.name).toBe('containerStyle');
    });

    it('should parse template literal in aria-activedescendant attribute', () => {
      const template = '<div aria-activedescendant={selectedIndex >= 0 ? `option-${selectedIndex}` : undefined}>test</div>';
      const nodes = parseTemplate(template);
      expect(nodes).toHaveLength(1);

      const element = nodes[0] as any;
      expect(element.type).toBe('Element');
      expect(element.attributes[0].name).toBe('aria-activedescendant');
    });

    it('should parse multi-line template literal', () => {
      const template = `{@const style = \`
        width: \${w};
        height: \${h};
      \`}`;
      const nodes = parseTemplate(template);
      expect(nodes).toHaveLength(1);

      const constTag = nodes[0] as any;
      expect(constTag.type).toBe('ConstTag');
      expect(constTag.name).toBe('style');
    });

    it('should parse template literal in mustache tag', () => {
      const template = '{`Hello ${name}!`}';
      const nodes = parseTemplate(template);
      expect(nodes).toHaveLength(1);

      const mustache = nodes[0] as any;
      expect(mustache.type).toBe('MustacheTag');
    });

    it('should parse nested braces in template literals', () => {
      const template = '{`value: ${obj.nested ? obj.nested.value : "default"}`}';
      const nodes = parseTemplate(template);
      expect(nodes).toHaveLength(1);

      const mustache = nodes[0] as any;
      expect(mustache.type).toBe('MustacheTag');
    });
  });

  describe('Complex expressions', () => {
    it('should parse expression with optional chaining and logical OR', () => {
      const nodes = parseTemplate('<p>{error?.message || "An unexpected error occurred"}</p>');
      expect(nodes).toHaveLength(1);

      const element = nodes[0] as ElementASTNode;
      expect(element.children).toHaveLength(1);
      expect(element.children[0].type).toBe('MustacheTag');

      const mustache = element.children[0] as MustacheTagASTNode;
      expect(mustache.expression).toBeDefined();
    });

    it('should parse if block with compound condition', () => {
      const nodes = parseTemplate('{#if showErrorDetails && error}<div>Details</div>{/if}');
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('IfBlock');

      const ifBlock = nodes[0] as IfBlockASTNode;
      expect(ifBlock.expression).toBeDefined();
      expect(ifBlock.children).toHaveLength(1);
    });

    it('should parse expression with ternary operator', () => {
      const nodes = parseTemplate('{count > 0 ? "items" : "no items"}');
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('MustacheTag');

      const mustache = nodes[0] as MustacheTagASTNode;
      expect(mustache.expression).toBeDefined();
    });

    it('should parse nested property access', () => {
      const nodes = parseTemplate('{user?.profile?.name}');
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('MustacheTag');

      const mustache = nodes[0] as MustacheTagASTNode;
      expect(mustache.expression).toBeDefined();
    });
  });

  describe('Error handling', () => {
    it('should throw error for unknown directive', () => {
      expect(() => {
        parseTemplate('{#unknown}test{/unknown}');
      }).toThrow();
    });

    it('should throw error for unexpected character', () => {
      expect(() => {
        parseTemplate('<div class=>test</div>');
      }).toThrow();
    });

    it('should throw error for invalid expression', () => {
      expect(() => {
        parseTemplate('{let x =}');
      }).toThrow();
    });
  });
});
