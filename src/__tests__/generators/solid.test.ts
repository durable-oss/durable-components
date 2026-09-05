/**
 * SolidJS generator tests.
 *
 * The Solid generator carries its own copy of much of the React generator's
 * codegen, so these mirror `react.test.ts` where the two targets should agree
 * and pin down the places they deliberately differ: signals instead of hooks,
 * accessor calls on state and derived reads, and no dependency arrays.
 */

import { generateSolid } from '../../generators/solid';
import { createEmptyIR } from '../../types/ir';

/** An IR whose template is a single `<div>` with the given children. */
function irWithTemplate(name: string, children: any[] = []) {
  const ir = createEmptyIR(name);
  ir.template = { type: 'element', name: 'div', children } as any;
  return ir;
}

describe('Solid Generator', () => {
  describe('Basic component generation', () => {
    it('should generate a component function named after the IR', () => {
      const result = generateSolid(irWithTemplate('Counter'));

      expect(result.code).toContain('export function Counter');
      expect(result.code).toContain('return (');
      expect(result.code).toContain('<div');
    });

    it('should not import React', () => {
      const result = generateSolid(irWithTemplate('Test'));

      expect(result.code).not.toContain("from 'react'");
    });

    it('should not import solid-js when no reactive primitives are used', () => {
      const result = generateSolid(irWithTemplate('Static'));

      expect(result.code).not.toContain("from 'solid-js'");
    });

    it('should wrap a non-element template root in a fragment', () => {
      const ir = createEmptyIR('IfRoot');
      ir.template = {
        type: 'if',
        condition: 'show',
        consequent: [{ type: 'element', name: 'span', children: [] }],
        children: [],
      } as any;

      const result = generateSolid(ir);

      // Without the fragment the output is `return ( {show && ...} );`,
      // which is a syntax error rather than JSX.
      expect(result.code).toContain('return (\n    <>');
      expect(result.code).toContain('</>\n  );');
    });
  });

  describe('Props', () => {
    it('should generate a props interface', () => {
      const ir = irWithTemplate('Button');
      ir.props = [{ name: 'label', type: 'string' }] as any;

      const result = generateSolid(ir);

      expect(result.code).toContain('interface ButtonProps');
      expect(result.code).toContain('label: string;');
    });

    it('should mark props with defaults as optional', () => {
      const ir = irWithTemplate('Button');
      ir.props = [{ name: 'variant', type: 'string', defaultValue: "'primary'" }] as any;

      const result = generateSolid(ir);

      expect(result.code).toContain('variant?: string;');
    });

    it('should destructure props with their defaults', () => {
      const ir = irWithTemplate('Button');
      ir.props = [{ name: 'variant', type: 'string', defaultValue: "'primary'" }] as any;

      const result = generateSolid(ir);

      expect(result.code).toContain("const { variant = 'primary' } = props;");
    });

    it('should omit the props parameter when there are no props', () => {
      const result = generateSolid(irWithTemplate('Static'));

      expect(result.code).toContain('export function Static()');
    });
  });

  describe('State', () => {
    it('should use createSignal rather than useState', () => {
      const ir = irWithTemplate('Counter');
      ir.state = [{ name: 'count', initialValue: '0' }] as any;

      const result = generateSolid(ir);

      expect(result.code).toContain('const [count, setCount] = createSignal(0);');
      expect(result.code).not.toContain('useState');
    });

    it('should import createSignal from solid-js', () => {
      const ir = irWithTemplate('Counter');
      ir.state = [{ name: 'count', initialValue: '0' }] as any;

      const result = generateSolid(ir);

      expect(result.code).toContain("from 'solid-js'");
      expect(result.code).toContain('createSignal');
    });

    it('should capitalize setter names', () => {
      const ir = irWithTemplate('Form');
      ir.state = [{ name: 'userName', initialValue: "''" }] as any;

      const result = generateSolid(ir);

      expect(result.code).toContain('setUserName');
    });

    it('should reference a prop by its destructured name in an initial value', () => {
      const ir = irWithTemplate('Counter');
      ir.props = [{ name: 'start', type: 'number' }] as any;
      ir.state = [{ name: 'count', initialValue: 'props.start' }] as any;

      const result = generateSolid(ir);

      expect(result.code).toContain('createSignal(start)');
    });
  });

  describe('Derived values', () => {
    it('should use createMemo rather than useMemo', () => {
      const ir = irWithTemplate('Counter');
      ir.derived = [{ name: 'double', expression: 'count * 2', dependencies: ['count'] }] as any;

      const result = generateSolid(ir);

      expect(result.code).toContain('const double = createMemo(');
      expect(result.code).not.toContain('useMemo');
    });

    it('should not emit a dependency array, since Solid auto-tracks', () => {
      const ir = irWithTemplate('Counter');
      ir.derived = [{ name: 'double', expression: 'count * 2', dependencies: ['count'] }] as any;

      const result = generateSolid(ir);

      expect(result.code).not.toContain(', [count])');
    });

    it('should call the accessor when a memo reads state', () => {
      const ir = irWithTemplate('Counter');
      ir.state = [{ name: 'count', initialValue: '0' }] as any;
      ir.derived = [{ name: 'double', expression: 'count * 2', dependencies: ['count'] }] as any;

      const result = generateSolid(ir);

      expect(result.code).toContain('createMemo(() => count() * 2)');
    });
  });

  describe('Effects', () => {
    it('should use createEffect rather than useEffect', () => {
      const ir = irWithTemplate('Logger');
      ir.effects = [{ expression: 'console.log(count)', dependencies: ['count'] }] as any;

      const result = generateSolid(ir);

      expect(result.code).toContain('createEffect(');
      expect(result.code).not.toContain('useEffect');
    });

    it('should not emit a dependency array on an effect', () => {
      const ir = irWithTemplate('Logger');
      ir.effects = [{ expression: 'console.log(count)', dependencies: ['count'] }] as any;

      const result = generateSolid(ir);

      expect(result.code).not.toContain('}, [count])');
    });

    it('should wrap a bare expression body in a block', () => {
      const ir = irWithTemplate('Logger');
      ir.effects = [{ expression: 'console.log(1)', dependencies: [] }] as any;

      const result = generateSolid(ir);

      expect(result.code).toContain('createEffect(() => {');
    });
  });

  describe('Refs', () => {
    it('should declare a ref as a plain let binding, not createSignal', () => {
      const ir = irWithTemplate('Input');
      ir.refs = [{ name: 'inputEl' }] as any;

      const result = generateSolid(ir);

      expect(result.code).toContain('let inputEl;');
      expect(result.code).not.toContain('useRef');
    });
  });

  describe('JSX generation', () => {
    it('should render an element with text content', () => {
      const ir = irWithTemplate('Greeting', [{ type: 'text', content: 'Hello' }]);

      const result = generateSolid(ir);

      expect(result.code).toContain('Hello');
    });

    it('should call the accessor when an expression reads state', () => {
      const ir = irWithTemplate('Counter', [{ type: 'expression', expression: 'count' }]);
      ir.state = [{ name: 'count', initialValue: '0' }] as any;

      const result = generateSolid(ir);

      expect(result.code).toContain('{count()}');
    });

    it('should not double-call a state accessor that is already called', () => {
      const ir = irWithTemplate('Counter', [{ type: 'expression', expression: 'count()' }]);
      ir.state = [{ name: 'count', initialValue: '0' }] as any;

      const result = generateSolid(ir);

      expect(result.code).not.toContain('count()()');
    });

    it('should render a conditional with &&', () => {
      const ir = irWithTemplate('Toggle', [
        {
          type: 'if',
          condition: 'visible',
          consequent: [{ type: 'element', name: 'span', children: [] }],
          alternate: []
        }
      ]);

      const result = generateSolid(ir);

      expect(result.code).toContain('&& (');
      expect(result.code).toContain('<span');
    });

    it('should render an if/else as a ternary', () => {
      const ir = irWithTemplate('Toggle', [
        {
          type: 'if',
          condition: 'visible',
          consequent: [{ type: 'element', name: 'span', children: [] }],
          alternate: [{ type: 'element', name: 'em', children: [] }]
        }
      ]);

      const result = generateSolid(ir);

      expect(result.code).toContain('?');
      expect(result.code).toContain(':');
      expect(result.code).toContain('<em');
    });

    it('should render a list with <For>', () => {
      const ir = irWithTemplate('List', [
        {
          type: 'each',
          expression: 'items',
          itemName: 'item',
          children: [{ type: 'element', name: 'li', children: [] }]
        }
      ]);

      const result = generateSolid(ir);

      // <For> matches items by reference, so a reorder moves the existing DOM
      // nodes instead of rebuilding the list the way .map() does.
      expect(result.code).toContain('<For each={items}>{(item) =>');
      expect(result.code).toContain("import { For } from 'solid-js';");
      expect(result.code).toContain('<li');
    });

    it('should render a comment as a JSX comment', () => {
      const ir = irWithTemplate('Doc', [{ type: 'comment', content: 'a note' }]);

      const result = generateSolid(ir);

      expect(result.code).toContain('{/* a note */}');
    });
  });

  describe('Imports', () => {
    it('should import each reactive primitive that is used', () => {
      const ir = irWithTemplate('Everything');
      ir.state = [{ name: 'count', initialValue: '0' }] as any;
      ir.derived = [{ name: 'double', expression: 'count * 2', dependencies: ['count'] }] as any;
      ir.effects = [{ expression: 'console.log(1)', dependencies: [] }] as any;

      const result = generateSolid(ir);

      expect(result.code).toContain('createSignal');
      expect(result.code).toContain('createMemo');
      expect(result.code).toContain('createEffect');
    });

    it('should not import a primitive that is unused', () => {
      const ir = irWithTemplate('OnlyState');
      ir.state = [{ name: 'count', initialValue: '0' }] as any;

      const result = generateSolid(ir);

      expect(result.code).not.toContain('createMemo');
      expect(result.code).not.toContain('createEffect');
    });

    it('should emit external module imports', () => {
      const ir = irWithTemplate('Uses');
      ir.imports = [
        { source: './utils', specifiers: [{ type: 'named', local: 'clamp', imported: 'clamp' }] }
      ] as any;

      const result = generateSolid(ir);

      expect(result.code).toContain("import { clamp } from './utils';");
    });
  });
});
