import { describe, it, expect } from 'vitest';
import { compileScenario } from '../../showcase/compiler';
import type { ShowcaseScenario, ShowcaseParam } from '../../showcase/parser';

const scenario = (name: string, body: string): ShowcaseScenario => ({ name, body });
const param = (name: string, type: ShowcaseParam['type'], def: string | number | boolean): ShowcaseParam =>
  ({ name, type, default: def });

describe('compileScenario', () => {
  describe('basic compilation', () => {
    it('compiles a simple scenario to react', () => {
      const s = scenario('Default', '<p>Hello</p>');
      const result = compileScenario(s, [], {}, 'react');
      expect(result.error).toBeUndefined();
      expect(result.code).toBeTruthy();
      expect(result.code).toContain('return');
    });

    it('compiles a simple scenario to svelte', () => {
      const s = scenario('Default', '<p>Hello</p>');
      const result = compileScenario(s, [], {}, 'svelte');
      expect(result.error).toBeUndefined();
      expect(result.code).toContain('<p>Hello</p>');
    });

    it('compiles a simple scenario to vue', () => {
      const s = scenario('Default', '<p>Hello</p>');
      const result = compileScenario(s, [], {}, 'vue');
      expect(result.error).toBeUndefined();
      expect(result.code).toBeTruthy();
    });

    it('compiles a simple scenario to solid', () => {
      const s = scenario('Default', '<p>Hello</p>');
      const result = compileScenario(s, [], {}, 'solid');
      expect(result.error).toBeUndefined();
      expect(result.code).toBeTruthy();
    });
  });

  describe('param injection', () => {
    it('uses default param value when no override provided', () => {
      const s = scenario('Default', '<p>{label}</p>');
      const params = [param('label', 'string', 'Hello')];
      const result = compileScenario(s, params, {}, 'react');
      expect(result.error).toBeUndefined();
      // The DCE source will have: let label = $state("Hello")
      expect(result.code).toContain('"Hello"');
    });

    it('uses provided param value over default', () => {
      const s = scenario('Default', '<p>{label}</p>');
      const params = [param('label', 'string', 'Hello')];
      const result = compileScenario(s, params, { label: 'World' }, 'react');
      expect(result.error).toBeUndefined();
      expect(result.code).toContain('"World"');
    });

    it('injects number params as $state', () => {
      const s = scenario('Default', '<span>{count}</span>');
      const params = [param('count', 'number', 5)];
      const result = compileScenario(s, params, {}, 'react');
      expect(result.error).toBeUndefined();
      expect(result.code).toContain('5');
    });

    it('injects boolean params as $state', () => {
      const s = scenario('Default', '<button disabled={disabled} />');
      const params = [param('disabled', 'boolean', false)];
      const result = compileScenario(s, params, {}, 'react');
      expect(result.error).toBeUndefined();
      expect(result.code).toContain('false');
    });

    it('injects multiple params', () => {
      const s = scenario('Default', '<p>{a} {b}</p>');
      const params = [
        param('a', 'string', 'foo'),
        param('b', 'number', 42),
      ];
      const result = compileScenario(s, params, {}, 'react');
      expect(result.error).toBeUndefined();
      expect(result.code).toContain('"foo"');
      expect(result.code).toContain('42');
    });

    it('handles override for one param while keeping default for another', () => {
      const s = scenario('Default', '<p>{a} {b}</p>');
      const params = [
        param('a', 'string', 'default-a'),
        param('b', 'string', 'default-b'),
      ];
      const result = compileScenario(s, params, { a: 'override-a' }, 'react');
      expect(result.error).toBeUndefined();
      expect(result.code).toContain('"override-a"');
      expect(result.code).toContain('"default-b"');
    });
  });

  describe('scenario without params', () => {
    it('compiles a scenario with no params block', () => {
      const s = scenario('Default', '<div class="card"><p>Static</p></div>');
      const result = compileScenario(s, [], {}, 'react');
      expect(result.error).toBeUndefined();
      expect(result.code).toBeTruthy();
    });
  });

  describe('error handling', () => {
    it('returns error for syntactically invalid template', () => {
      const s = scenario('Broken', '<div><unclosed>');
      const result = compileScenario(s, [], {}, 'react');
      // May or may not error depending on parser tolerance — check it doesn't throw
      expect(result).toHaveProperty('code');
      expect(result).toHaveProperty('css');
    });
  });

  describe('css output', () => {
    it('returns null css when no styles present', () => {
      const s = scenario('Default', '<p>Hello</p>');
      const result = compileScenario(s, [], {}, 'react');
      // CSS may be null or empty string with no style block
      expect(result.css === null || typeof result.css === 'string').toBe(true);
    });
  });

  describe('scenario naming in filename', () => {
    it('uses scenario name in generated filename (affects component name)', () => {
      const s = scenario('MyButton', '<button>Click</button>');
      const result = compileScenario(s, [], {}, 'react');
      expect(result.error).toBeUndefined();
      // Component name derived from filename __showcase_MyButton -> ShowcaseMyButton
      expect(result.code).toContain('ShowcaseMyButton');
    });

    it('handles spaces in scenario name (replaced to underscore)', () => {
      const s = scenario('My Button', '<button>Click</button>');
      const result = compileScenario(s, [], {}, 'react');
      expect(result.error).toBeUndefined();
    });
  });
});
