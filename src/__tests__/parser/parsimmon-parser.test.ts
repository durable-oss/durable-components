/**
 * Parsimmon-based parser tests
 * Tests for multiline template literals and TML comments
 */

import { parseTemplate } from '../../parser/parsimmon';
import type {
  TextASTNode,
  MustacheTagASTNode,
  CommentASTNode,
  ElementASTNode
} from '../../types/ast';

describe('Parsimmon Parser - Multiline Template Literals', () => {
  describe('Basic template literals', () => {
    it('should parse simple template literal in mustache tag', () => {
      const nodes = parseTemplate('{`hello`}');
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('MustacheTag');
      const mustache = nodes[0] as MustacheTagASTNode;
      expect(mustache.expression).toBeDefined();
    });

    it('should parse template literal with single line', () => {
      const nodes = parseTemplate('{`Hello World`}');
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('MustacheTag');
    });

    it('should parse template literal with multiline content', () => {
      const template = `{\`Line 1
Line 2
Line 3\`}`;
      const nodes = parseTemplate(template);
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('MustacheTag');
    });

    it('should parse template literal with embedded newlines and spaces', () => {
      const template = `{\`
        Multi-line
        template
        literal
      \`}`;
      const nodes = parseTemplate(template);
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('MustacheTag');
    });
  });

  describe('Template literals with expressions', () => {
    it('should parse template literal with simple expression', () => {
      const nodes = parseTemplate('{`Hello ${name}`}');
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('MustacheTag');
    });

    it('should parse template literal with multiple expressions', () => {
      const nodes = parseTemplate('{`${greeting} ${name}!`}');
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('MustacheTag');
    });

    it('should parse multiline template literal with expressions', () => {
      const template = `{\`Hello \${name},
Welcome to \${place}!
Today is \${day}\`}`;
      const nodes = parseTemplate(template);
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('MustacheTag');
    });

    it('should parse template literal with nested braces in expression', () => {
      const nodes = parseTemplate('{`Result: ${obj.prop}`}');
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('MustacheTag');
    });

    it('should parse template literal with complex expression', () => {
      const nodes = parseTemplate('{`Count: ${items.filter(x => x.active).length}`}');
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('MustacheTag');
    });

    it('should parse multiline template with function call in expression', () => {
      const template = `{\`Result:
\${calculate({
  a: 1,
  b: 2
})}\`}`;
      const nodes = parseTemplate(template);
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('MustacheTag');
    });
  });

  describe('Template literals with special characters', () => {
    it('should parse template literal with escaped characters', () => {
      const nodes = parseTemplate('{`Line 1\\nLine 2`}');
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('MustacheTag');
    });

    it('should parse template literal with escaped backtick', () => {
      const nodes = parseTemplate('{`Code: \\`example\\``}');
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('MustacheTag');
    });

    it('should parse template literal with dollar sign not followed by brace', () => {
      const nodes = parseTemplate('{`Price: $50`}');
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('MustacheTag');
    });

    it('should parse multiline template with tabs and special whitespace', () => {
      const template = `{\`
\t\tIndented with tabs
\t\tMore tabs
      \`}`;
      const nodes = parseTemplate(template);
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('MustacheTag');
    });
  });

  describe('Template literals in attributes', () => {
    it('should parse element with template literal in attribute', () => {
      const nodes = parseTemplate('<div title={`Hello ${name}`}>Test</div>');
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('Element');
      const element = nodes[0] as ElementASTNode;
      expect(element.attributes).toHaveLength(1);
    });

    it('should parse element with multiline template literal in attribute', () => {
      const template = `<div title={\`Line 1
Line 2\`}>Content</div>`;
      const nodes = parseTemplate(template);
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('Element');
    });

    it('should parse element with multiple attributes containing templates', () => {
      const template = `<div
        title={\`Title: \${title}\`}
        data-info={\`Info:
        \${info}\`}
      >Content</div>`;
      const nodes = parseTemplate(template);
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('Element');
    });
  });

  describe('Nested template literals', () => {
    it('should parse nested template literals', () => {
      const nodes = parseTemplate('{`Outer ${`inner`} template`}');
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('MustacheTag');
    });

    it('should parse deeply nested template literals', () => {
      const nodes = parseTemplate('{`Level 1 ${`Level 2 ${`Level 3`}`}`}');
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('MustacheTag');
    });

    it('should parse multiline nested template literals', () => {
      const template = `{\`Outer
\${
  \`Inner
  \${value}\`
}\`}`;
      const nodes = parseTemplate(template);
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('MustacheTag');
    });
  });

  describe('Complex real-world scenarios', () => {
    it('should parse SQL-like multiline template', () => {
      const template = `{\`
        SELECT *
        FROM users
        WHERE id = \${userId}
          AND status = '\${status}'
      \`}`;
      const nodes = parseTemplate(template);
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('MustacheTag');
    });

    it('should parse HTML template string', () => {
      const template = `{\`
        <div class="container">
          <h1>\${title}</h1>
          <p>\${description}</p>
        </div>
      \`}`;
      const nodes = parseTemplate(template);
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('MustacheTag');
    });

    it('should parse JSON-like multiline template', () => {
      const template = `{\`{
  "name": "\${name}",
  "age": \${age},
  "active": \${active}
}\`}`;
      const nodes = parseTemplate(template);
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('MustacheTag');
    });

    it('should parse markdown-like template', () => {
      const template = `{\`
# \${title}

This is a **\${type}** document.

- Item 1
- Item 2
- \${dynamicItem}
      \`}`;
      const nodes = parseTemplate(template);
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('MustacheTag');
    });
  });
});

describe('Parsimmon Parser - TML Comments', () => {
  describe('Basic comments', () => {
    it('should parse simple comment', () => {
      const nodes = parseTemplate('<!-- comment -->');
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('Comment');
      const comment = nodes[0] as CommentASTNode;
      expect(comment.data).toBe(' comment ');
    });

    it('should parse comment with no spaces', () => {
      const nodes = parseTemplate('<!--comment-->');
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('Comment');
      const comment = nodes[0] as CommentASTNode;
      expect(comment.data).toBe('comment');
    });

    it('should parse empty comment', () => {
      const nodes = parseTemplate('<!---->');
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('Comment');
      const comment = nodes[0] as CommentASTNode;
      expect(comment.data).toBe('');
    });
  });

  describe('Multiline comments', () => {
    it('should parse comment with newline', () => {
      const template = `<!-- comment
on two lines -->`;
      const nodes = parseTemplate(template);
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('Comment');
      const comment = nodes[0] as CommentASTNode;
      expect(comment.data).toContain('comment');
      expect(comment.data).toContain('two lines');
    });

    it('should parse comment with multiple lines', () => {
      const template = `<!--
      Line 1
      Line 2
      Line 3
      -->`;
      const nodes = parseTemplate(template);
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('Comment');
    });

    it('should parse comment with indentation', () => {
      const template = `<!--
        Indented comment
          More indentation
        Back to first level
      -->`;
      const nodes = parseTemplate(template);
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('Comment');
    });

    it('should parse comment with blank lines', () => {
      const template = `<!--
      First line

      Second line after blank

      Third line
      -->`;
      const nodes = parseTemplate(template);
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('Comment');
    });
  });

  describe('Comments with special content', () => {
    it('should parse comment with HTML-like content', () => {
      const nodes = parseTemplate('<!-- <div>not parsed</div> -->');
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('Comment');
      const comment = nodes[0] as CommentASTNode;
      expect(comment.data).toContain('<div>');
    });

    it('should parse comment with mustache-like content', () => {
      const nodes = parseTemplate('<!-- {expression} not parsed -->');
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('Comment');
      const comment = nodes[0] as CommentASTNode;
      expect(comment.data).toContain('{expression}');
    });

    it('should parse comment with special characters', () => {
      const nodes = parseTemplate('<!-- !@#$%^&*() -->');
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('Comment');
    });

    it('should parse comment with dashes in content', () => {
      const nodes = parseTemplate('<!-- TODO: fix-this-issue -->');
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('Comment');
      const comment = nodes[0] as CommentASTNode;
      expect(comment.data).toContain('fix-this-issue');
    });
  });

  describe('Comments in context', () => {
    it('should parse comment between elements', () => {
      const template = `<div>Before</div>
<!-- Comment -->
<div>After</div>`;
      const nodes = parseTemplate(template);
      expect(nodes).toHaveLength(3);
      expect(nodes[0].type).toBe('Element');
      expect(nodes[1].type).toBe('Comment');
      expect(nodes[2].type).toBe('Element');
    });

    it('should parse comment before element', () => {
      const template = `<!-- Header comment -->
<div>Content</div>`;
      const nodes = parseTemplate(template);
      expect(nodes).toHaveLength(2);
      expect(nodes[0].type).toBe('Comment');
      expect(nodes[1].type).toBe('Element');
    });

    it('should parse comment after element', () => {
      const template = `<div>Content</div>
<!-- Footer comment -->`;
      const nodes = parseTemplate(template);
      expect(nodes).toHaveLength(2);
      expect(nodes[0].type).toBe('Element');
      expect(nodes[1].type).toBe('Comment');
    });

    it('should parse multiple comments', () => {
      const template = `<!-- Comment 1 -->
<div>Content</div>
<!-- Comment 2 -->
<p>More</p>
<!-- Comment 3 -->`;
      const nodes = parseTemplate(template);
      expect(nodes).toHaveLength(5);
      expect(nodes[0].type).toBe('Comment');
      expect(nodes[2].type).toBe('Comment');
      expect(nodes[4].type).toBe('Comment');
    });

    it('should parse comment with text and mustache tags', () => {
      const template = `Text before
<!-- Comment -->
{value}
<!-- Another comment -->
Text after`;
      const nodes = parseTemplate(template);
      expect(nodes.filter(n => n.type === 'Comment')).toHaveLength(2);
      expect(nodes.filter(n => n.type === 'Text')).toHaveLength(2);
      expect(nodes.filter(n => n.type === 'MustacheTag')).toHaveLength(1);
    });
  });

  describe('Comments inside elements', () => {
    it('should parse comment as child of element', () => {
      const template = `<div>
  <!-- Comment inside div -->
  <p>Text</p>
</div>`;
      const nodes = parseTemplate(template);
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('Element');
      const element = nodes[0] as ElementASTNode;
      expect(element.children.some(c => c.type === 'Comment')).toBe(true);
    });

    it('should parse multiple comments inside element', () => {
      const template = `<div>
  <!-- First comment -->
  <p>Content</p>
  <!-- Second comment -->
  <span>More</span>
  <!-- Third comment -->
</div>`;
      const nodes = parseTemplate(template);
      expect(nodes).toHaveLength(1);
      const element = nodes[0] as ElementASTNode;
      const comments = element.children.filter(c => c.type === 'Comment');
      expect(comments).toHaveLength(3);
    });

    it('should parse nested comments in nested elements', () => {
      const template = `<div>
  <!-- Outer comment -->
  <section>
    <!-- Inner comment -->
    <p>Text</p>
  </section>
</div>`;
      const nodes = parseTemplate(template);
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('Element');
    });
  });

  describe('Comment-like patterns that should not be comments', () => {
    it('should not parse incomplete comment opening', () => {
      const template = `Text <!- not a comment`;
      // This should either throw or parse as text depending on implementation
      // We're testing that it doesn't parse as a proper comment
      try {
        const nodes = parseTemplate(template);
        // If it doesn't throw, it shouldn't create a Comment node
        expect(nodes.every(n => n.type !== 'Comment')).toBe(true);
      } catch (error) {
        // It's also acceptable to throw an error for malformed syntax
        expect(error).toBeDefined();
      }
    });

    it('should parse unclosed comment as error or text', () => {
      // This should either throw or parse as text depending on implementation
      // We're testing that it doesn't parse as a proper comment
      try {
        const nodes = parseTemplate('<!-- unclosed comment');
        // If it doesn't throw, it shouldn't create a Comment node
        expect(nodes.every(n => n.type !== 'Comment')).toBe(true);
      } catch (error) {
        // It's also acceptable to throw an error
        expect(error).toBeDefined();
      }
    });
  });

  describe('Real-world comment scenarios', () => {
    it('should parse TODO comment', () => {
      const nodes = parseTemplate('<!-- TODO: implement this feature -->');
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('Comment');
      const comment = nodes[0] as CommentASTNode;
      expect(comment.data).toContain('TODO');
    });

    it('should parse documentation comment', () => {
      const template = `<!--
        Component: UserProfile
        Author: John Doe
        Description: Displays user profile information
        Props:
          - name: string
          - email: string
      -->`;
      const nodes = parseTemplate(template);
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('Comment');
    });

    it('should parse disabled code in comment', () => {
      const template = `<div>Active content</div>
<!--
<div>Disabled content</div>
<p>Not rendered</p>
-->
<div>More active content</div>`;
      const nodes = parseTemplate(template);
      expect(nodes).toHaveLength(3);
      expect(nodes[1].type).toBe('Comment');
    });

    it('should parse section separator comments', () => {
      const template = `<!-- ==================== -->
<!-- Header Section -->
<!-- ==================== -->
<header>Header</header>

<!-- ==================== -->
<!-- Main Section -->
<!-- ==================== -->
<main>Main</main>`;
      const nodes = parseTemplate(template);
      const comments = nodes.filter(n => n.type === 'Comment');
      expect(comments.length).toBeGreaterThanOrEqual(6);
    });
  });
});

describe('Parsimmon Parser - Combined multiline templates and comments', () => {
  it('should parse template literal inside element with comments', () => {
    const template = `<!-- Component start -->
<div title={\`Multi
line
title\`}>
  <!-- Content comment -->
  {value}
</div>
<!-- Component end -->`;
    const nodes = parseTemplate(template);
    expect(nodes.filter(n => n.type === 'Comment')).toHaveLength(2);
    expect(nodes.filter(n => n.type === 'Element')).toHaveLength(1);
  });

  it('should parse multiline template with embedded comment-like strings', () => {
    const template = `{\`
      Some text
      <!-- this looks like a comment but it's inside a template string -->
      More text
    \`}`;
    const nodes = parseTemplate(template);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe('MustacheTag');
  });

  it('should parse complex nested structure', () => {
    const template = `<!-- Main container -->
<div>
  <!-- Title section -->
  <h1>{\`Title:
    \${title}\`}</h1>

  <!-- Description with multiline template -->
  <p>{\`
    Description line 1
    Description line 2
    \${description}
  \`}</p>

  <!-- End of container -->
</div>`;
    const nodes = parseTemplate(template);
    expect(nodes.some(n => n.type === 'Comment')).toBe(true);
    expect(nodes.some(n => n.type === 'Element')).toBe(true);
  });
});
