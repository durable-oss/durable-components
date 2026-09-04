/**
 * Regression tests for two silent CSS-scoper bugs. Both produced plausible
 * output; the styles simply never applied.
 *
 * 1. Comments were treated as selectors. The rule splitter and the selector
 *    splitter both worked on raw characters, so a comma inside a comment
 *    (`/* a comment, with a comma *\/`) read as a selector separator: the scope
 *    attribute was injected into the comment text and the rule that followed
 *    was merged into it and destroyed.
 *
 * 2. The scope attribute landed on the LAST compound of a descendant selector
 *    instead of the first: `.root :where(td)` became
 *    `.root [data-dce-x]:where(td)`, which requires the descendant to carry the
 *    scope attribute. Slotted content never does.
 */
import { describe, it, expect } from 'vitest';
import { generateScopedCSS } from '../../styles/scoped';

/** Scope `css` and return the output plus the attribute selector used. */
function scope(css: string): { code: string; attribute: string } {
  const { css: result, scopeId } = generateScopedCSS(css, 'T');
  return { code: result.code, attribute: `[data-${scopeId}]` };
}

describe('scoped CSS: comments', () => {
  it('does not inject the scope attribute into a comment', () => {
    const { code } = scope('/* a comment, with a comma */\n.root { color: red; }');

    expect(code).toContain('/* a comment, with a comma */');
    expect(code).not.toMatch(/\/\*[^*]*\[data-dce-/);
  });

  it('keeps the rule that follows a comma-bearing comment', () => {
    const { code, attribute } = scope(`
      .root { color: red; }
      /* a comment, with a comma */
      .root :where(td) { padding: 0; }
    `);

    // The bug swallowed this rule into the comment.
    expect(code).toContain(':where(td)');
    expect(code).toContain(`.root${attribute} :where(td)`);
  });

  it('leaves a comma inside a comment out of the selector list', () => {
    const { code } = scope('/* one, two, three */\n.a { color: red; }');

    expect(code.match(/\[data-dce-/g)).toHaveLength(1);
  });

  it('ignores a comma inside a string value', () => {
    const { code, attribute } = scope('p::before { content: "a, b"; }');

    expect(code).toBe(`p${attribute}::before { content: "a, b"; }`);
  });

  it('preserves a comment sitting inside a rule body', () => {
    const { code } = scope('.a { /* note, here */ color: red; }');

    expect(code).toContain('/* note, here */');
  });
});

describe('scoped CSS: descendant selectors', () => {
  it('scopes the first compound of a descendant selector', () => {
    const { code, attribute } = scope('.root .child { margin: 0; }');

    expect(code).toBe(`.root${attribute} .child { margin: 0; }`);
    // The bug scoped the descendant, which slotted content never carries.
    expect(code).not.toContain(`.child${attribute}`);
  });

  it('scopes the first compound when the descendant is a pseudo-class', () => {
    const { code, attribute } = scope('.root :where(td) { padding: 0; }');

    expect(code).toBe(`.root${attribute} :where(td) { padding: 0; }`);
    expect(code).not.toContain(`${attribute}:where(td)`);
  });

  it('scopes the first compound across a child combinator', () => {
    const { code, attribute } = scope('.root > .child { margin: 0; }');

    expect(code).toBe(`.root${attribute} > .child { margin: 0; }`);
  });

  it('scopes each selector in a list independently', () => {
    const { code, attribute } = scope('.a .x, .b .y { color: red; }');

    expect(code).toBe(`.a${attribute} .x, .b${attribute} .y { color: red; }`);
  });

  it('places the attribute before a pseudo-class on the first compound', () => {
    const { code, attribute } = scope('button:hover .icon { color: red; }');

    expect(code).toBe(`button${attribute}:hover .icon { color: red; }`);
  });

  it('places the attribute before a pseudo-element', () => {
    const { code, attribute } = scope('p::before { content: ""; }');

    expect(code).toBe(`p${attribute}::before { content: ""; }`);
  });

  it('does not split on a comma inside :is()', () => {
    const { code, attribute } = scope(':is(h1, h2) .title { margin: 0; }');

    expect(code).toBe(`${attribute}:is(h1, h2) .title { margin: 0; }`);
  });

  it('does not treat whitespace inside an attribute selector as a combinator', () => {
    const { code, attribute } = scope('[data-label="a b"] .child { color: red; }');

    expect(code).toBe(`[data-label="a b"]${attribute} .child { color: red; }`);
  });

  it('scopes the first compound of rules nested in @media', () => {
    const { code, attribute } = scope(
      '@media (min-width: 768px) { .root .child { width: 750px; } }'
    );

    expect(code).toContain(`.root${attribute} .child`);
  });
});
