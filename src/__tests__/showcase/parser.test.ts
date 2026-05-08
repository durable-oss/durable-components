import { describe, it, expect } from 'vitest';
import { parseShowcase } from '../../showcase/parser';

describe('parseShowcase', () => {
  describe('params', () => {
    it('returns empty params when no <params> block', () => {
      const result = parseShowcase('<scenario name="X"><p>hi</p></scenario>');
      expect(result.params).toEqual([]);
    });

    it('parses a string param with quoted default', () => {
      const source = `
<params>
  <param name="label" type="string" default="Click me" />
</params>
<scenario name="X"><p /></scenario>`;
      const { params } = parseShowcase(source);
      expect(params).toHaveLength(1);
      expect(params[0]).toEqual({ name: 'label', type: 'string', default: 'Click me' });
    });

    it('parses a number param with brace default', () => {
      const source = `
<params>
  <param name="count" type="number" default={42} />
</params>
<scenario name="X"><p /></scenario>`;
      const { params } = parseShowcase(source);
      expect(params[0]).toEqual({ name: 'count', type: 'number', default: 42 });
    });

    it('parses a boolean param true with brace default', () => {
      const source = `
<params>
  <param name="disabled" type="boolean" default={false} />
</params>
<scenario name="X"><p /></scenario>`;
      const { params } = parseShowcase(source);
      expect(params[0]).toEqual({ name: 'disabled', type: 'boolean', default: false });
    });

    it('parses a boolean param set to true', () => {
      const source = `
<params>
  <param name="active" type="boolean" default={true} />
</params>
<scenario name="X"><p /></scenario>`;
      const { params } = parseShowcase(source);
      expect(params[0].default).toBe(true);
    });

    it('defaults boolean to true when default attribute is empty', () => {
      const source = `
<params>
  <param name="show" type="boolean" default="" />
</params>
<scenario name="X"><p /></scenario>`;
      const { params } = parseShowcase(source);
      expect(params[0].default).toBe(true);
    });

    it('defaults string to empty string when default is missing', () => {
      const source = `
<params>
  <param name="label" type="string" default="" />
</params>
<scenario name="X"><p /></scenario>`;
      const { params } = parseShowcase(source);
      expect(params[0].default).toBe('');
    });

    it('defaults number to 0 when default is empty', () => {
      const source = `
<params>
  <param name="count" type="number" default="" />
</params>
<scenario name="X"><p /></scenario>`;
      const { params } = parseShowcase(source);
      expect(params[0].default).toBe(0);
    });

    it('defaults type to string when type attribute is absent', () => {
      const source = `
<params>
  <param name="x" default="hello" />
</params>
<scenario name="X"><p /></scenario>`;
      const { params } = parseShowcase(source);
      expect(params[0].type).toBe('string');
    });

    it('parses multiple params in order', () => {
      const source = `
<params>
  <param name="a" type="string" default="foo" />
  <param name="b" type="number" default={10} />
  <param name="c" type="boolean" default={false} />
</params>
<scenario name="X"><p /></scenario>`;
      const { params } = parseShowcase(source);
      expect(params).toHaveLength(3);
      expect(params.map(p => p.name)).toEqual(['a', 'b', 'c']);
    });

    it('ignores params without a name attribute', () => {
      const source = `
<params>
  <param type="string" default="foo" />
</params>
<scenario name="X"><p /></scenario>`;
      const { params } = parseShowcase(source);
      expect(params).toHaveLength(0);
    });
  });

  describe('scenarios', () => {
    it('returns empty scenarios array when none present', () => {
      const result = parseShowcase('<params></params>');
      expect(result.scenarios).toEqual([]);
    });

    it('parses a single scenario with body', () => {
      const source = `<scenario name="Default"><Button>Click</Button></scenario>`;
      const { scenarios } = parseShowcase(source);
      expect(scenarios).toHaveLength(1);
      expect(scenarios[0].name).toBe('Default');
      expect(scenarios[0].body).toBe('<Button>Click</Button>');
    });

    it('trims whitespace from scenario body', () => {
      const source = `<scenario name="X">\n  <p>hi</p>\n</scenario>`;
      const { scenarios } = parseShowcase(source);
      expect(scenarios[0].body).toBe('<p>hi</p>');
    });

    it('uses "Unnamed" when scenario name attribute is absent', () => {
      // The parser regex requires at least one whitespace after <scenario to match.
      // A name-less scenario must still include a space before closing >.
      const source = `<scenario ><p>hi</p></scenario>`;
      const { scenarios } = parseShowcase(source);
      expect(scenarios[0].name).toBe('Unnamed');
    });

    it('parses multiple scenarios in order', () => {
      const source = `
<scenario name="A"><p>a</p></scenario>
<scenario name="B"><p>b</p></scenario>
<scenario name="C"><p>c</p></scenario>`;
      const { scenarios } = parseShowcase(source);
      expect(scenarios.map(s => s.name)).toEqual(['A', 'B', 'C']);
    });

    it('preserves multiline body content', () => {
      const source = `<scenario name="X">
  <div>
    <p>line one</p>
    <p>line two</p>
  </div>
</scenario>`;
      const { scenarios } = parseShowcase(source);
      expect(scenarios[0].body).toContain('<p>line one</p>');
      expect(scenarios[0].body).toContain('<p>line two</p>');
    });

    it('handles scenarios with expression attributes in body', () => {
      const source = `<scenario name="X"><Button disabled={true} /></scenario>`;
      const { scenarios } = parseShowcase(source);
      expect(scenarios[0].body).toContain('disabled={true}');
    });
  });

  describe('imports', () => {
    it('returns empty imports when none present', () => {
      const result = parseShowcase('<scenario name="X"><p /></scenario>');
      expect(result.imports).toEqual([]);
    });

    it('extracts a single import path', () => {
      const source = `import Button from './Button.dce'
<scenario name="X"><Button /></scenario>`;
      const { imports } = parseShowcase(source);
      expect(imports).toEqual(['./Button.dce']);
    });

    it('extracts multiple import paths', () => {
      const source = `import Button from './Button.dce'
import Card from "../Card.dce"
<scenario name="X"><Button /></scenario>`;
      const { imports } = parseShowcase(source);
      expect(imports).toHaveLength(2);
      expect(imports).toContain('./Button.dce');
      expect(imports).toContain('../Card.dce');
    });

    it('does not extract non-import lines', () => {
      const source = `// import Button from './Button.dce'
<scenario name="X"><p /></scenario>`;
      const { imports } = parseShowcase(source);
      expect(imports).toHaveLength(0);
    });
  });

  describe('combined showcase files', () => {
    it('parses a complete showcase file with params and scenarios', () => {
      const source = `
<params>
  <param name="label" type="string" default="Click me" />
  <param name="disabled" type="boolean" default={false} />
  <param name="count" type="number" default={0} />
</params>

<scenario name="Default">
  <Button disabled={disabled}>{label}</Button>
</scenario>

<scenario name="Disabled">
  <Button disabled={true}>{label}</Button>
</scenario>`;
      const result = parseShowcase(source);
      expect(result.params).toHaveLength(3);
      expect(result.scenarios).toHaveLength(2);
      expect(result.scenarios[0].name).toBe('Default');
      expect(result.scenarios[1].name).toBe('Disabled');
    });

    it('returns all three top-level fields', () => {
      const result = parseShowcase('');
      expect(result).toHaveProperty('params');
      expect(result).toHaveProperty('scenarios');
      expect(result).toHaveProperty('imports');
    });
  });

  describe('real fixture files', () => {
    it('parses Button.showcase correctly', async () => {
      const { readFileSync } = await import('node:fs');
      const { join } = await import('node:path');
      const source = readFileSync(
        join(__dirname, '../fixtures/Button.showcase'),
        'utf-8'
      );
      const result = parseShowcase(source);
      expect(result.params.length).toBeGreaterThan(0);
      expect(result.scenarios.length).toBeGreaterThan(0);
      const names = result.scenarios.map(s => s.name);
      expect(names).toContain('Default');
    });

    it('parses Tabs.showcase correctly', async () => {
      const { readFileSync } = await import('node:fs');
      const { join } = await import('node:path');
      const source = readFileSync(
        join(__dirname, '../fixtures/Tabs.showcase'),
        'utf-8'
      );
      const result = parseShowcase(source);
      expect(result.scenarios.length).toBeGreaterThan(0);
    });
  });
});
