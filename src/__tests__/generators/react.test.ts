/**
 * React generator tests
 */

import { generateReact } from '../../generators/react';
import type { DurableComponentIR } from '../../types/ir';
import { createEmptyIR } from '../../types/ir';

describe('React Generator', () => {
  describe('Basic component generation', () => {
    it('should generate simple component without props', () => {
      const ir = createEmptyIR('Counter');
      ir.template = {
        type: 'element',
        name: 'div',
        children: []
      };

      const result = generateReact(ir);

      expect(result.code).toContain('export function Counter');
      expect(result.code).toContain('return (');
      expect(result.code).toContain('<div');
    });

    it('should import React', () => {
      const ir = createEmptyIR('Test');
      ir.template = {
        type: 'element',
        name: 'div',
        children: []
      };

      const result = generateReact(ir);
      expect(result.code).toMatch(/import React/);
    });

    it('should generate component with display name matching IR name', () => {
      const ir = createEmptyIR('MyComponent');
      ir.template = {
        type: 'element',
        name: 'div',
        children: []
      };

      const result = generateReact(ir);
      expect(result.code).toContain('export function MyComponent');
    });
  });

  describe('Props interface generation', () => {
    it('should generate props interface', () => {
      const ir = createEmptyIR('Greeting');
      ir.props = [{ name: 'name' }];
      ir.template = {
        type: 'element',
        name: 'div',
        children: []
      };

      const result = generateReact(ir);

      expect(result.code).toContain('interface GreetingProps');
      expect(result.code).toContain('name');
    });

    it('should mark props with defaults as optional', () => {
      const ir = createEmptyIR('Test');
      ir.props = [{ name: 'count', defaultValue: '0' }];
      ir.template = {
        type: 'element',
        name: 'div',
        children: []
      };

      const result = generateReact(ir);

      expect(result.code).toContain('count?:');
    });

    it('should handle multiple props', () => {
      const ir = createEmptyIR('User');
      ir.props = [
        { name: 'firstName' },
        { name: 'lastName' },
        { name: 'age', defaultValue: '0' }
      ];
      ir.template = {
        type: 'element',
        name: 'div',
        children: []
      };

      const result = generateReact(ir);

      expect(result.code).toContain('firstName:');
      expect(result.code).toContain('lastName:');
      expect(result.code).toContain('age?:');
    });

    it('should use props type as parameter', () => {
      const ir = createEmptyIR('Component');
      ir.props = [{ name: 'value' }];
      ir.template = {
        type: 'element',
        name: 'div',
        children: []
      };

      const result = generateReact(ir);

      expect(result.code).toContain('function Component(props: ComponentProps)');
    });

    it('should destructure props with defaults', () => {
      const ir = createEmptyIR('Test');
      ir.props = [
        { name: 'count', defaultValue: '0' },
        { name: 'name', defaultValue: '"Guest"' }
      ];
      ir.template = {
        type: 'element',
        name: 'div',
        children: []
      };

      const result = generateReact(ir);

      expect(result.code).toContain('const { count = 0, name = "Guest" } = props;');
    });
  });

  describe('State generation', () => {
    it('should generate useState call', () => {
      const ir = createEmptyIR('Counter');
      ir.state = [{ name: 'count', initialValue: '0' }];
      ir.template = {
        type: 'element',
        name: 'div',
        children: []
      };

      const result = generateReact(ir);

      expect(result.code).toContain('import React, { useState }');
      expect(result.code).toContain('const [count, setCount] = useState(0);');
    });

    it('should generate multiple state variables', () => {
      const ir = createEmptyIR('Form');
      ir.state = [
        { name: 'name', initialValue: '""' },
        { name: 'email', initialValue: '""' }
      ];
      ir.template = {
        type: 'element',
        name: 'form',
        children: []
      };

      const result = generateReact(ir);

      expect(result.code).toContain('[name, setName] = useState("")');
      expect(result.code).toContain('[email, setEmail] = useState("")');
    });

    it('should capitalize setter names correctly', () => {
      const ir = createEmptyIR('Test');
      ir.state = [{ name: 'isActive', initialValue: 'false' }];
      ir.template = {
        type: 'element',
        name: 'div',
        children: []
      };

      const result = generateReact(ir);

      expect(result.code).toContain('setIsActive');
    });
  });

  describe('Derived state generation', () => {
    it('should generate useMemo for derived values', () => {
      const ir = createEmptyIR('Test');
      ir.state = [{ name: 'count', initialValue: '0' }];
      ir.derived = [{
        name: 'doubled',
        expression: 'count * 2',
        dependencies: ['count']
      }];
      ir.template = {
        type: 'element',
        name: 'div',
        children: []
      };

      const result = generateReact(ir);

      expect(result.code).toContain('useMemo');
      expect(result.code).toContain('useState');
      expect(result.code).toContain('const doubled = useMemo(() => count * 2, [count]);');
    });

    it('should handle multiple dependencies', () => {
      const ir = createEmptyIR('Test');
      ir.state = [
        { name: 'x', initialValue: '0' },
        { name: 'y', initialValue: '0' }
      ];
      ir.derived = [{
        name: 'sum',
        expression: 'x + y',
        dependencies: ['x', 'y']
      }];
      ir.template = {
        type: 'element',
        name: 'div',
        children: []
      };

      const result = generateReact(ir);

      expect(result.code).toContain('useMemo(() => x + y, [x, y])');
    });
  });

  describe('Effect generation', () => {
    it('should generate useEffect', () => {
      const ir = createEmptyIR('Test');
      ir.state = [{ name: 'count', initialValue: '0' }];
      ir.effects = [{
        expression: '{\n  console.log(count);\n}',
        dependencies: ['count']
      }];
      ir.template = {
        type: 'element',
        name: 'div',
        children: []
      };

      const result = generateReact(ir);

      expect(result.code).toContain('useEffect');
      expect(result.code).toContain('useState');
      expect(result.code).toContain('useEffect(() =>');
      expect(result.code).toContain('[count]');
    });

    it('should handle multiple effects', () => {
      const ir = createEmptyIR('Test');
      ir.effects = [
        { expression: '{ console.log("effect 1"); }', dependencies: [] },
        { expression: '{ console.log("effect 2"); }', dependencies: [] }
      ];
      ir.template = {
        type: 'element',
        name: 'div',
        children: []
      };

      const result = generateReact(ir);

      expect(result.code).toContain('console.log("effect 1")');
      expect(result.code).toContain('console.log("effect 2")');
      expect(result.code).toContain('useEffect');
    });
  });

  describe('Function generation', () => {
    it('should generate function declaration', () => {
      const ir = createEmptyIR('Test');
      ir.functions = [{
        name: 'handleClick',
        params: [],
        body: '{ console.log("clicked"); }'
      }];
      ir.template = {
        type: 'element',
        name: 'div',
        children: []
      };

      const result = generateReact(ir);

      expect(result.code).toContain('const handleClick = () =>');
    });

    it('should handle function parameters', () => {
      const ir = createEmptyIR('Test');
      ir.functions = [{
        name: 'add',
        params: ['a', 'b'],
        body: '{ return a + b; }'
      }];
      ir.template = {
        type: 'element',
        name: 'div',
        children: []
      };

      const result = generateReact(ir);

      expect(result.code).toContain('const add = (a, b) =>');
    });

    it('should transform state updates to setter calls', () => {
      const ir = createEmptyIR('Counter');
      ir.state = [{ name: 'count', initialValue: '0' }];
      ir.functions = [{
        name: 'increment',
        params: [],
        body: '{\n  count++;\n}'
      }];
      ir.template = {
        type: 'element',
        name: 'div',
        children: []
      };

      const result = generateReact(ir);

      expect(result.code).toContain('setCount(count + 1)');
    });

    it('should transform decrement operator', () => {
      const ir = createEmptyIR('Counter');
      ir.state = [{ name: 'count', initialValue: '0' }];
      ir.functions = [{
        name: 'decrement',
        params: [],
        body: '{\n  count--;\n}'
      }];
      ir.template = {
        type: 'element',
        name: 'div',
        children: []
      };

      const result = generateReact(ir);

      expect(result.code).toContain('setCount(count - 1)');
    });

    it('should transform assignment to setter call', () => {
      const ir = createEmptyIR('Test');
      ir.state = [{ name: 'value', initialValue: '0' }];
      ir.functions = [{
        name: 'setValue',
        params: ['newValue'],
        body: '{\n  value = newValue;\n}'
      }];
      ir.template = {
        type: 'element',
        name: 'div',
        children: []
      };

      const result = generateReact(ir);

      expect(result.code).toContain('setValue(newValue)');
    });
  });

  describe('JSX generation', () => {
    it('should generate simple JSX element', () => {
      const ir = createEmptyIR('Test');
      ir.template = {
        type: 'element',
        name: 'div',
        children: []
      };

      const result = generateReact(ir);

      expect(result.code).toContain('<div />');
    });

    it('should generate element with text content', () => {
      const ir = createEmptyIR('Test');
      ir.template = {
        type: 'element',
        name: 'p',
        children: [{
          type: 'text',
          content: 'Hello World'
        }]
      };

      const result = generateReact(ir);

      expect(result.code).toContain('<p>');
      expect(result.code).toContain('Hello World');
      expect(result.code).toContain('</p>');
    });

    it('should generate element with expression', () => {
      const ir = createEmptyIR('Test');
      ir.template = {
        type: 'element',
        name: 'p',
        children: [{
          type: 'expression',
          expression: 'count'
        }]
      };

      const result = generateReact(ir);

      expect(result.code).toContain('{count}');
    });

    it('should transform class to className', () => {
      const ir = createEmptyIR('Test');
      ir.template = {
        type: 'element',
        name: 'div',
        bindings: { class: '"container"' },
        children: []
      };

      const result = generateReact(ir);

      expect(result.code).toContain('className');
    });

    it('should generate conditional rendering', () => {
      const ir = createEmptyIR('Test');
      const consequent = [{
        type: 'element' as const,
        name: 'p',
        children: []
      }];
      ir.template = {
        type: 'if',
        condition: 'show',
        consequent,
        children: consequent
      };

      const result = generateReact(ir);

      expect(result.code).toContain('show &&');
    });

    it('should generate ternary for if-else', () => {
      const ir = createEmptyIR('Test');
      const consequent = [{
        type: 'text' as const,
        content: 'Yes'
      }];
      const alternate = [{
        type: 'text' as const,
        content: 'No'
      }];
      ir.template = {
        type: 'if',
        condition: 'show',
        consequent,
        alternate,
        children: [...consequent, ...alternate]
      };

      const result = generateReact(ir);

      expect(result.code).toContain('?');
      expect(result.code).toContain(':');
    });

    it('should generate list rendering with map', () => {
      const ir = createEmptyIR('Test');
      ir.template = {
        type: 'each',
        expression: 'items',
        itemName: 'item',
        children: [{
          type: 'element',
          name: 'li',
          children: []
        }]
      };

      const result = generateReact(ir);

      expect(result.code).toContain('items.map');
      expect(result.code).toContain('item');
    });

    it('should generate event handler', () => {
      const ir = createEmptyIR('Test');
      ir.template = {
        type: 'element',
        name: 'button',
        attributes: [{
          name: 'on:click',
          value: 'functions.handleClick'
        }],
        children: []
      };

      const result = generateReact(ir);

      expect(result.code).toContain('onClick');
      expect(result.code).toContain('handleClick');
    });

    it('should handle nested elements', () => {
      const ir = createEmptyIR('Test');
      ir.template = {
        type: 'element',
        name: 'div',
        children: [{
          type: 'element',
          name: 'p',
          children: [{
            type: 'text',
            content: 'Nested'
          }]
        }]
      };

      const result = generateReact(ir);

      expect(result.code).toContain('<div>');
      expect(result.code).toContain('<p>');
      expect(result.code).toContain('Nested');
    });
  });

  describe('Import optimization', () => {
    it('should not import hooks when not used', () => {
      const ir = createEmptyIR('Test');
      ir.template = {
        type: 'element',
        name: 'div',
        children: []
      };

      const result = generateReact(ir);

      expect(result.code).not.toContain('useState');
      expect(result.code).not.toContain('useEffect');
      expect(result.code).not.toContain('useMemo');
    });

    it('should import only used hooks', () => {
      const ir = createEmptyIR('Test');
      ir.state = [{ name: 'count', initialValue: '0' }];
      ir.template = {
        type: 'element',
        name: 'div',
        children: []
      };

      const result = generateReact(ir);

      expect(result.code).toContain('useState');
      expect(result.code).not.toContain('useEffect');
      expect(result.code).not.toContain('useMemo');
    });

    it('should import all used hooks', () => {
      const ir = createEmptyIR('Test');
      ir.state = [{ name: 'count', initialValue: '0' }];
      ir.derived = [{ name: 'doubled', expression: 'count * 2', dependencies: ['count'] }];
      ir.effects = [{ expression: '{}', dependencies: [] }];
      ir.template = {
        type: 'element',
        name: 'div',
        children: []
      };

      const result = generateReact(ir);

      expect(result.code).toContain('useState');
      expect(result.code).toContain('useEffect');
      expect(result.code).toContain('useMemo');
    });
  });
});
